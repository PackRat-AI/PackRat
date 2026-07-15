/**
 * Pure request/response helpers for the MCP Worker entrypoint.
 *
 * Kept in their own module so unit tests can import them without pulling in
 * `agents/mcp` (which uses the `cloudflare:workers` scheme and breaks
 * Node-native vitest runs) — the same reason `cors.ts` lives apart from
 * `index.ts`. `index.ts` re-imports these; the tests target this module.
 */

/** Matches an `Authorization: Bearer <token>` header, capturing the token. */
export const BEARER_REGEX = /^Bearer\s+(\S+)/i;

/** Bound the Authorization header we even bother to inspect — Workers caps
 *  this around 8 KiB but 4 KiB is plenty for any JWT we expect. */
export const MAX_BEARER_HEADER_LEN = 4096;

/**
 * Extract the bearer token from an `Authorization` header value.
 *
 * Returns `null` if the header is missing, doesn't use the Bearer scheme,
 * the token slot is empty, or the value exceeds `MAX_BEARER_HEADER_LEN`.
 * Length-cap defense is symmetric with the deleted DCR gate helper —
 * neither verifier nor outer wrapper should pay JWKS-fetch cost on a
 * pathological header.
 */
export function extractBearer(headerValue: string | null): string | null {
  if (!headerValue) return null;
  if (headerValue.length > MAX_BEARER_HEADER_LEN) return null;
  const match = BEARER_REGEX.exec(headerValue);
  if (!match) return null;
  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Annotate an outbound response with `X-Correlation-Id: <id>`.
 *
 * Returns a new Response wrapping the same body — Response headers are
 * immutable once the response is consumed, so we always clone via the
 * `new Response(body, init)` shape. The body is streamed through
 * unchanged (no buffering). Idempotent: if the header is already present
 * the original response is returned untouched.
 */
export function withCorrelationHeader({
  response,
  correlationId,
}: {
  response: Response;
  correlationId: string;
}): Response {
  if (response.headers.has('X-Correlation-Id')) return response;
  const annotated = new Response(response.body, response);
  annotated.headers.set('X-Correlation-Id', correlationId);
  return annotated;
}
