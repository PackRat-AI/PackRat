import { OpenAPIHono } from '@hono/zod-openapi';
import { packTemplateItemsRoutes } from './packTemplateItems';
import { packTemplateRoutes } from './packTemplates';

const packTemplatesRoutes = new OpenAPIHono();

packTemplatesRoutes.route('/', packTemplateRoutes);
packTemplatesRoutes.route('/', packTemplateItemsRoutes);

export { packTemplatesRoutes };
