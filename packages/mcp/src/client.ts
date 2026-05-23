/**
 * MCP API client layer — Eden Treaty based.
 *
 * Two typed clients are exposed:
 *
 *  - `user`: authenticated as the OAuth-signed-in PackRat user via the Better
 *    Auth bearer that OAuthProvider injects into each request.
 *  - `admin`: authenticated with the *same* Better Auth bearer. The API
 *    enforces admin access via `user.role === 'ADMIN'` on its
 *    `adminAuthGuard` (extended in U5 to accept Better Auth bearers in
 *    addition to the legacy HS256 admin JWT). Visibility of admin tools on
 *    the MCP surface is gated by the `mcp:admin` OAuth scope, which is only
 *    granted to admin users at `/callback` time.
 *
 * Tool files import these from `agent.api` and call the API with end-to-end
 * type safety. The `call()` helper converts Treaty's
 * `{ data, error, status }` response shape into MCP tool results and maps
 * 401/403 to actionable, ACL-aware error messages.
 *
 * U5 note: the dual-client shape is preserved so future tooling can swap
 * the admin client to a different token source without churning every
 * call site. Today both clients share the same token provider — see the
 * `createMcpClients` signature.
 */

import { type ApiClient, createApiClient } from '@packrat/api-client';
import { isObject, isString } from '@packrat/guards';

export type TokenProvider = () => string | null | undefined;

export type McpClients = {
  /** Calls authenticated as the OAuth-signed-in PackRat user. */
  user: ApiClient;
  /**
   * Calls to admin routes, authenticated with the same Better Auth bearer
   * as the `user` client. The API-side `adminAuthGuard` (extended in U5)
   * accepts a Better Auth session whose `user.role === 'ADMIN'`.
   */
  admin: ApiClient;
};

/**
 * Build user and admin Eden Treaty clients sharing a single base URL.
 *
 * Both clients use the Better Auth bearer that the OAuth provider
 * (or a manual `Authorization` header) injected into the current request.
 * The API enforces admin access on the `admin` routes via the user's role,
 * not via a separate token type.
 *
 * Refresh/reauth hooks are no-ops here: the MCP transport does not own session
 * lifecycle (the OAuth layer / caller does), so on 401 we surface the error
 * to the tool rather than attempting a refresh.
 */
export function createMcpClients(opts: {
  baseUrl: string;
  getUserToken: TokenProvider;
}): McpClients {
  return {
    user: createApiClient({ baseUrl: opts.baseUrl, auth: noopHooks(opts.getUserToken) }),
    admin: createApiClient({ baseUrl: opts.baseUrl, auth: noopHooks(opts.getUserToken) }),
  };
}

function noopHooks(getToken: TokenProvider) {
  return {
    getAccessToken: () => getToken() ?? null,
    getRefreshToken: () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: () => {},
  };
}

// ── MCP tool result helpers ───────────────────────────────────────────────────

export type McpToolResult = {
  content: [{ type: 'text'; text: string }];
  isError?: true;
};

export function ok(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function errMessage(message: string): McpToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

/**
 * Treaty response shape used by `call()`. Defined structurally so we don't
 * have to import internal Eden types.
 */
export type TreatyResponse<T> = {
  data: T | null;
  error: { status: number; value: unknown } | null;
  status: number;
};

export type CallOptions = {
  /** Verb-phrase shown in error messages, e.g. "list packs". */
  action?: string;
  /** Optional resource hint for ACL errors, e.g. `pack p_abc123`. */
  resourceHint?: string;
  /** Marks this call as admin-only; refines 401/403 messaging. */
  requiresAdmin?: boolean;
};

/**
 * Await a Treaty promise and convert the result into an MCP tool result.
 * Thrown errors and `{ error: ... }` responses both surface as `isError: true`.
 */
export async function call<T>(
  promise: Promise<TreatyResponse<T>>,
  options: CallOptions = {},
): Promise<McpToolResult> {
  try {
    const result = await promise;
    if (result.error || result.data == null) {
      return formatError({ status: result.status, body: result.error?.value, opts: options });
    }
    return ok(result.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return errMessage(`${options.action ?? 'request'} failed: ${message}`);
  }
}

function formatError(args: { status: number; body: unknown; opts: CallOptions }): McpToolResult {
  const { status, body, opts } = args;
  const action = opts.action ?? 'request';
  const resource = opts.resourceHint ? ` (${opts.resourceHint})` : '';
  const detail = extractErrorMessage(body);
  const suffix = detail ? ` — ${detail}` : '';

  if (status === 401) {
    if (opts.requiresAdmin) {
      // U5: the MCP admin tools are gated by the `mcp:admin` OAuth scope.
      // A 401 from the API on an admin route means the bearer wasn't
      // recognized at all (not a scope/role rejection — that's 403).
      return errMessage(
        `Admin authentication required to ${action}${resource}. Sign in with an admin PackRat ` +
          `account and re-authorize this MCP client with the mcp:admin scope.${suffix}`,
      );
    }
    return errMessage(
      `Authentication required to ${action}${resource}. Sign in via OAuth or refresh your ` +
        `MCP session.${suffix}`,
    );
  }
  if (status === 403) {
    if (opts.requiresAdmin) {
      return errMessage(
        `Forbidden: this operation is admin-only (${action}${resource}). Your token does not ` +
          `carry the admin role.${suffix}`,
      );
    }
    return errMessage(
      `Forbidden: you don't own this resource (${action}${resource}), or the API rejected ` +
        `access. Soft-deleted or other-user resources are not visible.${suffix}`,
    );
  }
  if (status === 404) {
    return errMessage(`Not found: ${action}${resource} returned 404.${suffix}`);
  }
  if (status === 409) {
    return errMessage(`Conflict on ${action}${resource}.${suffix}`);
  }
  if (status === 422) {
    return errMessage(`Validation failed on ${action}${resource}.${suffix}`);
  }
  if (status === 429) {
    return errMessage(`Rate limited on ${action}${resource}. Try again shortly.${suffix}`);
  }
  return errMessage(`${action}${resource} failed (HTTP ${status})${suffix}`);
}

function extractErrorMessage(body: unknown): string | null {
  if (body == null) return null;
  if (isString(body)) return body;
  if (isObject(body)) {
    const obj = body as Record<string, unknown>; // safe-cast: isObject() guard above narrows body
    if (isString(obj.message)) return obj.message;
    if (isString(obj.error)) return obj.error;
    try {
      return JSON.stringify(body);
    } catch {
      return null;
    }
  }
  return String(body);
}

// ── ID helpers (replicated here so tool files don't need their own RNG) ───────

const STRIP_HYPHENS_RE = /-/g;

/** Generate a short ID prefixed for stable client-side creation. */
export function shortId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(STRIP_HYPHENS_RE, '').slice(0, 12)}`;
}

/** ISO 8601 timestamp for `localCreatedAt` / `localUpdatedAt` fields. */
export function nowIso(): string {
  return new Date().toISOString();
}
