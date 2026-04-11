import { OpenAPIHono } from '@hono/zod-openapi';
import { generateFromOnlineContentRoutes } from './generateFromOnlineContent';
import { packTemplateItemsRoutes } from './packTemplateItems';
import { packTemplateRoutes } from './packTemplates';

const packTemplatesRoutes = new OpenAPIHono();

packTemplatesRoutes.route('/', packTemplateRoutes);
packTemplatesRoutes.route('/', packTemplateItemsRoutes);
packTemplatesRoutes.route('/', generateFromOnlineContentRoutes);

export { packTemplatesRoutes };
