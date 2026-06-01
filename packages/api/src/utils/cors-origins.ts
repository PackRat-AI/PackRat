/**
 * Origins allowed to make cross-origin (credentialed) requests to the API.
 *
 * Kept in a standalone module so the matching logic is unit-testable without
 * constructing the full Elysia worker app.
 */

export const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?packrat\.world$/,
  /^https:\/\/[\w-]+\.packrat\.world$/,
  /^https:\/\/[\w-]+\.packratai\.com$/,
  /^https?:\/\/[\w-]+\.workers\.dev$/,
  /^http:\/\/localhost:\d+$/,
  // portless local-dev proxy: https://<worktree>.<app>.localhost[:port]
  /^https:\/\/[\w.-]+\.localhost(:\d+)?$/,
  /^exp:\/\//,
];

export function isAllowedOrigin(origin: string | null): origin is string {
  return !!origin && ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}
