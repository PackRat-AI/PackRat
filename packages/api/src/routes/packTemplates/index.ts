import { OpenAPIHono } from '@hono/zod-openapi';
import { generateFromOnlineContentRoutes } from './generateFromOnlineContent';
import { packTemplateItemsRoutes } from './packTemplateItems';
import { packTemplateRoutes } from './packTemplates';

const packTemplatesRoutes = new OpenAPIHono()
  .route('/', packTemplateRoutes)
  .route('/', packTemplateItemsRoutes)
  .route('/', generateFromOnlineContentRoutes);

export { packTemplatesRoutes };
