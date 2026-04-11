// Elysia-native exports
export { adminAuthPlugin, apiKeyAuthPlugin, authPlugin } from './auth';
export type { AuthUser } from './auth';

// Legacy Hono middleware exports kept during the staged migration.
export { authMiddleware } from './auth';
export { apiKeyAuthMiddleware } from './auth';
export { adminMiddleware } from './adminMiddleware';
