/**
 * MCP API client layer — Eden Treaty based.
 *
 * Two typed clients are exposed:
 *
 *  - `user`: authenticated as the OAuth-signed-in PackRat user via the Better
 *    Auth bearer that OAuthProvider injects into each request.
 *  - `admin`: authenticated as a PackRat admin via the short-lived admin JWT
 *    issued by `POST /api/admin/token` (or by passing an env-provided token).
 *
 * Tool files import these from `agent.api` and call the API with end-to-end
 * type safety. The `call()` helper converts Treaty's
 * `{ data, error, status }` response shape into MCP tool results and maps
 * 401/403 to actionable, ACL-aware error messages.
 */

import { type ApiClient, createApiClient } from '@packrat/api-client';
import { isObject, isString } from '@packrat/guards';

export type TokenProvider = () => string | null | undefined;

export type McpClients = {
  /** Calls authenticated as the OAuth-signed-in PackRat user. */
  user: ApiClient;
  /** Calls authenticated with a PackRat admin JWT. */
  admin: ApiClient;
};

/**
 * Build user and admin Eden Treaty clients sharing a single base URL.
 *
 * The user client uses the Better Auth bearer that the OAuth provider
 * (or a manual `Authorization` header) injected into the current request.
 * The admin client uses the short-lived admin JWT minted by
 * `POST /api/admin/token`.
 *
 * Refresh/reauth hooks are no-ops here: the MCP transport does not own session
 * lifecycle (the OAuth layer / caller does), so on 401 we surface the error
 * to the tool rather than attempting a refresh.
 */
export function createMcpClients(opts: {
  baseUrl: string;
  getUserToken: TokenProvider;
  getAdminToken: TokenProvider;
}): McpClients {
  return {
    user: createApiClient({ baseUrl: opts.baseUrl, auth: noopHooks(opts.getUserToken) }),
    admin: createApiClient({ baseUrl: opts.baseUrl, auth: noopHooks(opts.getAdminToken) }),
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
  structuredContent?: Record<string, unknown>;
  isError?: true;
};

export function ok(data: unknown): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

export function okStructured({
  data,
  structuredContent,
}: {
  data: unknown;
  structuredContent: Record<string, unknown>;
}): McpToolResult {
  return { ...ok(data), structuredContent };
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
  args: {
    promise: Promise<TreatyResponse<T>>;
    onSuccess?: (data: T) => McpToolResult;
  } & CallOptions,
): Promise<McpToolResult> {
  const { promise, onSuccess, ...options } = args;
  try {
    const result = await promise;
    if (result.error || result.data == null) {
      return formatError({ status: result.status, body: result.error?.value, opts: options });
    }
    return onSuccess?.(result.data) ?? ok(result.data);
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
      return errMessage(
        `Admin authentication required to ${action}${resource}. Call admin_login first, ` +
          `or provide an admin JWT via the X-PackRat-Admin-Token header.${suffix}`,
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
