/**
 * MCP API client layer — Eden Treaty based.
 *
 * Two typed clients are exposed:
 *
 *  - `user`: authenticated as the JWT-bearing PackRat user via the access
 *    token the outer fetch wrapper verified and forwarded into the DO
 *    (`Props.betterAuthToken`).
 *  - `admin`: authenticated with the *same* JWT. The API enforces admin
 *    access via `user.role === 'ADMIN'` on its `adminAuthGuard` (extended
 *    in U5 to accept Better Auth bearers in addition to the legacy HS256
 *    admin JWT). Visibility of admin tools on the MCP surface is gated
 *    by the `mcp:admin` scope claim on the JWT.
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
 *
 * U8 output-envelope contract:
 *
 *  - `ok(data, { structured })` returns both a text-content JSON fallback
 *    AND a `structuredContent` field (MCP spec 2025-06-18) when a tool
 *    has registered an `outputSchema`. Callers without a schema keep the
 *    text-only shape for backwards compatibility.
 *  - `errResponse(code, message, retryable)` is the canonical recoverable
 *    failure envelope. It returns `{ isError: true, content: [...],
 *    structuredContent: { error: { code, message, retryable } } }` so
 *    Claude can reason about a failure structurally instead of having to
 *    parse the text. `errMessage()` remains as a thin wrapper that uses
 *    the generic `tool_error` code.
 *  - `call()` converts API errors to structured `errResponse`s:
 *    network/throw → `network_error` (retryable=true); 401 → `unauthorized`;
 *    403 → `forbidden`; 404 → `not_found`; 409 → `conflict`; 422 →
 *    `validation_error`; 429 → `rate_limited` (retryable=true); 5xx →
 *    `api_error` (retryable=true); other → `api_error`. Protocol-level
 *    violations (bad args, unknown tool) are reserved for the SDK to
 *    surface as JSON-RPC errors; `call()` never throws when invoked.
 *  - Every `ok()` response runs through `truncateForResponse` to keep the
 *    serialized payload under Anthropic's 150 000-char client-side cap
 *    (per the Building Connectors docs). When truncation triggers we drop
 *    `structuredContent` (it would be unparseable) and surface the
 *    truncated text in the content block with a clear marker. Truncation
 *    is intentionally **not** flagged as `isError: true` — it's a
 *    response-shaping concern, not a failure.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type ApiClient, createApiClient } from '@packrat/api-client';
import { isNumber, isObject, isString } from '@packrat/guards';

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
 * Both clients use the JWT access token the outer fetch wrapper verified
 * and stored on `Props.betterAuthToken` (forwarded into the DO via
 * `ctx.props` and surfaced on `this.props`). The API enforces admin
 * access on the `admin` routes via the user's role, not via a separate
 * token type.
 *
 * Refresh/reauth hooks are no-ops here: the MCP transport does not own
 * session lifecycle (the API worker / caller does), so on 401 we surface
 * the error to the tool rather than attempting a refresh.
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

/**
 * MCP tool-result envelope.
 *
 * Modeled after the MCP 2025-06-18 tool spec: every result carries a text
 * content block (for clients that haven't adopted `structuredContent`); a
 * tool with an `outputSchema` additionally emits `structuredContent` so
 * structured consumers don't have to parse the text. The `isError` field
 * signals recoverable failures.
 */
export type McpToolResult = {
  // Narrow to the single text-content block we actually emit (not the SDK's
  // full `ContentBlock` union), so internal readers can access `.content[0].text`
  // directly. A narrow-element array is still assignable to the SDK's
  // `CallToolResult['content']` (`ContentBlock[]`), so tool handlers type-check.
  content: { type: 'text'; text: string }[];
  isError?: boolean;
  /** Present when the tool declared an `outputSchema` and the payload fits. */
  structuredContent?: CallToolResult['structuredContent'];
};

/**
 * Anthropic's published response-size cap for Claude.ai / Claude Desktop
 * tool results, per the Building Connectors docs (section A14 of the
 * connector-store readiness plan). Tool payloads larger than this risk
 * being truncated by the client; we truncate server-side so we control
 * the marker text and don't waste bandwidth.
 */
export const RESPONSE_SIZE_LIMIT_CHARS = 150_000;

const TRUNCATION_MARKER = '\n[truncated: response exceeded 150k chars]';

/**
 * Trim a JSON-stringified payload to fit under `RESPONSE_SIZE_LIMIT_CHARS`.
 * Returns the original data unchanged if it fits, otherwise the truncated
 * JSON string (which the caller can surface as plain text). When truncation
 * triggers, `structuredContent` should be dropped — the truncated string is
 * no longer valid JSON, so feeding it through a schema validator would
 * report a spurious failure.
 */
function truncateForResponse<T>(data: T): { json: string; truncated: boolean } {
  const pretty = JSON.stringify(data, null, 2);
  if (pretty.length <= RESPONSE_SIZE_LIMIT_CHARS) {
    return { json: pretty, truncated: false };
  }
  const room = RESPONSE_SIZE_LIMIT_CHARS - TRUNCATION_MARKER.length;
  return { json: pretty.slice(0, room) + TRUNCATION_MARKER, truncated: true };
}

export type OkOptions = {
  /**
   * Emit a `structuredContent` field alongside the text fallback. Only set
   * this when the tool registered an `outputSchema` — the SDK validates
   * `structuredContent` against the schema before sending, so emitting
   * structured output without a schema is harmless but emitting a payload
   * that doesn't match the declared schema throws at runtime.
   */
  structured?: boolean;
};

/**
 * Success envelope.
 *
 * Always emits `content[0].text` as the pretty-printed JSON of `data`
 * (so clients without structured-output support still see the payload).
 * When `opts.structured === true` and the payload fits under the size cap,
 * additionally emits `structuredContent: data` for clients that can
 * consume it natively.
 */
export function ok<T>(data: T, opts?: OkOptions): McpToolResult {
  const { json, truncated } = truncateForResponse(data);
  const content: McpToolResult['content'] = [{ type: 'text', text: json }];
  // Truncation invalidates the JSON shape, so structured consumers would
  // fail to parse it. Drop structuredContent on truncation and let the
  // text content carry the (truncated) signal.
  if (opts?.structured && !truncated) {
    // safe-cast: the SDK types `structuredContent` as an object record; tools
    // that opt into structured output always return an object payload (their
    // declared `outputSchema` is an object schema), and there is no schema in
    // scope here to route through a @packrat/guards parser.
    return { content, structuredContent: data as Record<string, unknown> };
  }
  return { content };
}

/**
 * Canonical structured-error envelope.
 *
 * Returns `isError: true` so Claude treats this as a recoverable failure
 * (rather than a successful response that happens to describe an error
 * in its text), plus a `structuredContent.error` object that carries a
 * machine-readable `code`, the human-readable `message`, and a `retryable`
 * hint. The same `message` is mirrored into the text content block for
 * clients without structured-output support.
 *
 * Use this for *recoverable* failures (API 4xx/5xx, network errors,
 * tool-handler-detected bad state). Reserve `throw new Error(...)` for
 * protocol-level violations the SDK should surface as JSON-RPC errors
 * (e.g. unknown method, malformed params).
 */
// biome-ignore lint/complexity/useMaxParams: idiomatic error-helper signature (code, message, retryable); an options object would hurt readability at every formatError branch.
export function errResponse(code: string, message: string, retryable = false): McpToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
    structuredContent: { error: { code, message, retryable } },
  };
}

/**
 * Legacy thin wrapper that prefixes the message with `Error:` for
 * compatibility with the pre-U8 text-only shape, while still emitting the
 * structured error envelope. Prefer `errResponse(code, message, retryable)`
 * in new code so the `code` is meaningful.
 */
export function errMessage(message: string): McpToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: `Error: ${message}` }],
    structuredContent: { error: { code: 'tool_error', message, retryable: false } },
  };
}

/**
 * Treaty response shape used by `call()`. Defined structurally so we don't
 * have to import internal Eden types.
 */
export type TreatyResponse<T> = {
  data: T | null;
  // Eden types `error` as `unknown` whenever a route declares its error-status
  // responses as `z.any()` (which the API does to satisfy Elysia's response
  // invariance — error bodies carry extra fields like `code`). Accept `unknown`
  // here and narrow the `{ value }` envelope defensively in `call()`/`formatError`.
  error: unknown;
  status: number;
};

export type CallOptions = {
  /** Verb-phrase shown in error messages, e.g. "list packs". */
  action?: string;
  /** Optional resource hint for ACL errors, e.g. `pack p_abc123`. */
  resourceHint?: string;
  /** Marks this call as admin-only; refines 401/403 messaging. */
  requiresAdmin?: boolean;
  /**
   * Emit `structuredContent` on success. Set this on tools that declared
   * an `outputSchema` in `registerTool`. Falls back to text-only output
   * when not set.
   */
  structured?: boolean;
};

/**
 * Await a Treaty promise and convert the result into an MCP tool result.
 * Thrown errors and `{ error: ... }` responses both surface as `isError: true`
 * with a structured-error envelope; success paths emit `structuredContent`
 * when the caller opted in.
 */
export async function call<T>(
  args: { promise: Promise<TreatyResponse<T>> } & CallOptions,
): Promise<McpToolResult> {
  const { promise, ...options } = args;
  try {
    const result = await promise;
    if (result.error || result.data == null) {
      // Eden's error envelope is `{ status, value }` at runtime, but typed as
      // `unknown` (see TreatyResponse). Extract `value` when present.
      const e = result.error;
      const body = isObject(e) && 'value' in e ? e.value : e;
      return formatError({ status: result.status, body, opts: options });
    }
    return ok(result.data, { structured: options.structured });
  } catch (e) {
    // Network errors / thrown exceptions inside Treaty land here. These
    // are recoverable — they could succeed on retry — so we don't let
    // them escape as protocol violations.
    const message = e instanceof Error ? e.message : String(e);
    const action = options.action ?? 'request';
    return errResponse('network_error', `${action} failed: ${message}`, true);
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
      return errResponse(
        'unauthorized',
        `Admin authentication required to ${action}${resource}. Sign in with an admin PackRat ` +
          `account and re-authorize this MCP client with the mcp:admin scope.${suffix}`,
      );
    }
    return errResponse(
      'unauthorized',
      `Authentication required to ${action}${resource}. Sign in via OAuth or refresh your ` +
        `MCP session.${suffix}`,
    );
  }
  if (status === 403) {
    if (opts.requiresAdmin) {
      return errResponse(
        'forbidden',
        `Forbidden: this operation is admin-only (${action}${resource}). Your token does not ` +
          `carry the admin role.${suffix}`,
      );
    }
    return errResponse(
      'forbidden',
      `Forbidden: you don't own this resource (${action}${resource}), or the API rejected ` +
        `access. Soft-deleted or other-user resources are not visible.${suffix}`,
    );
  }
  if (status === 404) {
    return errResponse('not_found', `Not found: ${action}${resource} returned 404.${suffix}`);
  }
  if (status === 409) {
    return errResponse('conflict', `Conflict on ${action}${resource}.${suffix}`);
  }
  if (status === 422) {
    return errResponse('validation_error', `Validation failed on ${action}${resource}.${suffix}`);
  }
  if (status === 429) {
    return errResponse(
      'rate_limited',
      `Rate limited on ${action}${resource}. Try again shortly.${suffix}`,
      true,
    );
  }
  // 5xx and other non-success statuses are retryable: the request might
  // succeed on retry once the upstream stabilizes.
  const retryable = status >= 500 && status < 600;
  return errResponse(
    'api_error',
    `${action}${resource} failed (HTTP ${status})${suffix}`,
    retryable,
  );
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

// ── Pagination helpers (U8) ───────────────────────────────────────────────────

/**
 * Server-side maximum for `limit` on list-style tools. The user-supplied
 * `limit` is clamped to this silently; we do not error on `limit > MAX`
 * because the model often probes with `limit: 200` from a hint in the
 * schema. Clamping plus a `nextCursor`/`nextOffset` field steers the model
 * back into the paginated path naturally on the next turn.
 */
export const PAGINATION_LIMIT_MAX = 50;

/** Clamp a caller-supplied `limit` into `[1, PAGINATION_LIMIT_MAX]`. */
export function clampLimit(limit: number | undefined, fallback = PAGINATION_LIMIT_MAX): number {
  if (!isNumber(limit) || !Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(Math.floor(limit), PAGINATION_LIMIT_MAX);
}

/**
 * Compute the next-offset surface for a list response whose underlying
 * API doesn't support cursor pagination. Returns `null` when the
 * returned page is short (i.e. we've reached the end).
 *
 * The shape `{ data, nextOffset }` is what list-tool handlers wrap their
 * raw API responses in so the connector-store output envelope is
 * consistent across tools.
 */
export function withNextOffset<T>(args: { items: T[]; offset: number; limit: number }): {
  data: T[];
  nextOffset: number | null;
} {
  const { items, offset, limit } = args;
  // If the API returned a full page, there *might* be more; advertise
  // the next offset so the model can keep walking. If it returned fewer
  // than `limit`, we're at the end.
  const nextOffset = items.length >= limit ? offset + items.length : null;
  return { data: items, nextOffset };
}
