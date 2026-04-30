/** Worker HTTP endpoint paths */
export const WorkerRoute = {
  Root: '/',
  Health: '/health',
  Mcp: '/mcp',
} as const;

/** Service identification metadata */
export const ServiceMeta = {
  Name: 'packrat-mcp',
  Version: '1.0.0',
  Transport: 'streamable-http',
} as const;
