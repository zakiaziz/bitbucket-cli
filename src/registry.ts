import type { Endpoint } from "./core/access.js";
import type { Call, Client, MutationPlan } from "./core/client.js";
import { asCliError, CliError, stepsFailure, usageError } from "./core/errors.js";
import type { HookHelpers, Pagination, RequestSpec, ResourceCommand, RunResult } from "./core/provider.js";
import { FILE_OPTION, type ArgumentSpec, type Context, type Exception, type GroupSpec, type OptionSpec, type PaginationSpec } from "./core/registry.js";
import { echoable, invalidValue, isRecord, missingFields, readInput, readJsonFile, redact, REDACTED, sameOriginUrl, validateId } from "./core/values.js";

const REPOSITORY_HELP = "Repository as WORKSPACE/REPO_SLUG, or REPO_SLUG with --workspace or the profile workspace.";
const WORKSPACE: OptionSpec = {
  name: "workspace", placeholder: "SLUG", type: "string",
  description: "Workspace slug. Uses the profile workspace when omitted and the repository has no workspace prefix.",
  check: (value) => checkWorkspace("--workspace", value),
};
const REPOSITORY: OptionSpec = {
  name: "repository", placeholder: "REPOSITORY", type: "string", required: true,
  description: REPOSITORY_HELP, check: (value) => checkRepository("--repository", value),
};
const REPO_SCOPE = [REPOSITORY, WORKSPACE];
const FILTER: OptionSpec = { name: "filter", placeholder: "EXPRESSION", type: "string", description: "Bitbucket filter expression, sent as q." };
const SORT: OptionSpec = { name: "sort", placeholder: "FIELD", type: "string", description: "Bitbucket sort field. Prefix with - for descending order, using --sort=-FIELD." };
const PIPELINE_ID = idArgument("PIPELINE_UUID", "Pipeline UUID, including braces when supplied by Bitbucket.");
const PR_ID = idArgument("PULL_REQUEST_ID", "Pull request ID.");
const BRANCH = idArgument("BRANCH", "Branch name. Slashes are kept as part of the name.");
const CLOSE_BRANCH = booleanOption("close-source-branch", "Whether Bitbucket should delete the source branch after merging.");
const DRAFT = booleanOption("draft", "Whether the pull request is a draft.");
const REVIEWER: OptionSpec = { ...idOption("reviewer", "UUID", "Reviewer UUID. Replaces the reviewer list on update."), repeatable: true };
const MERGE_STRATEGIES = ["merge_commit", "squash", "fast_forward", "squash_fast_forward", "rebase_fast_forward", "rebase_merge"];
const PR_STATES = ["OPEN", "MERGED", "DECLINED", "SUPERSEDED"];
const MERGE_WAIT_MS = 120_000;
const MERGE_POLL_MS = 1_000;

function urlPagination(max: number): Pagination {
  return {
    continuation: "url",
    cursorSize: (url) => {
      const sizes = url.searchParams.getAll("pagelen");
      // An opaque URL can omit pagelen. Budget for the endpoint maximum without changing it.
      if (sizes.length === 0) return max;
      return sizes.length === 1 && /^[0-9]+$/.test(sizes[0] ?? "") ? Number(sizes[0]) : undefined;
    },
    apply: (request, page) => {
      if (page.cursor === null) request.query.set("pagelen", String(page.size));
    },
    read: (payload) => {
      if (!isRecord(payload)) return undefined;
      if (payload.next !== undefined && payload.next !== null && typeof payload.next !== "string") return undefined;
      return { nextCursor: payload.next ?? null };
    },
  };
}

export const pagination = urlPagination(100);

const PR_PAGES: PaginationSpec = {
  min: 10, max: 50, default: 50, boundary: "preserve-cursor-size",
  style: urlPagination(50),
  ordering: "Order is set by Bitbucket unless --sort is supplied. With --ticket, page size and --max-items count candidates before exact matching.",
};
const PAGE_EXCEPTIONS: Exception[] = [
  { rule: "STYLE-PAGE-2", reason: "Continuation URLs stay unchanged. --max-items budgets for their pagelen, or the endpoint maximum when pagelen is absent. It stops before a page that exceeds the remaining budget, so it can return fewer than N items, including none." },
  { rule: "STYLE-OPT-6", reason: "--page-size starts at 10 because the provider specifies a minimum of 10. Pull request lists allow at most 50; other lists allow at most 100." },
];

export const groups: GroupSpec[] = [
  { path: ["branches"], summary: "List, get, create, and delete branches.", title: "Manage branches." },
  { path: ["commits"], summary: "List and get commits.", title: "Inspect commits." },
  { path: ["deployments"], summary: "List and get deployments.", title: "Inspect deployments." },
  { path: ["environments"], summary: "List and get environments.", title: "Inspect environments." },
  { path: ["pipelines"], summary: "List, get, run, and stop pipelines.", title: "Manage pipelines." },
  { path: ["pipelines", "steps"], summary: "List and get pipeline steps.", title: "Inspect pipeline steps." },
  { path: ["pipelines", "logs"], summary: "Get pipeline step logs.", title: "Inspect pipeline step logs." },
  { path: ["pull-requests"], summary: "List, get, create, update, merge, decline, approve, and unapprove pull requests.", title: "Manage pull requests." },
  { path: ["pull-requests", "comments"], summary: "List and create pull request comments.", title: "Manage pull request comments." },
  { path: ["pull-requests", "activity"], summary: "List pull request activity.", title: "Inspect pull request activity." },
  { path: ["pull-requests", "diff"], summary: "Get a pull request diff.", title: "Inspect pull request diffs." },
  { path: ["pull-requests", "conflicts"], summary: "List pull request file conflicts.", title: "Inspect pull request file conflicts." },
  { path: ["pull-requests", "ticket-keys"], summary: "List ticket keys in pull request commits.", title: "Inspect pull request ticket keys." },
  { path: ["pull-requests", "merge-tasks"], summary: "Get asynchronous merge status.", title: "Inspect merge tasks." },
  { path: ["repositories"], summary: "List and get repositories.", title: "Inspect repositories." },
  { path: ["users"], summary: "Get the current user.", title: "Inspect the current user." },
  { path: ["users", "current"], summary: "Get the current user.", title: "Inspect the current user." },
  { path: ["workspaces"], summary: "List and get workspaces.", title: "Inspect workspaces." },
];

interface ReadDefinition {
  path: string[];
  summary: string;
  arguments?: ArgumentSpec[];
  options?: OptionSpec[];
  request(context: Context, endpoint: Endpoint): RequestSpec;
  resource: string;
  list?: true;
  ordering?: string;
  example: string;
  text?: "text/plain" | "text/x-diff";
  exceptions?: Exception[];
}

const reads: ReadDefinition[] = [
  {
    path: ["workspaces", "list"],
    summary: "List workspaces accessible to the current user.",
    resource: "workspace permission objects",
    list: true,
    options: [SORT, booleanOption("administrator", "Filter by workspace administrator permission.")],
    request: (context) => ({ path: "/user/workspaces", query: query(context, { sort: "sort", administrator: "administrator" }) }),
    example: "bitbucket workspaces list --page-size 20",
  },
  {
    path: ["workspaces", "get"],
    summary: "Get one workspace.",
    resource: "workspace object",
    arguments: [{ name: "WORKSPACE", description: "Workspace slug.", check: (value) => checkWorkspace("WORKSPACE", value) }],
    request: (context) => ({ path: `/workspaces/${encodedArgument(context)}` }),
    example: "bitbucket workspaces get acme",
  },
  {
    path: ["repositories", "list"],
    summary: "List repositories in a workspace.",
    resource: "repository objects",
    list: true,
    options: [WORKSPACE, FILTER, SORT],
    request: (context, endpoint) => ({ path: `/repositories/${encodeURIComponent(workspace(context, endpoint))}`, query: query(context, { filter: "q", sort: "sort" }) }),
    example: "bitbucket repositories list --workspace acme",
  },
  {
    path: ["repositories", "get"],
    summary: "Get one repository.",
    resource: "repository object",
    arguments: [{ name: "REPOSITORY", description: REPOSITORY_HELP, check: (value) => checkRepository("REPOSITORY", value) }],
    options: [WORKSPACE],
    request: (context, endpoint) => ({ path: repositoryPath(argument(context), context, endpoint) }),
    example: "bitbucket repositories get acme/service",
  },
  {
    path: ["branches", "list"],
    summary: "List branches in a repository.",
    resource: "branch objects",
    list: true,
    options: [...REPO_SCOPE, FILTER, SORT],
    ordering: "Lexical branch-name order unless --sort is supplied.",
    request: (context, endpoint) => ({ path: `${repo(context, endpoint)}/refs/branches`, query: query(context, { filter: "q", sort: "sort" }) }),
    example: "bitbucket branches list --repository acme/service",
  },
  {
    path: ["branches", "get"],
    summary: "Get one branch.",
    resource: "branch object",
    arguments: [BRANCH],
    options: REPO_SCOPE,
    request: (context, endpoint) => ({ path: `${repo(context, endpoint)}/refs/branches/${encodedArgument(context)}` }),
    example: "bitbucket branches get feature/login --repository acme/service",
  },
  {
    path: ["commits", "list"],
    summary: "List commits in a repository.",
    resource: "commit objects",
    list: true,
    options: [
      ...REPO_SCOPE,
      { ...idOption("include", "REF", "Include commits reachable from this ref. Without it, include all refs."), repeatable: true },
      { ...idOption("exclude", "REF", "Exclude commits reachable from this ref."), repeatable: true },
    ],
    ordering: "Reverse chronological order, with descendants before parents.",
    request: (context, endpoint) => ({ path: `${repo(context, endpoint)}/commits`, query: [
      ...context.options.strings("include").map((value): [string, string] => ["include", value]),
      ...context.options.strings("exclude").map((value): [string, string] => ["exclude", value]),
    ] }),
    example: "bitbucket commits list --repository acme/service --include feature/login --exclude main",
  },
  {
    path: ["commits", "get"],
    summary: "Get one commit.",
    resource: "commit object",
    arguments: [idArgument("COMMIT", "Commit hash or revision.")],
    options: REPO_SCOPE,
    request: (context, endpoint) => ({ path: `${repo(context, endpoint)}/commit/${encodedArgument(context)}` }),
    example: "bitbucket commits get a1b2c3d4 --repository acme/service",
  },
  {
    path: ["pull-requests", "get"],
    summary: "Get one pull request.",
    resource: "pull request object",
    arguments: [PR_ID],
    options: REPO_SCOPE,
    request: (context, endpoint) => ({ path: pullRequest(context, endpoint) }),
    example: "bitbucket pull-requests get 42 --repository acme/service",
  },
  {
    path: ["pull-requests", "diff", "get"],
    summary: "Get the text diff of a pull request.",
    resource: "pull request diff",
    text: "text/x-diff",
    arguments: [PR_ID],
    options: REPO_SCOPE,
    request: (context, endpoint) => ({ path: `${pullRequest(context, endpoint)}/diff` }),
    example: "bitbucket pull-requests diff get 42 --repository acme/service",
  },
  {
    path: ["pull-requests", "comments", "list"],
    summary: "List comments on a pull request.",
    resource: "comment objects",
    arguments: [PR_ID],
    options: REPO_SCOPE,
    list: true,
    ordering: "Oldest comments first.",
    request: (context, endpoint) => ({ path: `${pullRequest(context, endpoint)}/comments` }),
    example: "bitbucket pull-requests comments list 42 --repository acme/service",
  },
  {
    path: ["pull-requests", "activity", "list"],
    summary: "List activity on a pull request.",
    resource: "activity objects",
    arguments: [PR_ID],
    options: REPO_SCOPE,
    list: true,
    request: (context, endpoint) => ({ path: `${pullRequest(context, endpoint)}/activity` }),
    example: "bitbucket pull-requests activity list 42 --repository acme/service",
  },
  {
    path: ["pull-requests", "merge-tasks", "get"],
    summary: "Get the status of an asynchronous merge.",
    resource: "merge task object",
    arguments: [idArgument("TASK_ID", "Task ID returned by pull-requests merge.")],
    options: [...REPO_SCOPE, { ...idOption("pull-request-id", "PULL_REQUEST_ID", "Pull request ID."), required: true }],
    request: (context, endpoint) => ({ path: `${repo(context, endpoint)}/pullrequests/${encodeURIComponent(required(context, "pull-request-id"))}/merge/task-status/${encodedArgument(context)}` }),
    example: "bitbucket pull-requests merge-tasks get task-123 --pull-request-id 42 --repository acme/service",
  },
  {
    path: ["pipelines", "list"],
    summary: "List pipelines in a repository.",
    resource: "pipeline objects",
    list: true,
    options: [
      ...REPO_SCOPE,
      idOption("branch", "BRANCH", "Branch name to filter on."),
      textOption("status", "Provider pipeline status to filter on."),
      SORT,
    ],
    request: (context, endpoint) => ({ path: `${repo(context, endpoint)}/pipelines`, query: [
      ...query(context, { branch: "target.ref_name", status: "status", sort: "sort" }),
      ...(context.options.has("branch") ? [["target.ref_type", "branch"] as [string, string]] : []),
    ] }),
    example: "bitbucket pipelines list --repository acme/service --branch main",
  },
  {
    path: ["pipelines", "get"],
    summary: "Get one pipeline and its state.",
    resource: "pipeline object",
    arguments: [PIPELINE_ID],
    options: REPO_SCOPE,
    request: (context, endpoint) => ({ path: pipeline(context, endpoint) }),
    example: "bitbucket pipelines get '{12345678-1234-1234-1234-123456789abc}' --repository acme/service",
  },
  {
    path: ["pipelines", "steps", "list"],
    summary: "List steps in a pipeline.",
    resource: "pipeline step objects",
    arguments: [PIPELINE_ID],
    options: REPO_SCOPE,
    list: true,
    request: (context, endpoint) => ({ path: `${pipeline(context, endpoint)}/steps` }),
    example: "bitbucket pipelines steps list '{12345678-1234-1234-1234-123456789abc}' --repository acme/service",
  },
  {
    path: ["pipelines", "steps", "get"],
    summary: "Get one pipeline step.",
    resource: "pipeline step object",
    arguments: [idArgument("STEP_UUID", "Pipeline step UUID.")],
    options: [...REPO_SCOPE, pipelineOption()],
    request: (context, endpoint) => ({ path: step(context, endpoint) }),
    example: "bitbucket pipelines steps get '{abcdef12-1234-1234-1234-123456789abc}' --pipeline-id '{12345678-1234-1234-1234-123456789abc}' --repository acme/service",
  },
  {
    path: ["pipelines", "logs", "get"],
    summary: "Get the text log of a pipeline step.",
    resource: "step log text",
    text: "text/plain",
    arguments: [idArgument("STEP_UUID", "Pipeline step UUID.")],
    options: [...REPO_SCOPE, pipelineOption()],
    request: (context, endpoint) => ({ path: `${step(context, endpoint)}/log` }),
    example: "bitbucket pipelines logs get '{abcdef12-1234-1234-1234-123456789abc}' --pipeline-id '{12345678-1234-1234-1234-123456789abc}' --repository acme/service",
  },
  ...["deployments", "environments"].flatMap((resource): ReadDefinition[] => [
    {
      path: [resource, "list"],
      summary: `List ${resource} in a repository.`,
      resource: `${resource.slice(0, -1)} objects`,
      options: REPO_SCOPE,
      list: true,
      request: (context, endpoint) => ({ path: `${repo(context, endpoint)}/${resource}` }),
      example: `bitbucket ${resource} list --repository acme/service`,
    },
    {
      path: [resource, "get"],
      summary: `Get one ${resource.slice(0, -1)}.`,
      resource: `${resource.slice(0, -1)} object`,
      arguments: [idArgument(`${resource.slice(0, -1).toUpperCase()}_UUID`, `${resource[0]?.toUpperCase()}${resource.slice(1, -1)} UUID.`)],
      options: REPO_SCOPE,
      request: (context, endpoint) => ({ path: `${repo(context, endpoint)}/${resource}/${encodedArgument(context)}` }),
      example: `bitbucket ${resource} get '{12345678-1234-1234-1234-123456789abc}' --repository acme/service`,
    },
  ]),
  {
    path: ["users", "current", "get"],
    summary: "Get the current user.",
    resource: "user object",
    request: () => ({ path: "/user" }),
    example: "bitbucket users current get --format json",
  },
];

function readCommand(definition: ReadDefinition): ResourceCommand {
  const base = {
    path: definition.path,
    summary: definition.summary,
    arguments: definition.arguments ?? [],
    options: definition.options ?? [],
    effects: { kind: "read" as const, ...(definition.text ? { summary: "Follows up to 3 redirects on the configured API origin within each request timeout. Redirects to another origin fail." } : {}) },
    examples: [definition.example],
    failures: ["NOT_FOUND" as const],
    output: definition.list
      ? `Collection envelope. data is an array of ${definition.resource}; meta holds profile, next_cursor, has_more, and provider.size when supplied.`
      : `Resource envelope. data is the ${definition.resource}${definition.text ? " as a string" : ""}; meta has profile.`,
    exceptions: [...(definition.exceptions ?? []), ...(definition.text ? [{ rule: "STYLE-TIME-1", reason: "Follows up to 3 redirects on the configured origin because this endpoint can redirect to its text resource. Every hop shares the attempt timeout." }] : [])],
  };
  if (definition.list) return {
    ...base,
    method: "GET",
    request: definition.request,
    collectionKey: "values",
    providerMeta: ["size"],
    pagination: { min: 10, max: 100, default: 100, boundary: "preserve-cursor-size", ordering: definition.ordering ?? "Order is set by Bitbucket and is undocumented." },
    exceptions: [...base.exceptions, ...PAGE_EXCEPTIONS],
  };
  if (definition.text) return {
    ...base,
    failures: [...base.failures, "UNSUPPORTED_RESPONSE"],
    async run(context, client) {
      return client.send({
        ...definition.request(context, client.endpoint), method: "GET", mutation: false, raw: true,
        redirects: "same-origin", accept: definition.text,
        settle({ data }, _context, helpers) {
          if (helpers.responseType === "json") {
            throw new CliError("INVALID_RESPONSE", `Bitbucket Cloud ${definition.resource} must be text; received JSON.`, {
              hint: "Retry later. If the failure persists, the Bitbucket Cloud API contract may have changed.",
              provider: helpers.provider,
            });
          }
          return data ?? "";
        },
      });
    },
  };
  return { ...base, method: "GET", request: definition.request, emptyIsNotFound: true };
}

const pullRequestReads: ResourceCommand[] = [
  {
    path: ["pull-requests", "list"],
    summary: "List pull requests in a repository.",
    arguments: [],
    options: [
      ...REPO_SCOPE,
      { name: "query", placeholder: "EXPRESSION", type: "string", description: "BBQL filter expression, sent as q. Combined with the ticket prefilter using AND." },
      SORT,
      { name: "state", placeholder: "STATE", type: "enum", choices: PR_STATES, repeatable: true, description: "State to include. Without it, Bitbucket returns open pull requests." },
      {
        name: "ticket", placeholder: "KEY", type: "string", repeatable: true,
        description: "Match any ticket key. The source branch must equal KEY or start with KEY-, or the title must contain KEY as a whole token. Case sensitive. Uses a BBQL prefilter, then exact local matching.",
        check: (value) => checkTicketPart("--ticket", value, true),
      },
    ],
    effects: { kind: "read" },
    output: "Collection envelope. data is an array of pull requests, each with sorted, unique ticket_keys from its title and source branch. meta holds profile, next_cursor, has_more, and provider.size when supplied. size counts server candidates before exact ticket matching.",
    pagination: PR_PAGES,
    failures: ["NOT_FOUND"],
    exceptions: PAGE_EXCEPTIONS,
    examples: ["bitbucket pull-requests list --repository acme/service --state OPEN --state MERGED --all --format json"],
    async run(context, client) {
      const tickets = [...new Set(context.options.strings("ticket"))];
      const clauses: string[] = [];
      const expression = context.options.string("query");
      if (expression !== undefined) clauses.push(`(${expression})`);
      if (tickets.length) clauses.push(`(${tickets.map((key) => `(source.branch.name ~ "${key}" OR title ~ "${key}")`).join(" OR ")})`);
      const seen = new Set<number>();
      const call: Call = {
        path: `${repo(context, client.endpoint)}/pullrequests`, method: "GET", mutation: false,
        query: [
          ...query(context, { sort: "sort" }),
          ...context.options.strings("state").map((state): [string, string] => ["state", state]),
          ...(clauses.length ? [["q", clauses.join(" AND ")] as [string, string]] : []),
        ],
        collectionKey: "values", providerMeta: ["size"],
        select: (payload) => checkedValues(payload, (item) => {
          const pr = enrichPullRequest(item);
          if (typeof pr.id !== "number" || !Number.isSafeInteger(pr.id) || pr.id <= 0) {
            throw responseField("pullrequests[].id", "be a positive safe integer", pr.id);
          }
          if (seen.has(pr.id)) throw responseField("pullrequests[].id", "be unique across all pages", pr.id);
          seen.add(pr.id);
          return pr;
        }),
      };
      try {
        const result = await client.paginate(call);
        return { ...result, data: matchPullRequests(result.data, tickets) };
      } catch (error) {
        if (!(error instanceof CliError) || !error.extra.partial || !("data" in error.extra.partial)) throw error;
        throw new CliError(error.code, error.message, {
          ...error.extra,
          partial: { ...error.extra.partial, data: matchPullRequests(error.extra.partial.data, tickets) },
        });
      }
    },
  },
  {
    path: ["pull-requests", "conflicts", "list"],
    summary: "List file conflicts in a pull request.",
    arguments: [PR_ID],
    options: REPO_SCOPE,
    effects: { kind: "read", summary: "Reads the dedicated file-conflicts endpoint, following up to 3 redirects on the configured origin per request. Reflects Bitbucket's view at the time of the call; a clean result does not guarantee a merge succeeds." },
    output: "Resource envelope. data is {has_conflicts, conflicts}; conflicts contains every provider file-conflict object, including path. has_conflicts is true when the list is nonempty. Duplicate paths fail. meta has profile, next_cursor: null, and has_more: false. A later-page failure exits 8 with completed conflict objects in partial.data.",
    unpaginated: "Fetches every conflict page automatically, requesting 100 items per page. Preserves provider order. No pagination flags.",
    exceptions: [{ rule: "STYLE-TIME-1", reason: "The PR conflicts endpoint redirects to repository file conflicts. Follows up to 3 redirects on the configured origin within each request timeout." }],
    examples: ["bitbucket pull-requests conflicts list 42 --repository acme/service --format json"],
    async run(context, client) {
      const result = await readPullRequestPages(context, client, "conflicts", (item) => {
        if (!isRecord(item) || typeof item.path !== "string" || item.path === "") {
          throw responseField("conflicts[].path", "be a nonempty string", isRecord(item) ? item.path : item);
        }
        return item;
      });
      return { data: { has_conflicts: result.data.length > 0, conflicts: result.data }, meta: result.meta };
    },
  },
  {
    path: ["pull-requests", "ticket-keys", "list"],
    summary: "List ticket keys in pull request commit messages.",
    arguments: [PR_ID],
    options: [...REPO_SCOPE, {
      name: "project", placeholder: "PROJ", type: "string", repeatable: true,
      description: "Keep keys with this exact uppercase project prefix. Without it, include every project.",
      check: (value) => checkTicketPart("--project", value, false),
    }],
    effects: { kind: "read" },
    output: "Collection envelope. data is [{key, commit_hashes}], sorted by key with unique, sorted commit hashes. Keys match [A-Z][A-Z0-9]+-[0-9]+ as whole tokens. Duplicate source commit hashes fail. meta has profile, next_cursor: null, and has_more: false. A later-page failure exits 8 with completed commit objects in partial.data; those are incomplete input, not a complete key list.",
    unpaginated: "Fetches every PR commit page automatically, requesting 100 items per page. These commits are not on the destination. Bitbucket returns an empty list if the source branch no longer exists. No pagination flags.",
    examples: ["bitbucket pull-requests ticket-keys list 42 --repository acme/service --format json"],
    async run(context, client) {
      const result = await readPullRequestPages(context, client, "commits", (item) => {
        if (!isRecord(item) || typeof item.hash !== "string" || item.hash === "") {
          throw responseField("commits[].hash", "be a nonempty string", isRecord(item) ? item.hash : item);
        }
        if (typeof item.message !== "string") throw responseField("commits[].message", "be a string", item.message);
        return item;
      });
      const projects = context.options.strings("project");
      const hashes = new Map<string, Set<string>>();
      for (const commit of result.data) {
        for (const key of ticketKeys(commit.message as string)) {
          if (projects.length && !projects.includes(key.slice(0, key.indexOf("-")))) continue;
          const commits = hashes.get(key) ?? new Set<string>();
          commits.add(commit.hash as string);
          hashes.set(key, commits);
        }
      }
      return {
        data: [...hashes.keys()].sort().map((key) => ({ key, commit_hashes: [...hashes.get(key)!].sort() })),
        meta: result.meta,
      };
    },
  },
];

function checkedValues(payload: unknown, check: (item: unknown) => Record<string, unknown>): unknown {
  if (!isRecord(payload) || !Array.isArray(payload.values)) return payload;
  return { ...payload, values: payload.values.map(check) };
}

function checkTicketPart(field: string, value: string, key: boolean): string {
  const pattern = key ? /^[A-Z][A-Z0-9]+-[0-9]+$/ : /^[A-Z][A-Z0-9]+$/;
  if (!pattern.test(value)) {
    throw invalidValue(field, `match ${pattern.source}`, echoable(value), key ? "Supply an uppercase project prefix, a hyphen, and a numeric issue number." : "Supply at least two uppercase letters or digits, starting with a letter.");
  }
  return value;
}

function ticketKeys(text: string): string[] {
  return [...new Set(text.match(/(?<![\p{L}\p{M}\p{N}_])[A-Z][A-Z0-9]+-[0-9]+(?![\p{L}\p{M}\p{N}_])/gu) ?? [])].sort();
}

interface TicketPullRequest extends Record<string, unknown> {
  title: string;
  source: { branch: { name: string } };
  ticket_keys: string[];
}

function enrichPullRequest(item: unknown): TicketPullRequest {
  if (!isRecord(item) || typeof item.title !== "string") {
    throw responseField("pullrequests[].title", "be a string", isRecord(item) ? item.title : item);
  }
  const source = item.source;
  const branch = isRecord(source) ? source.branch : undefined;
  if (!isRecord(branch) || typeof branch.name !== "string" || branch.name === "") {
    throw responseField("pullrequests[].source.branch.name", "be a nonempty string", isRecord(branch) ? branch.name : branch);
  }
  return { ...item, ticket_keys: [...new Set([...ticketKeys(item.title), ...ticketKeys(branch.name)])].sort() } as TicketPullRequest;
}

function matchPullRequests(data: unknown, tickets: string[]): TicketPullRequest[] {
  const items = data as TicketPullRequest[];
  if (tickets.length === 0) return items;
  return items.filter((item) => {
    const titleKeys = ticketKeys(item.title);
    const branch = item.source.branch.name;
    return tickets.some((key) => branch === key || branch.startsWith(`${key}-`) || titleKeys.includes(key));
  });
}

async function readPullRequestPages(context: Context, client: Client, resource: "commits" | "conflicts", check: (item: unknown) => Record<string, unknown>) {
  const seen = new Set<string>();
  try {
    const result = await client.paginate({
      path: `${pullRequest(context, client.endpoint)}/${resource}`, method: "GET", mutation: false,
      ...(resource === "conflicts" ? { redirects: "same-origin" as const } : {}),
      collectionKey: "values",
      select: (payload) => checkedValues(payload, (value) => {
        const item = check(value);
        const field = resource === "commits" ? "hash" : "path";
        const identity = item[field] as string;
        if (seen.has(identity)) throw responseField(`${resource}[].${field}`, "be unique across all pages", identity);
        seen.add(identity);
        return item;
      }),
    }, { style: pagination, pageSize: 100, all: true, min: 10, max: 100, boundary: "preserve-cursor-size" });
    return { data: result.data as Record<string, unknown>[], meta: result.meta };
  } catch (error) {
    if (!(error instanceof CliError) || error.code !== "PARTIAL_FAILURE") throw error;
    throw new CliError(error.code, error.message, {
      ...error.extra, hint: `Run the command again to rebuild the complete result. partial.data contains only the ${resource} read before the failure.`,
    });
  }
}

function responseField(field: string, constraint: string, value: unknown): CliError {
  return new CliError("INVALID_RESPONSE", `Bitbucket Cloud ${field} must ${constraint}; received "${echoable(JSON.stringify(value) ?? "undefined")}".`, {
    hint: "Check the remote state. If the failure persists, the Bitbucket Cloud API contract may have changed.",
  });
}

const mutations: ResourceCommand[] = [
  {
    path: ["branches", "create"],
    summary: "Create a branch at a commit or revision.",
    arguments: [BRANCH],
    options: [...REPO_SCOPE, { ...idOption("target", "REVISION", "Commit hash or revision for the new branch."), required: true }],
    effects: { kind: "remote-mutation", summary: "Creates a branch at the supplied target." },
    output: "Resource envelope. data is the branch object; meta has profile.",
    method: "POST",
    request: (context, endpoint) => ({
      path: `${repo(context, endpoint)}/refs/branches`, body: { name: argument(context), target: { hash: required(context, "target") } },
      effect: `Creates branch ${argument(context)} in ${required(context, "repository")} at ${required(context, "target")}.`,
    }),
    examples: ["bitbucket branches create feature/login --repository acme/service --target main --dry-run"],
  },
  {
    path: ["branches", "delete"],
    summary: "Delete a branch.",
    arguments: [BRANCH],
    options: REPO_SCOPE,
    effects: { kind: "remote-mutation", summary: "Deletes the branch reference. Bitbucket has no branch restore endpoint; recreation requires the previous commit hash to remain available." },
    output: "Resource envelope. data is null for an empty response; meta has profile.",
    method: "DELETE",
    request: (context, endpoint) => ({ path: `${repo(context, endpoint)}/refs/branches/${encodedArgument(context)}`, effect: `Deletes branch ${argument(context)} in ${required(context, "repository")}. There is no restore endpoint; recreation needs the previous commit hash.` }),
    examples: ["bitbucket branches delete feature/login --repository acme/service --dry-run"],
  },
  ...(["create", "update"] as const).map((action): ResourceCommand => ({
    path: ["pull-requests", action],
    summary: `${action === "create" ? "Create a pull request" : "Update supplied pull request fields"}.`,
    arguments: action === "update" ? [PR_ID] : [],
    options: [...REPO_SCOPE, ...pullRequestOptions(action)],
    effects: { kind: "remote-mutation", summary: action === "create" ? "Creates a pull request. Omitted destination uses the repository's main branch." : "Changes only supplied fields. --clear-description sends an empty description; --clear-reviewers sends an empty reviewer list." },
    output: "Resource envelope. data is the pull request object; meta has profile.",
    method: action === "create" ? "POST" : "PUT",
    failures: ["NOT_FOUND"],
    prepare: (context) => pullRequestBody(context, action),
    request(context, endpoint, body) {
      return { path: action === "create" ? `${repo(context, endpoint)}/pullrequests` : pullRequest(context, endpoint), body,
        effect: action === "create" ? `Creates a pull request in ${required(context, "repository")}.` : `Updates pull request ${argument(context)} in ${required(context, "repository")}.` };
    },
    examples: [action === "create" ? 'bitbucket pull-requests create --repository acme/service --title "Add login" --source feature/login --destination main --dry-run' : 'bitbucket pull-requests update 42 --repository acme/service --title "Update login" --dry-run'],
  })),
  {
    path: ["pull-requests", "merge"],
    summary: "Merge a pull request.",
    arguments: [PR_ID],
    options: [
      ...REPO_SCOPE,
      textOption("message", "Literal merge commit message."),
      bodyFile("Read the literal merge commit message from PATH. - reads stdin.", ["message"]),
      CLOSE_BRANCH,
      { name: "strategy", placeholder: "STRATEGY", type: "enum", choices: MERGE_STRATEGIES, description: "Merge strategy. Omission uses the repository setting." },
      { name: "wait-timeout", placeholder: "DURATION", type: "duration", default: "2m", description: "Overall asynchronous merge wait in ms, s, or m, from 1ms to 10m. Polls every 1s. Starts after acceptance; --timeout still limits each request." },
    ],
    effects: { kind: "remote-mutation", summary: "Reads the PR before confirmation and sends no merge request if already MERGED. Otherwise sends one merge POST, reconciles network, timeout, or 5xx failures by reading the PR, and waits for asynchronous completion. Dry runs validate locally and send nothing. --close-source-branch true deletes the source branch after merging; recreation requires the previous commit hash to remain available.", atomicity: "The merge can complete even if verification fails. A failed wait reports the accepted task as partial completion; no rollback occurs." },
    output: "Resource envelope. data is the MERGED pull request, including merge_commit.hash; meta has profile. meta.provider contains the merge HTTP status when sent, task_id, location, and task_status for asynchronous work, and note for an already merged or reconciled PR. A failed asynchronous wait exits 8 with the accepted task in partial.completed. OPEN after an uncertain POST reports the original failure with retryable: true; the POST is never retried automatically.",
    exceptions: [domainAction("merge"), {
      rule: "STYLE-OUT-2", reason: "meta.provider includes merge HTTP status, task identity and status, and a note when no POST was needed or a read proved completion after an uncertain POST.",
    }, {
      rule: "STYLE-ERR-3", reason: "An uncertain merge POST followed by a PR read that returns OPEN reports the original failure as retryable. Each invocation still makes at most one merge POST.",
    }],
    examples: ["bitbucket pull-requests merge 42 --repository acme/service --strategy squash --dry-run"],
    prepare: (context) => defined({ message: content(context, "message"), merge_strategy: context.options.string("strategy"), close_source_branch: booleanValue(context, "close-source-branch") }),
    run: mergePullRequest,
  },
  ...(["decline", "approve", "unapprove"] as const).map((action): ResourceCommand => ({
    path: ["pull-requests", action],
    summary: `${action === "unapprove" ? "Remove the current user's approval from" : action === "approve" ? "Approve" : "Decline"} a pull request.`,
    arguments: [PR_ID],
    options: REPO_SCOPE,
    effects: { kind: "remote-mutation", summary: action === "unapprove" ? "Removes the current user's approval. Approval can be added again." : action === "approve" ? "Records the current user's approval." : "Declines the pull request." },
    output: "Resource envelope. data is the provider result, or null for an empty response; meta has profile.",
    method: action === "unapprove" ? "DELETE" : "POST",
    request: (context, endpoint) => ({ path: `${pullRequest(context, endpoint)}/${action === "unapprove" ? "approve" : action}`, effect: `${action === "unapprove" ? "Removes the current user's approval from" : action === "approve" ? "Approves" : "Declines"} pull request ${argument(context)} in ${required(context, "repository")}.` }),
    exceptions: [domainAction(action)],
    examples: [`bitbucket pull-requests ${action} 42 --repository acme/service --dry-run`],
  })),
  {
    path: ["pull-requests", "comments", "create"],
    summary: "Create a comment on a pull request.",
    arguments: [PR_ID],
    options: [
      ...REPO_SCOPE,
      textOption("text", "Literal comment text. Required unless --body-file is supplied."),
      bodyFile("Read nonempty literal comment text from PATH. - reads stdin. Required unless --text is supplied.", ["text"]),
      {
        ...idOption("parent-id", "COMMENT_ID", "Parent comment ID for a reply. Must be a positive safe integer."),
        check(value) {
          commentId(value);
          return value;
        },
      },
    ],
    effects: { kind: "remote-mutation", summary: "Creates a comment, or a reply when --parent-id is supplied." },
    output: "Resource envelope. data is the comment object; meta has profile.",
    method: "POST",
    prepare(context) {
      const text = content(context, "text");
      if (text === undefined || text === "") throw usageError("Comment content must be nonempty; --text and --body-file are absent or empty.", "Supply --text TEXT or --body-file PATH.");
      const parent = context.options.string("parent-id");
      return { content: { raw: text }, ...(parent === undefined ? {} : { parent: { id: commentId(parent) } }) };
    },
    request(context, endpoint, body) {
      return { path: `${pullRequest(context, endpoint)}/comments`, body,
        effect: `Creates a comment on pull request ${argument(context)} in ${required(context, "repository")}.` };
    },
    examples: ['bitbucket pull-requests comments create 42 --repository acme/service --text "Reviewed." --dry-run'],
  },
  {
    path: ["pipelines", "run"],
    summary: "Run a pipeline.",
    arguments: [],
    options: [
      ...REPO_SCOPE,
      {
        ...FILE_OPTION,
        description: `${FILE_OPTION.description} Required unless --branch is supplied. Fields: target (required), variables. target.type is pipeline_ref_target with ref_type (branch or tag) and ref_name, or pipeline_commit_target with commit.hash. A ref target can also pin commit.hash. commit.type is optional and must be "commit" when supplied. Either target accepts selector: {type: "custom", pattern}. Variables are objects with unique key, string value, and boolean secured. Keys contain letters, digits, and underscores and cannot start with a digit. Secured values are redacted in previews and errors. Unknown fields and null values fail. Cannot be combined with --branch or --custom.`,
        conflicts: ["branch", "custom"],
      },
      idOption("branch", "BRANCH", "Branch whose pipeline should run. Required unless --file is supplied."),
      { ...textOption("custom", "Custom pipeline selector pattern."), requires: ["branch"] },
    ],
    effects: { kind: "remote-mutation", summary: "Starts a pipeline. Returns its UUID and state without waiting for completion." },
    output: "Resource envelope. data is the pipeline object, including uuid and state; meta has profile.",
    method: "POST",
    failures: ["NOT_FOUND"],
    prepare: pipelineBody,
    request(context, endpoint, body) {
      return { path: `${repo(context, endpoint)}/pipelines`, body, ...securedInput(body),
        effect: `Starts a pipeline in ${required(context, "repository")}.` };
    },
    settle({ data }, _context, helpers) {
      if (!isRecord(data) || typeof data.uuid !== "string" || data.uuid === "" || !isRecord(data.state) || typeof data.state.name !== "string" || data.state.name === "") {
        throw new CliError("INVALID_RESPONSE", "Bitbucket Cloud pipeline response must contain a nonempty uuid and state.name; completion is unknown.", {
          hint: "Check the remote state before retrying.", outcome: "unknown", provider: helpers.provider,
        });
      }
      return data;
    },
    exceptions: [domainAction("run")],
    examples: ["bitbucket pipelines run --repository acme/service --branch main --dry-run", "bitbucket pipelines run --repository acme/service --file ./pipeline.json --yes"],
  },
  {
    path: ["pipelines", "stop"],
    summary: "Signal a pipeline to stop.",
    arguments: [PIPELINE_ID],
    options: REPO_SCOPE,
    effects: { kind: "remote-mutation", summary: "Signals the pipeline and its unfinished steps to stop. A successful response does not mean every step has stopped." },
    output: "Resource envelope. data is null for an empty response; meta has profile. Read pipelines get to check the state.",
    method: "POST",
    request: (context, endpoint) => ({ path: `${pipeline(context, endpoint)}/stopPipeline`, effect: `Signals pipeline ${argument(context)} in ${required(context, "repository")} to stop.` }),
    exceptions: [domainAction("stop")],
    examples: ["bitbucket pipelines stop '{12345678-1234-1234-1234-123456789abc}' --repository acme/service --dry-run"],
  },
];

export const commands: ResourceCommand[] = [...reads.map(readCommand), ...pullRequestReads, ...mutations].map((command) => ({
  ...command,
  prepare(context) {
    const repository = context.options.string("repository") ?? (command.path.join(" ") === "repositories get" ? argument(context) : undefined);
    if (repository !== undefined) checkRepositoryWorkspace(repository, context.options.string("workspace"));
    return command.prepare?.(context);
  },
}));

interface MergeTask {
  task_id: string;
  location?: string;
}

async function mergePullRequest(context: Context, client: Client, body: unknown): Promise<RunResult | undefined> {
  const path = pullRequest(context, client.endpoint);
  let task: MergeTask | undefined;
  let status: number | undefined;
  const plan: MutationPlan = {
    effect: `Merges pull request ${argument(context)} in ${required(context, "repository")}.${context.options.string("close-source-branch") === "true" ? " Deletes the source branch after merging. There is no branch restore endpoint; recreation needs the previous commit hash." : ""}`,
    steps: [{ name: "merge pull request", call: {
      path: `${path}/merge`, method: "POST", mutation: true, body, keepalive: false,
      settle({ data }, _context, helpers) {
        status = helpers.provider.status;
        if (status === 202) {
          task = mergeTask(data, helpers, client.access().baseUrl);
          return data;
        }
        return mergeState(data, helpers, argument(context), true);
      },
    } }],
  };
  if (context.options.flag("dry-run")) {
    await client.mutate(plan);
    return undefined;
  }
  const read: Call = {
    path, method: "GET", mutation: false,
    settle: ({ data }, _context, helpers) => mergeState(data, helpers, argument(context)),
  };
  const before = await client.send(read);
  const current = before.data as Record<string, unknown>;
  if (current.state === "MERGED") {
    await client.mutate({ steps: [], effect: `Pull request ${argument(context)} is already MERGED. Makes no changes.` });
    return { data: current, meta: { provider: { note: "Pull request is already MERGED; no merge request was sent." } } };
  }
  if (current.state !== "OPEN") throw mergePrecondition(current.state);
  let result;
  try {
    result = await client.mutate(plan);
  } catch (error) {
    const failure = asCliError(error);
    const httpStatus = failure.extra.provider?.status;
    const uncertain = (httpStatus !== undefined && httpStatus >= 500 && httpStatus <= 599)
      || (failure.code === "TRANSIENT_FAILURE" && failure.extra.outcome === "unknown");
    if (!uncertain) throw failure;
    return reconcileMerge(client, read, failure);
  }
  if (!result) return undefined;
  if (!task) return { data: result[0]?.data ?? null, meta: { provider: { status } } };
  return waitForMerge(context, client, path, task);
}

/** Validate inside response hooks so provider values and errors receive core redaction. */
function mergeState(data: unknown, helpers: HookHelpers, expectedId: string, completed = false): Record<string, unknown> {
  try {
    if (!isRecord(data) || typeof data.id !== "number" || !Number.isSafeInteger(data.id) || data.id <= 0) {
      throw responseField("pullrequest.id", "be a positive safe integer", isRecord(data) ? data.id : data);
    }
    if (String(data.id) !== expectedId.replace(/^0+(?=\d)/, "")) {
      throw responseField("pullrequest.id", `match requested PULL_REQUEST_ID ${echoable(expectedId)}`, data.id);
    }
    if (typeof data.state !== "string" || !PR_STATES.includes(data.state)) {
      throw responseField("pullrequest.state", `be one of ${PR_STATES.join(", ")}`, data.state);
    }
    if (completed && data.state !== "MERGED") throw responseField("pullrequest.state", "be MERGED after a successful merge", data.state);
    if (data.state === "MERGED" && (!isRecord(data.merge_commit) || typeof data.merge_commit.hash !== "string" || data.merge_commit.hash === "")) {
      throw responseField("pullrequest.merge_commit.hash", "be a nonempty string for a MERGED pull request", isRecord(data.merge_commit) ? data.merge_commit.hash : data.merge_commit);
    }
    return data;
  } catch (error) {
    const failure = asCliError(error);
    throw new CliError(failure.code, failure.message, {
      ...failure.extra, provider: helpers.provider, ...(completed ? { outcome: "unknown" } : {}),
    });
  }
}

function mergePrecondition(state: unknown, original?: CliError): CliError {
  return new CliError("CONFLICT", `Pull request state must be OPEN to merge; received "${echoable(String(state))}".`, {
    hint: "Inspect the pull request before attempting another merge.", retryable: false,
    details: { pull_request_state: state, ...(original ? { original_error: mergeErrorDetail(original) } : {}) },
  });
}

function mergeErrorDetail(failure: CliError) {
  return { code: failure.code, message: failure.message, ...(failure.extra.provider ? { provider: failure.extra.provider } : {}) };
}

async function reconcileMerge(client: Client, read: Call, failure: CliError): Promise<RunResult> {
  let checked;
  try {
    checked = await client.send(read);
  } catch (error) {
    throw new CliError(failure.code, failure.message, {
      ...failure.extra, retryable: false, outcome: "unknown",
      hint: "The merge outcome could not be verified. Read the pull request before retrying.",
      details: { ...failure.extra.details, reconciliation_error: mergeErrorDetail(asCliError(error)) },
    });
  }
  const current = checked.data as Record<string, unknown>;
  if (current.state === "MERGED") return {
    data: current,
    meta: { provider: {
      ...(failure.extra.provider?.status === undefined ? {} : { status: failure.extra.provider.status }),
      note: "A PR read confirmed MERGED after an uncertain merge request; the merge POST was not retried.",
    } },
  };
  if (current.state !== "OPEN") throw mergePrecondition(current.state, failure);
  const { outcome: _outcome, ...extra } = failure.extra;
  throw new CliError(failure.code, failure.message, {
    ...extra, retryable: true,
    hint: "The PR read returned OPEN. Retry the merge command to check its state again before sending another merge request.",
    details: { ...extra.details, pull_request_state: "OPEN" },
  });
}

async function waitForMerge(context: Context, client: Client, path: string, task: MergeTask): Promise<RunResult> {
  const timeoutMs = context.options.number("wait-timeout") ?? MERGE_WAIT_MS;
  let lastStatus: "PENDING" | "SUCCESS" | null = null;
  try {
    const completed = await client.poll({
      path: `${path}/merge/task-status/${encodeURIComponent(task.task_id)}`, method: "GET", mutation: false,
      ...(task.location ? { query: [...new URL(task.location).searchParams] } : {}),
      settle({ data }, _context, helpers) {
        if (!isRecord(data) || (data.task_status !== "PENDING" && data.task_status !== "SUCCESS")) {
          const failure = responseField("task_status", "be PENDING or SUCCESS", isRecord(data) ? data.task_status : data);
          throw new CliError(failure.code, failure.message, { ...failure.extra, provider: helpers.provider });
        }
        lastStatus = data.task_status;
        if (data.task_status === "SUCCESS") mergeState(data.merge_result, helpers, argument(context), true);
        return data;
      },
    }, {
      intervalMs: MERGE_POLL_MS, timeoutMs,
      until: (data) => isRecord(data) && data.task_status === "SUCCESS",
    });
    if (!completed) throw new CliError("TRANSIENT_FAILURE", `Merge task_status must reach SUCCESS within --wait-timeout ${timeoutMs}ms; last observed ${JSON.stringify(lastStatus)}.`, {
      retryable: false, outcome: "unknown",
    });
    return {
      data: (completed.data as Record<string, unknown>).merge_result,
      meta: { provider: { status: 202, ...task, task_status: "SUCCESS" } },
    };
  } catch (error) {
    const failure = asCliError(error);
    throw stepsFailure({
      completed: [{ step: "accept merge", result: { status: 202, ...task } }],
      failed: [{ step: "wait for merge", error: mergeErrorDetail(failure) }],
      not_attempted: [],
    }, {
      cause: failure.code,
      ...(failure.extra.provider ? { provider: failure.extra.provider } : {}),
      ...(["TRANSIENT_FAILURE", "RATE_LIMITED", "INVALID_RESPONSE"].includes(failure.code) ? { outcome: "unknown" as const } : {}),
      details: { ...task, task_status: lastStatus },
      hint: "The accepted merge was not rolled back. Read pull-requests merge-tasks get with this task_id before sending another merge request.",
    });
  }
}

/** An accepted merge supplies a polling Location, or a task_id in its response body. */
function mergeTask(data: unknown, helpers: HookHelpers, baseUrl: string): MergeTask {
  const fail = () => new CliError("INVALID_RESPONSE", "Bitbucket Cloud accepted the merge but returned no valid task ID or task-status Location; completion is unknown.", {
    hint: "Check the pull request state before retrying.", outcome: "unknown", provider: helpers.provider,
  });
  const bodyId = isRecord(data) ? data.task_id : undefined;
  const validId = (value: unknown): value is string => typeof value === "string" && value.trim() !== "" && value !== "." && value !== ".." && !/[\u0000-\u001f\u007f]/.test(value);
  if (bodyId !== undefined && !validId(bodyId)) throw fail();
  const location = helpers.header("location");
  if (location === undefined) {
    if (!validId(bodyId)) throw fail();
    return { task_id: bodyId };
  }
  const request = new URL(`${baseUrl.replace(/\/+$/, "")}${helpers.request.path}`);
  const url = sameOriginUrl(location, request.toString(), true);
  const prefix = `${request.pathname}/task-status/`;
  if (!url || !url.pathname.startsWith(prefix)) throw fail();
  const suffix = url.pathname.slice(prefix.length);
  let taskId: string;
  try {
    taskId = decodeURIComponent(suffix);
  } catch {
    throw fail();
  }
  if (suffix.includes("/") || !validId(taskId) || (bodyId !== undefined && bodyId !== taskId)) throw fail();
  return { task_id: taskId, location: url.toString() };
}

function idArgument(name: string, description: string): ArgumentSpec {
  return { name, description, check: (value) => validateId(name, value) };
}

function idOption(name: string, placeholder: string, description: string): OptionSpec {
  return { name, placeholder, description, type: "string", check: (value) => validateId(`--${name}`, value) };
}

function textOption(name: string, description: string): OptionSpec {
  return { name, placeholder: "TEXT", description, type: "string" };
}

function bodyFile(description: string, conflicts: string[]): OptionSpec {
  return { name: "body-file", placeholder: "PATH", type: "path", description, conflicts };
}

function booleanOption(name: string, description: string): OptionSpec {
  return { name, placeholder: "BOOLEAN", description, type: "enum", choices: ["true", "false"] };
}

function pipelineOption(): OptionSpec {
  return { ...idOption("pipeline-id", "PIPELINE_UUID", "Pipeline UUID that owns the step."), required: true };
}

function domainAction(action: string): Exception {
  return { rule: "CLI-GRAM-4", reason: `${action} preserves the Bitbucket operation name.` };
}

export function workspaceConstraint(value: string): string | undefined {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) ? undefined : "be a workspace slug of letters, digits, underscores, and hyphens, starting with a letter or digit";
}

function checkWorkspace(subject: string, value: string): string {
  const constraint = workspaceConstraint(value);
  if (constraint) throw invalidValue(subject, constraint, echoable(value), "Use a workspace slug such as acme.");
  return value;
}

function checkRepository(subject: string, value: string): string {
  const parts = value.split("/");
  const slug = parts.at(-1) ?? "";
  if (parts.length > 2 || !/^[A-Za-z0-9._-]+$/.test(slug) || slug === "." || slug === "..") {
    throw invalidValue(subject, "be REPO_SLUG or WORKSPACE/REPO_SLUG", echoable(value), "Use acme/service, or service with --workspace acme.");
  }
  if (parts.length === 2) checkWorkspace(subject, parts[0] ?? "");
  return value;
}

function workspace(context: Context, endpoint: Endpoint): string {
  return context.options.string("workspace") ?? endpoint.require("workspace");
}

function checkRepositoryWorkspace(value: string, explicit: string | undefined): void {
  const parts = value.split("/");
  if (parts.length === 2 && explicit !== undefined && explicit !== parts[0]) {
    throw invalidValue("--workspace", `match the repository workspace ${echoable(parts[0] ?? "")}`, echoable(explicit), "Use a matching --workspace, or omit it for a qualified repository.");
  }
}

function repositoryPath(value: string, context: Context, endpoint: Endpoint): string {
  const parts = value.split("/");
  const owner = parts.length === 2 ? parts[0] as string : workspace(context, endpoint);
  return `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(parts.at(-1) as string)}`;
}

function repo(context: Context, endpoint: Endpoint): string {
  return repositoryPath(required(context, "repository"), context, endpoint);
}

function argument(context: Context): string {
  return context.args[0] ?? "";
}

function encodedArgument(context: Context): string {
  return encodeURIComponent(argument(context));
}

function required(context: Context, name: string): string {
  const value = context.options.string(name);
  if (value === undefined) throw usageError(`Missing required option --${name}.`, `Supply --${name}.`);
  return value;
}

function pullRequest(context: Context, endpoint: Endpoint): string {
  return `${repo(context, endpoint)}/pullrequests/${encodedArgument(context)}`;
}

function pipeline(context: Context, endpoint: Endpoint): string {
  return `${repo(context, endpoint)}/pipelines/${encodedArgument(context)}`;
}

function step(context: Context, endpoint: Endpoint): string {
  return `${repo(context, endpoint)}/pipelines/${encodeURIComponent(required(context, "pipeline-id"))}/steps/${encodedArgument(context)}`;
}

function query(context: Context, mapping: Record<string, string>): [string, string][] {
  return Object.entries(mapping).flatMap(([option, key]): [string, string][] => {
    const value = context.options.string(option);
    return value === undefined ? [] : [[key, value]];
  });
}

function booleanValue(context: Context, name: string): boolean | undefined {
  const value = context.options.string(name);
  return value === undefined ? undefined : value === "true";
}

function content(context: Context, option: string): string | undefined {
  const file = context.options.string("body-file");
  return file === undefined ? context.options.string(option) : readInput("--body-file", file);
}

function defined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function pullRequestOptions(action: "create" | "update"): OptionSpec[] {
  const fields: OptionSpec[] = [textOption("title", `Pull request title.${action === "create" ? " Required unless --file is supplied." : ""}`), textOption("description", "Literal Markdown description."),
    bodyFile("Read the literal Markdown description from PATH. - reads stdin. An empty file clears the description.", ["description"]), idOption("destination", "BRANCH", "Destination branch."), REVIEWER, CLOSE_BRANCH, DRAFT];
  if (action === "create") fields.push(idOption("source", "BRANCH", "Source branch. Required unless --file is supplied."), {
    name: "source-repository", placeholder: "REPOSITORY", type: "string", requires: ["source"],
    description: "Source repository as WORKSPACE/REPO_SLUG for a pull request from a fork.", check: (value) => qualifiedRepository("--source-repository", value),
  });
  else fields.push({ name: "clear-description", type: "boolean", description: "Clear the description.", conflicts: ["description", "body-file"] },
    { name: "clear-reviewers", type: "boolean", description: "Remove all reviewers.", conflicts: ["reviewer"] });
  const schema = action === "create"
    ? "Required fields: title, source.branch.name. source.repository.full_name optionally names WORKSPACE/REPO_SLUG for a fork."
    : "Supply at least one changed field through the file or field options. source cannot be updated.";
  return [{
    ...FILE_OPTION,
    description: `${FILE_OPTION.description} ${schema} Optional fields: description, destination.branch.name, reviewers (objects with uuid), close_source_branch (boolean), draft (boolean).${action === "update" ? " title is optional. Empty description and reviewers clear those fields." : ""} Unknown fields and null values fail. Cannot be combined with field options.`,
    conflicts: fields.map((field) => field.name),
  }, ...fields];
}

function pullRequestBody(context: Context, action: "create" | "update"): Record<string, unknown> {
  const file = context.options.string("file");
  let body: Record<string, unknown>;
  if (file !== undefined) body = objectInput(readJsonFile("--file", file), "--file");
  else {
    const source = context.options.string("source");
    const sourceRepository = context.options.string("source-repository");
    const destination = context.options.string("destination");
    const reviewers = context.options.strings("reviewer");
    body = defined({
      title: context.options.string("title"),
      description: context.options.flag("clear-description") ? "" : content(context, "description"),
      ...(source === undefined ? {} : { source: { branch: { name: source }, ...(sourceRepository === undefined ? {} : { repository: { full_name: sourceRepository } }) } }),
      ...(destination === undefined ? {} : { destination: { branch: { name: destination } } }),
      reviewers: context.options.flag("clear-reviewers") ? [] : reviewers.length ? reviewers.map((uuid) => ({ uuid })) : undefined,
      close_source_branch: booleanValue(context, "close-source-branch"), draft: booleanValue(context, "draft"),
    });
  }
  checkKeys(body, action === "create" ? ["title", "description", "source", "destination", "reviewers", "close_source_branch", "draft"] : ["title", "description", "destination", "reviewers", "close_source_branch", "draft"], "pull request input");
  if (action === "update" && Object.keys(body).length === 0) {
    throw missingFields("pull-requests update", ["title", "description", "body-file", "destination", "reviewer", "close-source-branch", "draft", "clear-description", "clear-reviewers", "file"], true);
  }
  if (action === "create" || body.title !== undefined) stringField(body.title, "title");
  if (body.description !== undefined) stringField(body.description, "description", true);
  if (action === "create" || body.source !== undefined) branchTarget(body.source, "source", true);
  if (body.destination !== undefined) branchTarget(body.destination, "destination", false);
  for (const key of ["close_source_branch", "draft"]) if (body[key] !== undefined) booleanField(body[key], key);
  if (body.reviewers !== undefined) {
    if (!Array.isArray(body.reviewers)) throw fieldError("reviewers", "be an array of objects with uuid", body.reviewers);
    for (const [index, item] of body.reviewers.entries()) {
      const reviewer = objectInput(item, `reviewers[${index}]`);
      checkKeys(reviewer, ["uuid"], `reviewers[${index}]`);
      stringField(reviewer.uuid, `reviewers[${index}].uuid`);
      validateId(`reviewers[${index}].uuid`, reviewer.uuid as string);
    }
  }
  return body;
}

function branchTarget(value: unknown, at: string, source: boolean): void {
  const target = objectInput(value, at);
  checkKeys(target, source ? ["branch", "repository"] : ["branch"], at);
  const branch = objectInput(target.branch, `${at}.branch`);
  checkKeys(branch, ["name"], `${at}.branch`);
  stringField(branch.name, `${at}.branch.name`);
  validateId(`${at}.branch.name`, branch.name as string);
  if (target.repository !== undefined) {
    const repository = objectInput(target.repository, `${at}.repository`);
    checkKeys(repository, ["full_name"], `${at}.repository`);
    stringField(repository.full_name, `${at}.repository.full_name`);
    qualifiedRepository(`${at}.repository.full_name`, repository.full_name as string);
  }
}

function qualifiedRepository(subject: string, value: string): string {
  checkRepository(subject, value);
  if (!value.includes("/")) throw invalidValue(subject, "be WORKSPACE/REPO_SLUG", echoable(value), "Supply a qualified repository such as acme/service.");
  return value;
}

function pipelineBody(context: Context): Record<string, unknown> {
  const file = context.options.string("file");
  let body: Record<string, unknown>;
  if (file === undefined) {
    const branch = context.options.string("branch");
    if (branch === undefined) throw usageError('"pipelines run" needs --branch or --file.', "Supply --branch BRANCH or --file PATH.");
    const custom = context.options.string("custom");
    body = { target: { type: "pipeline_ref_target", ref_type: "branch", ref_name: branch,
      ...(custom === undefined ? {} : { selector: { type: "custom", pattern: custom } }) } };
  } else body = objectInput(readJsonFile("--file", file), "--file");
  try {
    checkKeys(body, ["target", "variables"], "pipeline input");
    const target = objectInput(body.target, "target");
    checkKeys(target, ["type", "ref_type", "ref_name", "commit", "selector"], "target");
    if (target.type !== "pipeline_ref_target" && target.type !== "pipeline_commit_target") throw fieldError("target.type", "be pipeline_ref_target or pipeline_commit_target", target.type);
    if (target.type === "pipeline_ref_target") {
      if (target.ref_type !== "branch" && target.ref_type !== "tag") throw fieldError("target.ref_type", "be branch or tag", target.ref_type);
      stringField(target.ref_name, "target.ref_name");
      validateId("target.ref_name", target.ref_name as string);
    } else {
      if (target.ref_type !== undefined || target.ref_name !== undefined) throw usageError("pipeline_commit_target must not contain ref_type or ref_name.", "Remove the ref fields or use pipeline_ref_target.");
      if (target.commit === undefined) throw fieldError("target.commit", "be an object containing hash", undefined);
    }
    if (target.commit !== undefined) {
      const commit = objectInput(target.commit, "target.commit");
      checkKeys(commit, ["type", "hash"], "target.commit");
      if (commit.type !== undefined && commit.type !== "commit") throw fieldError("target.commit.type", "be commit", commit.type);
      stringField(commit.hash, "target.commit.hash");
      validateId("target.commit.hash", commit.hash as string);
    }
    if (target.selector !== undefined) {
      const selector = objectInput(target.selector, "target.selector");
      checkKeys(selector, ["type", "pattern"], "target.selector");
      if (selector.type !== "custom") throw fieldError("target.selector.type", "be custom", selector.type);
      stringField(selector.pattern, "target.selector.pattern");
    }
    if (body.variables !== undefined) {
      if (!Array.isArray(body.variables)) throw fieldError("variables", "be an array", body.variables);
      const keys = new Set<string>();
      for (const [index, item] of body.variables.entries()) {
        const at = `variables[${index}]`;
        const variable = objectInput(item, at);
        checkKeys(variable, ["key", "value", "secured"], at);
        stringField(variable.key, `${at}.key`);
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.key as string)) throw fieldError(`${at}.key`, "contain only letters, digits, and underscores and not start with a digit", variable.key);
        if (typeof variable.value !== "string") throw usageError(`${at}.value must be a string; received a non-string value.`, "Supply a string value in the input file.");
        booleanField(variable.secured, `${at}.secured`);
        if (keys.has(variable.key as string)) throw fieldError(`${at}.key`, "be unique", variable.key);
        keys.add(variable.key as string);
      }
    }
    return body;
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    const safe = redact({ message: error.message, extra: error.extra }, securedInput(body).secretValues) as { message: string; extra: CliError["extra"] };
    throw new CliError(error.code, safe.message, safe.extra);
  }
}

function objectInput(value: unknown, at: string): Record<string, unknown> {
  if (!isRecord(value)) throw fieldError(at, "be a JSON object", value);
  return value;
}

function checkKeys(value: Record<string, unknown>, allowed: string[], at: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw invalidValue(`${at} field`, `be one of ${allowed.join(", ")}`, echoable(key), "Remove the unknown field.");
}

function stringField(value: unknown, at: string, allowEmpty = false): void {
  if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) throw fieldError(at, allowEmpty ? "be a string" : "be a nonempty string", value);
}

function booleanField(value: unknown, at: string): void {
  if (typeof value !== "boolean") throw fieldError(at, "be true or false", value);
}

function fieldError(at: string, constraint: string, value: unknown): CliError {
  const received = Array.isArray(value) ? "array" : isRecord(value) ? "object" : String(value);
  return invalidValue(at, constraint, echoable(received), `Correct ${at} in the input.`);
}

function commentId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) throw invalidValue("--parent-id", "be a positive safe integer", echoable(value), "Use the id from comments list.");
  return Number(value);
}

/** Redacts secured values at any depth while keeping the transmitted body unchanged. */
export function securedInput(body: unknown): { previewBody: unknown; secretValues: string[] } {
  const secretValues: string[] = [];
  const walk = (value: unknown, hidden = false): unknown => {
    if (Array.isArray(value)) return value.map((item) => walk(item, hidden));
    if (!isRecord(value)) {
      if (hidden && (typeof value === "string" || typeof value === "number")) secretValues.push(String(value));
      return value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      const secured = key === "value" && value.secured === true;
      const preview = walk(item, hidden || secured);
      return [key, secured ? REDACTED : preview];
    }));
  };
  return { previewBody: redact(walk(body)), secretValues };
}
