import { defineOpenAPIRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import * as getCategoriesRoute from './getCategoriesRoute';
import * as getGuideRoute from './getGuideRoute';
import * as getGuidesRoute from './getGuidesRoute';
import * as searchGuidesRoute from './searchGuidesRoute';

const guidesOpenApiRoutes = [
  defineOpenAPIRoute({
    route: getGuidesRoute.routeDefinition,
    handler: getGuidesRoute.handler,
  }),
  defineOpenAPIRoute({
    route: getCategoriesRoute.routeDefinition,
    handler: getCategoriesRoute.handler,
  }),
  defineOpenAPIRoute({
    route: searchGuidesRoute.routeDefinition,
    handler: searchGuidesRoute.handler,
  }),
  defineOpenAPIRoute({
    route: getGuideRoute.routeDefinition,
    handler: getGuideRoute.handler,
  }),
] as const;

const guidesRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>().openapiRoutes(
  guidesOpenApiRoutes,
);

export { guidesRoutes };
