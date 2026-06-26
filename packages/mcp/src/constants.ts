/** Worker HTTP endpoint paths */
export const WorkerRoute = {
  Root: '/',
  Health: '/health',
  Status: '/status',
  Mcp: '/mcp',
  WellKnownProtectedResource: '/.well-known/oauth-protected-resource',
  Favicon: '/favicon.ico',
} as const;

/**
 * Service identification metadata.
 *
 * `Version` is the single source of truth for this Worker's reported version.
 * It is mirrored manually from `package.json` (kept in sync by the unit test
 * in `__tests__/constants.test.ts`). Centralizing it here lets `McpServer`,
 * the `/health` and `/status` endpoints, and any other surface report a
 * consistent string without four-way drift.
 */
export const ServiceMeta = {
  Name: 'packrat-mcp',
  /** MCP-server display name surfaced to clients. */
  McpServerName: 'packrat',
  Version: '2.0.28',
  Transport: 'streamable-http',
} as const;
