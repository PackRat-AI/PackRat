import type { RouteHandler as HonoZodOpenApiRouteHandler, RouteConfig } from '@hono/zod-openapi';
import type { Env } from './env';
import type { Variables } from './variables';

export type RouteHandler<T extends RouteConfig> = HonoZodOpenApiRouteHandler<
  T,
  { Bindings: Env; Variables: Variables }
>;
