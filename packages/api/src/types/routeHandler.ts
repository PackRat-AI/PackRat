import type { RouteConfig, RouteHandler as HonoZodOpenApiRouteHandler } from '@hono/zod-openapi';
import type { Env } from './env';

export type RouteHandler<T extends RouteConfig> = HonoZodOpenApiRouteHandler<T, { Bindings: Env }>;
