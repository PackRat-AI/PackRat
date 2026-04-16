import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import * as getCategoriesRoute from './getCategoriesRoute';
import * as getGuideRoute from './getGuideRoute';
import * as getGuidesRoute from './getGuidesRoute';
import * as searchGuidesRoute from './searchGuidesRoute';

const guidesRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>()
  .openapi(getGuidesRoute.routeDefinition, getGuidesRoute.handler)
  .openapi(getCategoriesRoute.routeDefinition, getCategoriesRoute.handler)
  .openapi(searchGuidesRoute.routeDefinition, searchGuidesRoute.handler)
  .openapi(getGuideRoute.routeDefinition, getGuideRoute.handler);

export { guidesRoutes };
