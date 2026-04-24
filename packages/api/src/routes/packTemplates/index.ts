import { defineOpenAPIRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { generateFromOnlineContentRoutes } from './generateFromOnlineContent';
import {
  addItemHandler,
  addItemRoute,
  deleteItemHandler,
  deleteItemRoute,
  getItemsHandler,
  getItemsRoute,
  updateItemHandler,
  updateItemRoute,
} from './packTemplateItems';
import {
  createTemplateHandler,
  createTemplateRoute,
  deleteTemplateHandler,
  deleteTemplateRoute,
  getTemplateHandler,
  getTemplateRoute,
  getTemplatesHandler,
  getTemplatesRoute,
  updateTemplateHandler,
  updateTemplateRoute,
} from './packTemplates';

const packTemplatesOpenApiRoutes = [
  defineOpenAPIRoute({ route: getTemplatesRoute, handler: getTemplatesHandler }),
  defineOpenAPIRoute({ route: createTemplateRoute, handler: createTemplateHandler }),
  defineOpenAPIRoute({ route: getTemplateRoute, handler: getTemplateHandler }),
  defineOpenAPIRoute({ route: updateTemplateRoute, handler: updateTemplateHandler }),
  defineOpenAPIRoute({ route: deleteTemplateRoute, handler: deleteTemplateHandler }),
  defineOpenAPIRoute({ route: getItemsRoute, handler: getItemsHandler }),
  defineOpenAPIRoute({ route: addItemRoute, handler: addItemHandler }),
  defineOpenAPIRoute({ route: updateItemRoute, handler: updateItemHandler }),
  defineOpenAPIRoute({ route: deleteItemRoute, handler: deleteItemHandler }),
] as const;

const packTemplatesRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>()
  .openapiRoutes(packTemplatesOpenApiRoutes)
  .route('/', generateFromOnlineContentRoutes); // keep as-is, not converted

export { packTemplatesRoutes };
