import { CliError } from "./core/errors.js";
import type { HookHelpers, Provider, ProviderErrorDetail } from "./core/provider.js";
import { HTTP_METHODS } from "./core/types.js";
import { isRecord, visibleAsciiConstraint } from "./core/values.js";
import { commands, groups, pagination, securedInput, workspaceConstraint } from "./registry.js";

export const provider: Provider = {
  bin: "bitbucket",
  name: "Bitbucket Cloud",
  secrets: [
    {
      key: "email",
      label: "Atlassian account email",
      secret: false,
      placeholder: "EMAIL",
      example: "developer@example.com",
      validate: (value) => /^[^\s:@\u0000-\u001f\u007f]+@[^\s:@\u0000-\u001f\u007f]+$/.test(value)
        ? undefined : "be an account email with no whitespace, colons, or control characters",
    },
    { key: "apiToken", label: "API token", validate: visibleAsciiConstraint },
  ],
  authScheme: "HTTP Basic authentication with the Atlassian account email and scoped API token",
  authorize: (credential) => ({
    Authorization: `Basic ${Buffer.from(`${credential.email}:${credential.apiToken}`).toString("base64")}`,
  }),
  secretValues: (credential) => [Buffer.from(`${credential.email}:${credential.apiToken}`).toString("base64")],
  baseUrl: { default: "https://api.bitbucket.org/2.0", allowPath: true, joinPath: true },
  endpointFields: [{ key: "workspace", label: "workspace", placeholder: "SLUG", example: "acme", validate: workspaceConstraint }],
  accessLevels: true,
  pagination,
  requestIdHeader: ["x-request-id", "atl-traceid", "x-b3-traceid"],
  errorDetail,
  bodyFailure: (body) => isRecord(body) && body.type === "error" ? errorDetail(body) : undefined,
  verify: {
    method: "GET",
    path: "/user",
    query: [],
    effect: "Sends GET /user. Success identifies the account and proves acceptance of the email and API token for this check only. identity.scopes contains x-oauth-scopes when returned, or null. It does not prove complete permission coverage.",
    identity,
  },
  api: {
    methods: HTTP_METHODS,
    sensitiveInput: ({ body }) => securedInput(body),
    examples: [
      "bitbucket api request GET /repositories/acme/service --format json",
      "bitbucket api request GET /repositories/acme/service/pullrequests --query state=OPEN --query pagelen=20",
      "bitbucket api request POST /repositories/acme/service/pipelines --file ./pipeline.json --dry-run",
    ],
  },
  groups,
  commands,
};

function errorDetail(body: unknown): ProviderErrorDetail {
  if (!isRecord(body) || !isRecord(body.error)) return {};
  const error = body.error;
  const parts = [error.message, error.detail].filter((value): value is string => typeof value === "string" && value !== "");
  if (isRecord(error.fields)) {
    for (const [field, value] of Object.entries(error.fields)) {
      const messages = (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === "string" && item !== "");
      for (const message of messages) parts.push(`${field}: ${message}`);
    }
  }
  return {
    ...(parts.length ? { message: parts.join(": ") } : {}),
    ...(typeof error.code === "string" || typeof error.code === "number" ? { code: error.code } : {}),
    ...(typeof error.id === "string" ? { requestId: error.id } : {}),
  };
}

function identity(data: unknown, helpers: HookHelpers): unknown {
  if (!isRecord(data) || typeof data.uuid !== "string" || data.uuid === "") {
    throw new CliError("INVALID_RESPONSE", 'Bitbucket Cloud response must contain a nonempty "uuid" for auth verify.', {
      hint: "Retry later. If the failure persists, the Bitbucket Cloud API contract may have changed.",
      provider: helpers.provider,
    });
  }
  const header = helpers.header("x-oauth-scopes");
  return { ...data, scopes: header === undefined ? null : header.split(/[,\s]+/).filter(Boolean) };
}
