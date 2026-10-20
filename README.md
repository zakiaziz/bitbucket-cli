# bitbucket-cli

Command-line interface for the Bitbucket Cloud API. It reads workspaces, repositories, branches, commits, pull requests, pipelines, deployments, and environments, creates branches, manages pull requests and comments, and runs or stops pipelines. Each profile is locked to read or write access, so a read-only profile never changes Bitbucket Cloud state. It is not an official Bitbucket Cloud product.

## Install

Requires Node.js 22 or newer.

```bash
npm install -g @zakiaziz/bitbucket-cli
bun add -g @zakiaziz/bitbucket-cli
cd bitbucket-cli && bun run build && bun link
```

## Quick start

```bash
bitbucket setup --email developer@example.com --workspace acme --access read
# Verify the account behind the saved token.
bitbucket auth verify
# List the first page of repositories in the saved workspace.
bitbucket repositories list
# Read an open pull request.
bitbucket pull-requests get 42 --repository service
```

Shell completion: `bitbucket completions bash > ~/.bash/profile.d/bitbucket.sh`.

## Commands

### branches

| Command | Description | Options |
| --- | --- | --- |
| bitbucket branches list | List branches in a repository. | --repository REPOSITORY, --workspace SLUG, --filter EXPRESSION, --sort FIELD, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket branches get BRANCH | Get one branch. | --repository REPOSITORY, --workspace SLUG |
| bitbucket branches create BRANCH | Create a branch at a commit or revision. | --repository REPOSITORY, --workspace SLUG, --target REVISION, --yes, --dry-run |
| bitbucket branches delete BRANCH | Delete a branch. | --repository REPOSITORY, --workspace SLUG, --yes, --dry-run |

### commits

| Command | Description | Options |
| --- | --- | --- |
| bitbucket commits list | List commits in a repository. | --repository REPOSITORY, --workspace SLUG, --include REF, --exclude REF, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket commits get COMMIT | Get one commit. | --repository REPOSITORY, --workspace SLUG |

### deployments

| Command | Description | Options |
| --- | --- | --- |
| bitbucket deployments list | List deployments in a repository. | --repository REPOSITORY, --workspace SLUG, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket deployments get DEPLOYMENT_UUID | Get one deployment. | --repository REPOSITORY, --workspace SLUG |

### environments

| Command | Description | Options |
| --- | --- | --- |
| bitbucket environments list | List environments in a repository. | --repository REPOSITORY, --workspace SLUG, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket environments get ENVIRONMENT_UUID | Get one environment. | --repository REPOSITORY, --workspace SLUG |

### pipelines

| Command | Description | Options |
| --- | --- | --- |
| bitbucket pipelines list | List pipelines in a repository. | --repository REPOSITORY, --workspace SLUG, --branch BRANCH, --status TEXT, --sort FIELD, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket pipelines get PIPELINE_UUID | Get one pipeline and its state. | --repository REPOSITORY, --workspace SLUG |
| bitbucket pipelines run | Run a pipeline. | --repository REPOSITORY, --workspace SLUG, --file PATH, --branch BRANCH, --custom TEXT, --yes, --dry-run |
| bitbucket pipelines stop PIPELINE_UUID | Signal a pipeline to stop. | --repository REPOSITORY, --workspace SLUG, --yes, --dry-run |
| bitbucket pipelines logs get STEP_UUID | Get the text log of a pipeline step. | --repository REPOSITORY, --workspace SLUG, --pipeline-id PIPELINE_UUID |
| bitbucket pipelines steps list PIPELINE_UUID | List steps in a pipeline. | --repository REPOSITORY, --workspace SLUG, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket pipelines steps get STEP_UUID | Get one pipeline step. | --repository REPOSITORY, --workspace SLUG, --pipeline-id PIPELINE_UUID |

### pull-requests

| Command | Description | Options |
| --- | --- | --- |
| bitbucket pull-requests list | List pull requests in a repository. | --repository REPOSITORY, --workspace SLUG, --query EXPRESSION, --sort FIELD, --state STATE, --ticket KEY, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket pull-requests get PULL_REQUEST_ID | Get one pull request. | --repository REPOSITORY, --workspace SLUG |
| bitbucket pull-requests create | Create a pull request. | --repository REPOSITORY, --workspace SLUG, --file PATH, --title TEXT, --description TEXT, --body-file PATH, --destination BRANCH, --reviewer UUID, --close-source-branch BOOLEAN, --draft BOOLEAN, --source BRANCH, --source-repository REPOSITORY, --yes, --dry-run |
| bitbucket pull-requests update PULL_REQUEST_ID | Update supplied pull request fields. | --repository REPOSITORY, --workspace SLUG, --file PATH, --title TEXT, --description TEXT, --body-file PATH, --destination BRANCH, --reviewer UUID, --close-source-branch BOOLEAN, --draft BOOLEAN, --clear-description, --clear-reviewers, --yes, --dry-run |
| bitbucket pull-requests merge PULL_REQUEST_ID | Merge a pull request. | --repository REPOSITORY, --workspace SLUG, --message TEXT, --body-file PATH, --close-source-branch BOOLEAN, --strategy STRATEGY, --wait-timeout DURATION, --yes, --dry-run |
| bitbucket pull-requests decline PULL_REQUEST_ID | Decline a pull request. | --repository REPOSITORY, --workspace SLUG, --yes, --dry-run |
| bitbucket pull-requests approve PULL_REQUEST_ID | Approve a pull request. | --repository REPOSITORY, --workspace SLUG, --yes, --dry-run |
| bitbucket pull-requests unapprove PULL_REQUEST_ID | Remove the current user's approval from a pull request. | --repository REPOSITORY, --workspace SLUG, --yes, --dry-run |
| bitbucket pull-requests activity list PULL_REQUEST_ID | List activity on a pull request. | --repository REPOSITORY, --workspace SLUG, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket pull-requests comments list PULL_REQUEST_ID | List comments on a pull request. | --repository REPOSITORY, --workspace SLUG, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket pull-requests comments create PULL_REQUEST_ID | Create a comment on a pull request. | --repository REPOSITORY, --workspace SLUG, --text TEXT, --body-file PATH, --parent-id COMMENT_ID, --yes, --dry-run |
| bitbucket pull-requests conflicts list PULL_REQUEST_ID | List file conflicts in a pull request. | --repository REPOSITORY, --workspace SLUG |
| bitbucket pull-requests diff get PULL_REQUEST_ID | Get the text diff of a pull request. | --repository REPOSITORY, --workspace SLUG |
| bitbucket pull-requests merge-tasks get TASK_ID | Get the status of an asynchronous merge. | --repository REPOSITORY, --workspace SLUG, --pull-request-id PULL_REQUEST_ID |
| bitbucket pull-requests ticket-keys list PULL_REQUEST_ID | List ticket keys in pull request commit messages. | --repository REPOSITORY, --workspace SLUG, --project PROJ |

### repositories

| Command | Description | Options |
| --- | --- | --- |
| bitbucket repositories list | List repositories in a workspace. | --workspace SLUG, --filter EXPRESSION, --sort FIELD, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket repositories get REPOSITORY | Get one repository. | --workspace SLUG |

### users

| Command | Description | Options |
| --- | --- | --- |
| bitbucket users current get | Get the current user. | None |

### workspaces

| Command | Description | Options |
| --- | --- | --- |
| bitbucket workspaces list | List workspaces accessible to the current user. | --sort FIELD, --administrator BOOLEAN, --page-size N, --cursor TOKEN, --all, --max-items N |
| bitbucket workspaces get WORKSPACE | Get one workspace. | None |

### setup

| Command | Description | Options |
| --- | --- | --- |
| bitbucket setup [NAME] | Create and activate a profile. | --email EMAIL, --api-token-file PATH, --base-url URL, --workspace SLUG, --access ACCESS |

### profiles

| Command | Description | Options |
| --- | --- | --- |
| bitbucket profiles list | List saved profiles. | None |
| bitbucket profiles get NAME | Get one saved profile with secrets redacted. | None |
| bitbucket profiles create NAME | Create a profile without activating it. | --email EMAIL, --api-token-file PATH, --base-url URL, --workspace SLUG, --access ACCESS |
| bitbucket profiles update NAME | Update fields of a profile. | --email EMAIL, --api-token-file PATH, --base-url URL, --workspace SLUG, --clear-base-url, --clear-workspace, --access ACCESS |
| bitbucket profiles delete NAME | Delete a profile. | None |
| bitbucket profiles use NAME | Make a profile the active profile. | None |

### config

| Command | Description | Options |
| --- | --- | --- |
| bitbucket config list | List every configuration key. | None |
| bitbucket config get KEY | Get one configuration value. | None |
| bitbucket config path | Get the configuration paths. | None |

### auth

| Command | Description | Options |
| --- | --- | --- |
| bitbucket auth verify | Verify the Atlassian account email and API token. | None |

### api

| Command | Description | Options |
| --- | --- | --- |
| bitbucket api request METHOD PATH | Send a raw API request. | --query KEY=VALUE, --file PATH, --yes, --dry-run |

### completions

| Command | Description | Options |
| --- | --- | --- |
| bitbucket completions SHELL | Print a shell completion script. | None |

## Global options

| Option | Description |
| --- | --- |
| -h, --help | Show help. Uses no credentials or network. |
| --version | Print the executable name and version. |
| --profile NAME | Select a saved profile. |
| --format FORMAT | Output format. Allowed: json, pretty, human. Default: human. |
| --color WHEN | Color for pretty and human output. Allowed: auto, always, never. Default: auto. |
| -q, --quiet | Suppress progress and notices. Results and errors still print. |
| -v, --verbose | Print redacted diagnostics to stderr. |
| --no-input | Never prompt. Fail when input is missing. |
| --timeout DURATION | Per-request timeout in ms, s, or m, from 1ms to 10m. Default: 30s. |

Network commands (the resource commands, `auth verify`, and `api request`) accept every option except `--version`. Local commands (`setup`, `profiles`, and `config`) accept `--help`, `--format`, `--color`, `--quiet`, `--verbose`, and `--no-input`. `completions` accepts only `--help`. With no command, only `--help`, `--version`, `--verbose`, and `--quiet` apply, and `--version` with a command word fails.

## Authentication

Authentication uses an Atlassian API token with scopes. HTTP Basic sends the Atlassian account email as the username and the API token as the password. App passwords and other authentication schemes are not supported.

To create a token:

1. Open your Atlassian account's **Security** settings and select **Create and manage API tokens**.
2. Select **Create API token with scopes**, enter a name and expiry date, then select **Next**.
3. Select **Bitbucket**, then select the scopes below.
4. Review the choices and create the token. Copy it while it is displayed.
5. Run `bitbucket setup --email developer@example.com --workspace acme --access read` and paste the token at the hidden prompt. For automation, save it in a protected file and pass `--api-token-file PATH`; `-` reads stdin.

See [Create an API token](https://support.atlassian.com/bitbucket-cloud/docs/create-an-api-token/) for the account screens.

The read set for all read commands is:

```text
read:user:bitbucket
read:workspace:bitbucket
read:repository:bitbucket
read:pullrequest:bitbucket
read:pipeline:bitbucket
```

For every implemented mutation, add this write set to the read set:

```text
write:repository:bitbucket
write:pullrequest:bitbucket
write:pipeline:bitbucket
```

| Scope | Commands |
| --- | --- |
| `read:user:bitbucket` | `auth verify`, `users current get`. |
| `read:workspace:bitbucket` | `workspaces list`, `workspaces get`. |
| `read:repository:bitbucket` | Repository, branch, and commit reads. |
| `write:repository:bitbucket` | `branches create`, `branches delete`. Keep the read scope as well. Branch deletion does not need the repository deletion scope. |
| `read:pullrequest:bitbucket` | Pull request, diff, comment, activity, and merge-task reads; comment creation also uses this scope. |
| `write:pullrequest:bitbucket` | Pull request create, update, merge, decline, approve, and unapprove. Keep the read scope as well. |
| `read:pipeline:bitbucket` | Pipeline, step, log, deployment, and environment reads. |
| `write:pipeline:bitbucket` | `pipelines run`, `pipelines stop`. Keep the read scope as well. |

Write scopes do not imply read scopes. The pull request read scope permits comments, so a read-scoped token alone is not a complete write lock. `--access read` blocks comments and all other mutations locally. Scope descriptions are in [API token permissions](https://support.atlassian.com/bitbucket-cloud/docs/api-token-permissions/), with endpoint requirements in the [REST reference](https://developer.atlassian.com/cloud/bitbucket/rest/).

Every profile stores an access level, `read` or `write`, and `setup` and `profiles create` require it; there is no default. With `read`, every mutation fails with `PERMISSION_DENIED` (exit 4) before anything is sent, `--dry-run` included, and the error names the profile and the command that allows mutations. With `write`, mutations run after confirmation. The access level is a local lock; the token's scopes are what Bitbucket Cloud enforces. A read-only profile uses both: a token with the read set only, and `--access read`.

```bash
bitbucket setup reader --email developer@example.com --workspace acme --access read --api-token-file ./token.txt
bitbucket profiles create writer --email developer@example.com --workspace acme --access write --api-token-file ./write-token.txt
bitbucket auth verify --profile reader --format json
bitbucket profiles update reader --access write
bitbucket profiles update reader --access read
```

`setup [NAME]` creates a profile (default name: `default`) and makes it the active profile. It fails when the profile exists. If activation fails after the profile is written, the profile stays saved and `setup` exits 8 with `PARTIAL_FAILURE`. In a terminal without `--no-input`, `setup` prompts for the missing fields: the email with visible input, the API token with hidden input, and the access level. Without a terminal, a missing `--access`, email, or API token fails. Secrets are never command-line values: pass `--api-token-file PATH` (`-` reads stdin) or enter the API token at the prompt. The email is not secret: pass `--email EMAIL` or enter it at the prompt.

Credentials and endpoint settings come only from a profile. No environment variable supplies them or selects a profile, so a scheduled job passes `--profile NAME` explicitly. Profile selection is `--profile NAME`, otherwise `activeProfile` in `config.json`. A selected or active profile that does not exist, and no profile at all, fail with `CONFIGURATION_ERROR` and no fallback. The hint points to `bitbucket setup NAME` or `bitbucket profiles use NAME`.

The CLI reads three environment variables, and none supplies credentials, endpoints, or a profile:

| Variable | Purpose |
| --- | --- |
| `XDG_CONFIG_HOME` | Configuration root when it is an absolute path. Otherwise `~/.config`. |
| `NO_COLOR` | Disables color with `--color auto` when set and nonempty. |
| `CI` | Disables prompts when nonempty and not `0` or `false`. |

Stored in the profile:

- Account email: `email`, from `--email EMAIL` or the visible prompt. The email is not secret.
- API token: `apiToken`, from the hidden prompt or `--api-token-file PATH`.
- Access level: `access`, `read` or `write`.
- Workspace: `workspace`, from `--workspace SLUG`. Optional default for commands that need a workspace.
- Base URL: `baseUrl` in the profile, then `https://api.bitbucket.org/2.0`.

The saved workspace is a documented target default. Command `--workspace` overrides it. A repository named `WORKSPACE/REPO_SLUG` supplies its own workspace; a conflicting explicit `--workspace` fails. A bare repository slug needs `--workspace` or the saved workspace. There is no inferred workspace from the current directory. `workspaces get WORKSPACE` always names its target explicitly.

`auth verify` sends `GET /user` and returns the account in `data.identity`. It reports `identity.scopes` from `x-oauth-scopes` when present, otherwise `null`. The header is optional and is not a permission guarantee. Success proves acceptance for this identity check, not permission for all commands.

## Output and errors

The default output format is `human`: tables for collections and labeled fields for one resource, whatever the terminal. Nested objects and arrays inside one resource print as indented fields and lists, and a table cell shows a short summary such as a name or `N items`, never raw JSON. A dry run prints `dry_run` and `validation`, then each request on its own lines. `--format json` prints one compact, uncolored line on stdout with the envelope `{"data":...,"meta":{...}}`, and scripts and agents pass it explicitly. `--format pretty` prints the same document indented, with syntax highlighting when color applies. With `--format pretty` or the default `human` format and stderr on a terminal, a command that sends a request first prints one gray line, `Profile: NAME`, to stderr. `--quiet` suppresses it, and `--format json` never prints it. Errors go to stderr in the selected format, so the default error is the `human` text. Help, `--version`, and `completions` print plain text. The bare command and a command group with no action print the same help as `--help` on stdout, exit 0; an unknown action fails with exit 2.

`data` is an object for one resource, an array for a collection, a text string for logs and diffs, or `null`, and keeps Bitbucket Cloud's field names. For a collection, the array is unwrapped from `values`. `meta` is always present. Raw `api request` prints the provider body without an envelope.

| `meta` key | When |
| --- | --- |
| `profile` | Every command that sends a request. The name of the profile that served it. |
| `next_cursor` | The complete next URL, or `null` when no continuation remains. |
| `has_more` | Whether unread pages remain. |
| `provider` | List `size` when supplied. Merge results include HTTP `status` when a POST was sent, asynchronous `task_id`, `task_status`, and validated same-origin `location` when supplied. A `note` explains an already merged or reconciled PR. |
| `dry_run`, `validation` | Dry-run previews. `validation` is `local`. |

`pull-requests merge` reads the PR before confirmation. If its state is `MERGED`, the command confirms a no-op and returns the PR, including `merge_commit.hash`, with a note and no merge POST. An `OPEN` PR can proceed; other states fail with `CONFLICT`. The profile must have write access, including for the no-op. `--dry-run` validates locally, previews the POST, and makes no requests.

The merge POST is sent at most once. If it fails with a network error, timeout, or any HTTP 5xx, the CLI reads the PR again using the normal read retry policy. `MERGED` returns success with a note. `OPEN` reports the original failure with `retryable: true`; another invocation checks the PR again before posting. Other states fail with `CONFLICT` and preserve the original failure in `details.original_error`. If reconciliation fails, the original failure keeps `outcome: "unknown"` and includes `details.reconciliation_error`.

An HTTP 202 response starts automatic polling. The CLI reads the task ID from a validated same-origin `Location` header or, when no header is returned, from `task_id` in the body. Polling preserves the Location's query parameters, including repeated parameters. It polls every second until `task_status` is `SUCCESS`. `--wait-timeout DURATION` bounds the entire wait, including reads and retries, from acceptance. It defaults to `2m` and accepts `1ms` through `10m`. `--timeout` still limits each request. Success returns `merge_result` as `data`, including `merge_commit.hash`, and preserves the task identity and status in `meta.provider`.

A failed or timed-out wait exits 8 with `PARTIAL_FAILURE`. `partial.completed` contains the accepted task, `partial.failed` contains the wait error, and `details` holds the task ID and last observed status, or `null` if no status was read. A timeout has `outcome: "unknown"`; the task may still complete. Run `pull-requests merge-tasks get TASK_ID --pull-request-id PULL_REQUEST_ID --repository REPOSITORY` before attempting another merge. An invalid synchronous response fails with `INVALID_RESPONSE` and `outcome: "unknown"`. Successful merges must supply the requested PR ID, state `MERGED`, and a nonempty `merge_commit.hash`. Every PR response is checked against `PULL_REQUEST_ID`, including the initial read, reconciliation, and asynchronous task result. A response for another PR cannot prove that the requested PR merged.

```bash
bitbucket pull-requests merge 42 --repository acme/service --strategy squash --wait-timeout 3m --yes --format json
```

`pipelines run` returns the provider pipeline UUID and state without waiting. `pipelines stop` signals cancellation; use `pipelines get` to inspect the eventual state.

Bitbucket error bodies use `{"type":"error","error":{"message":"...","detail":"...","fields":{"title":["This field is required."]}}}`. The CLI combines `message`, `detail`, and validation messages from `fields`, preserves `error.code` if present, and maps HTTP status to the shared error vocabulary. Request IDs come from `x-request-id`, `atl-traceid`, `x-b3-traceid`, or `error.id`. An error body returned with HTTP 2xx also fails, using `PROVIDER_ERROR` when no HTTP error classification applies.

| HTTP status | Error code |
| --- | --- |
| 400, 422 | `INVALID_REQUEST` |
| 401 | `AUTHENTICATION_FAILED` |
| 403 | `PERMISSION_DENIED` |
| 404 | `NOT_FOUND` |
| 409, 412 | `CONFLICT` |
| 429 | `RATE_LIMITED` |
| 500, 502, 503, 504 | `TRANSIENT_FAILURE` |
| Other non-2xx | `PROVIDER_ERROR` |

With `--format json`, errors print one compact document on stderr, for example `{"error":{"code":"RATE_LIMITED","message":"...","hint":"...","retryable":true,"provider":{"status":429}}}`. Optional keys are `hint`, `outcome` (`unknown` when a mutation may have applied), `provider` (`status`, `code`, `request_id`, `retry_after_seconds`), `details`, and `partial`. The default `human` format prints `Error [CODE]: message` and `Hint: ...`.

| Exit | Error codes |
| --- | --- |
| 0 | Success, including empty collections. |
| 1 | `UNEXPECTED_ERROR`, `PROVIDER_ERROR`, `INVALID_RESPONSE`, `UNSUPPORTED_RESPONSE` |
| 2 | `INVALID_ARGUMENT`, `INVALID_REQUEST` |
| 3 | `CONFIGURATION_ERROR`, `AUTHENTICATION_REQUIRED`, `AUTHENTICATION_FAILED` |
| 4 | `PERMISSION_DENIED` |
| 5 | `NOT_FOUND` |
| 6 | `CONFLICT` |
| 7 | `RATE_LIMITED`, `TRANSIENT_FAILURE` |
| 8 | `PARTIAL_FAILURE` |
| 9 | `CONFIRMATION_REQUIRED`, `CONFIRMATION_DECLINED` |
| 130 | `INTERRUPTED` |

Remote mutations (every resource `create`, `update`, `delete`, `merge`, `decline`, `approve`, `unapprove`, `run`, and `stop` command) need a profile with write access and confirmation. The CLI validates arguments first, then checks the profile's access level (exit 4 for read access, before anything is sent, `--dry-run` included), then resolves credentials (exit 3 when missing), then asks for confirmation. In a terminal, it shows the profile, operation, request, and effect, then prompts. `--yes` confirms without a prompt. With `--no-input`, a non-terminal stdin or stderr, or CI mode, a missing confirmation exits 9. Ctrl-C or end of input at a prompt exits 130 with `INTERRUPTED`. `--dry-run` prints a redacted preview of the request, with headers in the order `Authorization`, `Accept`, `Content-Type`, and sends nothing. It needs a profile but no stored credentials. Preview success does not guarantee that the request succeeds.

Reads make up to 3 attempts on HTTP 429, 500, 502, 503, 504, network errors, and timeouts, waiting 250 ms, then 500 ms, or the `Retry-After` value up to 10 seconds. A `Retry-After` above 10 seconds is not waited on: the command fails with `RATE_LIMITED` and `provider.retry_after_seconds`. Mutations make one attempt. A mutation with an uncertain outcome reports `outcome: "unknown"`; merges first attempt the reconciliation described above. `--timeout` applies to each attempt. `--verbose` writes redacted request, response, and retry diagnostics to stderr. A failure inside an HTTP 2xx body fails at once without a retry.

Branch deletion removes the branch reference. Bitbucket has no branch restore endpoint; recreation requires its previous commit hash to remain available. Unapproving a pull request removes your approval, which you can add again.

IDs are opaque strings. Options accept `--name value` and `--name=value`, and `--` ends options. `--parent-id` is converted to the JSON integer required by comment replies and must be a positive safe integer. Slash-containing branch names are encoded as one path component. A text beginning with `@` is literal content, never an implicit file read. Unknown commands, options, extra arguments, invalid values, and conflicting options fail with exit code 2 before any request.

Pull request create needs `title` and `source.branch.name`, supplied through `--title` and `--source` or a complete JSON file. Omitted destination uses the provider's main branch. Update sends only supplied fields. `--reviewer UUID` is repeatable and replaces the reviewer list. `--clear-reviewers` sends `[]`; `--clear-description` sends `""`. A JSON file can explicitly use these values too. Nulls fail validation. `--body-file` reads literal description, comment, or merge-message content. An empty description file supplies an empty description. `--file` conflicts with every field flag, but can be combined with target options such as `--repository`.

Supported pull request file keys are `title`, `description`, `destination`, `reviewers`, `close_source_branch`, and `draft`; create also accepts `source`. A source contains `branch: {"name":"..."}` and optionally `repository: {"full_name":"WORKSPACE/REPO_SLUG"}` for a fork. A destination contains `branch: {"name":"..."}`. Reviewers are objects with `uuid`. Unknown fields fail. Use raw API access for provider fields outside this validated input schema.

Pipeline files accept `target` and `variables`. Targets use `pipeline_ref_target` with `ref_type` (`branch` or `tag`) and `ref_name`, or `pipeline_commit_target` with `commit.hash`. A ref target can also pin `commit.hash`. An optional selector has `type: "custom"` and `pattern`. Variables require `key`, string `value`, and an explicit boolean `secured`. Keys must be unique, contain only letters, digits, and underscores, and not start with a digit. `pipelines run` and raw API writes redact secured values in previews, diagnostics, and provider errors.

```json
{
  "target": {
    "type": "pipeline_ref_target",
    "ref_type": "branch",
    "ref_name": "main",
    "selector": {"type": "custom", "pattern": "release"}
  },
  "variables": [{"key": "RELEASE_CHANNEL", "value": "preview", "secured": false}]
}
```

## Pagination

Paginated lists fetch one page by default. `pull-requests list` accepts `--page-size N` from 10 to 50, default 50. Other paginated lists accept 10 to 100, default 100. Out-of-range values fail before requests. `--all` follows complete next URLs, and `--cursor URL` resumes a previous `meta.next_cursor`. The CLI preserves each URL's path and query entries and rejects another origin, credentials, fragments, whitespace, or backslashes. Origin validation includes scheme and port and runs even when only one page is requested. An explicit continuation `pagelen` must stay within the endpoint's limits. When it is absent, the CLI follows the URL unchanged and uses the endpoint maximum as an upper bound for page validation and the remaining `--max-items` budget. It does not assume that an opaque continuation uses a particular default page size.

`--max-items N` requires `--all` and stops at a resumable page boundary. Continuation URLs keep their embedded page size, even if `--page-size` changes. If the next page exceeds the remaining budget, the CLI returns its cursor without reading it. The result can contain fewer than N items, including none. An initial budget below 10 returns an initial cursor without a request. For example, a page size of 10 and a bound of 25 can return 20 items, with the cursor for the next 10-item page.

Paginated lists retain provider order. Branch lists use lexical name order unless `--sort` is supplied; commits use reverse chronological order with descendants before parents. Other ordering is provider-defined. A server may return fewer than the requested number. `meta.has_more` reports remaining pages. Repeated cursors, empty pages with a continuation, oversized pages, and invalid continuation URLs fail. A failure after completed pages returns `PARTIAL_FAILURE` with those items in `partial.data` and the first unread cursor in `partial.next_cursor`.

Sensitive values in continuation URLs are hidden in diagnostics, error messages, and hints. Structured `next_cursor` values stay unchanged for resumption and can contain provider tokens; treat them as sensitive result data.

`pull-requests list --all` returns every page for the selected filters. Duplicate PR IDs within or across pages fail instead of returning overlapping or repeated rows. Without `--state`, Bitbucket returns open PRs. Repeat `--state` to select any combination of `OPEN`, `MERGED`, `DECLINED`, and `SUPERSEDED`. `--query EXPRESSION` sends a BBQL expression as `q`. Repository and branch lists use `--filter`.

Repeat `--ticket KEY` to match any requested ticket. Matching is case sensitive. The source branch must equal the key or start with the key followed by a hyphen, or the title must contain the key as a whole token. Unicode letters, combining marks, numbers, and underscores adjoining a key prevent a title token match. A ticket prefilter uses `source.branch.name ~ "KEY" OR title ~ "KEY"`; several keys are joined with `OR`, and `--query` is combined with that prefilter using `AND`. Exact matching runs locally after pagination, so near matches cannot hide later pages. Each returned PR gains `ticket_keys`, a sorted, unique array of all Jira-style keys in its title and source branch, including keys outside the requested filter.

With `--ticket`, `--max-items`, `--page-size`, and `meta.provider.size` count server candidates before exact matching. A page can produce no matching PRs and still have `meta.has_more: true`. Resume with the same ticket filters. Keys match `[A-Z][A-Z0-9]+-[0-9]+` as whole tokens, so `PROJ-12` does not match `PROJ-123`.

```bash
bitbucket pull-requests list --repository acme/service --state OPEN --state MERGED --state DECLINED --state SUPERSEDED --all --format json
bitbucket pull-requests list --repository acme/service --ticket PROJ-12 --ticket APP-34 --all --format json
bitbucket pull-requests list --repository acme/service --ticket PROJ-12 --query 'destination.branch.name = "main"' --all --format json
```

`pull-requests conflicts list PULL_REQUEST_ID` fetches every page automatically and returns `data: {"has_conflicts": BOOLEAN, "conflicts": [...]}`. Each conflict retains its provider fields, including `path`, `scenario`, and `message` when supplied. The command uses the documented [PR file-conflicts endpoint](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-conflicts-get), which redirects to [repository file conflicts](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-commits/#api-repositories-workspace-repo-slug-file-conflicts-spec-get). This reports conflict paths directly, avoiding interpretation of diffstat statuses such as `merge conflict`, `local deleted`, or `remote deleted`. It follows up to three redirects on the configured origin per request. The result reflects Bitbucket's view at the time of the call. A clean result does not guarantee mergeability because permissions, merge checks, and later branch changes can still block merging.

`pull-requests ticket-keys list PULL_REQUEST_ID` fetches every page of the PR's commits, which are the commits not on its destination, and extracts keys from their complete messages. It returns `[{"key": "PROJ-12", "commit_hashes": ["..."]}]`. Keys and hashes use lexicographic order with duplicates removed. Repeat `--project PROJ` to keep exact project prefixes; omitted means every project. Bitbucket returns no commits if the source branch no longer exists, so an empty result does not prove there were no ticket references before branch deletion.

Both derived lists request 100 items per page internally and accept no pagination flags. Duplicate conflict paths or commit hashes within or across pages fail instead of producing a successful result from repeated source rows. On success, `meta.next_cursor` is `null` and `meta.has_more` is `false`. If a later page fails, the command exits 8. `partial.data` contains the conflict or commit objects already read, and `partial.next_cursor` identifies the failed source page. For ticket extraction, those commits are incomplete input, not the final key list. Run the command again to rebuild the complete result.

`commits list --include REF --exclude REF --all` lists commits reachable from included refs but not from excluded refs. Both options are repeatable. Omitted `--include` means all refs; the CLI does not assume a destination branch.

```bash
bitbucket pull-requests conflicts list 42 --repository acme/service --format json
bitbucket pull-requests ticket-keys list 42 --repository acme/service --project PROJ --project APP --format json
bitbucket commits list --repository acme/service --include feature/PROJ-12 --exclude main --all --format json
```

## Raw API access

```bash
bitbucket api request GET /repositories/acme/service --format json
bitbucket api request GET /repositories/acme/service/pullrequests --query state=OPEN --query pagelen=20
```

Methods: `GET`, `HEAD`, `OPTIONS`, `POST`, `PUT`, `PATCH`, and `DELETE`. `PATH` starts with a single `/` and has no scheme, host, query string, fragment, whitespace, or `.` and `..` segments. Add query parameters with repeatable `--query KEY=VALUE`. Paths are relative to the base URL prefix, normally `/2.0`; do not repeat that prefix. The selected profile supplies HTTP Basic authentication.

`GET`, `HEAD`, and `OPTIONS` reject `--file`, `--yes`, and `--dry-run`. Other methods require write access and confirmation. `--file PATH` supplies a JSON body, and `--dry-run` prints a redacted preview without sending a request. Objects with `secured: true` have their `value` hidden in previews at any depth; those values are also scrubbed from errors and diagnostics. The transmitted body retains the original values. Other input stays raw and does not use the resource commands' field validation.

```bash
bitbucket api request POST /repositories/acme/service/pipelines --file ./pipeline.json --dry-run
bitbucket api request POST /repositories/acme/service/pipelines --file ./pipeline.json --yes
```

JSON responses print as parsed, other text prints as a JSON string, an empty body prints `null`, and binary responses fail with `UNSUPPORTED_RESPONSE`. Non-2xx responses use the same error mapping as resource commands. A failure inside an HTTP 2xx body prints to stdout with credentials and declared secrets scrubbed, then reports the error on stderr and exits with the mapped code. Raw API requests reject redirects.

`pull-requests diff get` and `pipelines logs get` return text in the ordinary data/meta envelope. These reads follow up to three redirects on the configured origin, including relative Locations. A foreign origin, credentials, fragment, loop, or longer redirect chain fails with `INVALID_RESPONSE`. Each attempt shares one timeout across all hops and the response body. Empty text responses return an empty string. Unexpected JSON fails with `INVALID_RESPONSE` and includes the HTTP status and request ID when supplied. Binary responses fail with `UNSUPPORTED_RESPONSE`.

## Configuration

Files live in `$XDG_CONFIG_HOME/bitbucket` when `XDG_CONFIG_HOME` is an absolute path, and in `~/.config/bitbucket` otherwise.

```text
bitbucket/
  config.json            {"activeProfile": "work"}
  profiles/NAME.json     {"email": "developer@example.com", "apiToken": "...", "baseUrl": "https://...", "access": "read", "workspace": "acme"}
```

Keys are camelCase. Files use mode `0600`, directories use mode `0700`, and writes are atomic: the CLI creates a temporary file exclusively with mode `0600` in the same directory, then renames it. Reads reject unknown keys and non-object JSON with `CONFIGURATION_ERROR`. Profile names match `^[A-Za-z0-9._-]+$` and are not `.` or `..`. `config.json` holds one key, `activeProfile` (read-only through `config`; change it with `profiles use`). Credentials and endpoint settings live only in profile files, and a `config.json` with any other key fails with `CONFIGURATION_ERROR`. Profile fields: `email`, `apiToken`, `baseUrl`, `access` (`read` or `write`), and `workspace`. A profile without `access`, such as one written by hand, can read, and its mutations fail with `CONFIGURATION_ERROR` until `profiles update NAME --access read|write` sets it. Secrets are redacted in previews, diagnostics, `profiles get`, and `config list`. Use `profiles update NAME --clear-workspace` to remove the workspace default.

A base URL, from `--base-url` or a stored file, must be an `https` URL (`http` only for `localhost`, `127.0.0.1`, or `::1`) with no credentials, query string, or fragment. It may carry a path, and requests go to the base URL plus the resource path. Values are stored unchanged.

Completion scripts come from `bitbucket completions bash|zsh|fish` and read only the command registry and local profile names. They complete commands, options, enum values (after `--OPT ` and `--OPT=`), `METHOD`, `SHELL`, and profile names (after `--profile` and for the `NAME` argument of `profiles get|update|delete|use`). They offer nothing after `--` or after an option that takes a free-form value.

## Exceptions

| Rule | Decision | Reason |
| --- | --- | --- |
| `CLI-GRAM-4` | Pull request `merge`, `decline`, `approve`, `unapprove`; pipeline `run`, `stop`. | These retain provider operation names. |
| `STYLE-OUT-2` | Merge responses include HTTP status, asynchronous task metadata, and reconciliation notes in `meta.provider`. | The final PR alone does not identify the task or explain a skipped or reconciled POST. |
| `STYLE-ERR-3` | An uncertain merge POST followed by a PR read returning `OPEN` reports the original failure as retryable. | Another invocation rechecks state before sending its single merge POST. |
| `STYLE-PAGE-2` | Continuations keep their page size; bounds can return fewer than N items. | Changing the page length of a numbered URL would skip or duplicate items. |
| `STYLE-TIME-1` | Diff, step-log, and conflict reads follow up to three redirects on the configured origin. | These endpoints can redirect to their resource. Every hop shares the attempt timeout. |
| `STYLE-OPT-6` | `--page-size` accepts 10 to 50 for PR lists, and 10 to 100 for other paginated lists. | The provider's pagination reference specifies a global minimum of 10; PR lists have a lower maximum. |

## Development

```bash
bun run build
bun run check
bun link
```

`src/core/` is vendored from cli-core and is never edited here. Change cli-core and run its sync script instead. `docs/cli-conventions.md` restates the command-line contract this tool follows.

## API references

- [Bitbucket Cloud REST API](https://developer.atlassian.com/cloud/bitbucket/rest/)
- [Create an API token](https://support.atlassian.com/bitbucket-cloud/docs/create-an-api-token/)
- [API token permissions](https://support.atlassian.com/bitbucket-cloud/docs/api-token-permissions/)
- [Workspaces](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-workspaces/)
- [Repositories](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/)
- [Branches and tags](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-refs/)
- [Commits](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-commits/)
- [Pull requests](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/)
- [Asynchronous merge responses](https://community.developer.atlassian.com/t/example-of-response-when-a-merge-request-is-pending-status-code-202/72427)
- [Pipelines](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pipelines/)
- [Pipeline variables and secrets](https://support.atlassian.com/bitbucket-cloud/docs/variables-and-secrets/)
- [Deployments and environments](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-deployments/)
