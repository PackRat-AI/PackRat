import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/utils/env-validation';
import * as getCategoriesRoute from './getCategoriesRoute';
import * as getGuideRoute from './getGuideRoute';
import * as getGuidesRoute from './getGuidesRoute';
import * as searchGuidesRoute from './searchGuidesRoute';

const guidesRoutes = new OpenAPIHono<{ Bindings: Env }>();

guidesRoutes.openapi(getGuidesRoute.routeDefinition, getGuidesRoute.handler);
guidesRoutes.openapi(getCategoriesRoute.routeDefinition, getCategoriesRoute.handler);
guidesRoutes.openapi(searchGuidesRoute.routeDefinition, searchGuidesRoute.handler);
guidesRoutes.openapi(getGuideRoute.routeDefinition, getGuideRoute.handler);

export { guidesRoutes };
