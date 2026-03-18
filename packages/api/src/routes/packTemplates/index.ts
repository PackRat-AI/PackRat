import { OpenAPIHono } from '@hono/zod-openapi';
import { generateFromTikTokRoutes } from './generateFromTikTok';
import { packTemplateItemsRoutes } from './packTemplateItems';
import { packTemplateRoutes } from './packTemplates';

const packTemplatesRoutes = new OpenAPIHono();

packTemplatesRoutes.route('/', packTemplateRoutes);
packTemplatesRoutes.route('/', packTemplateItemsRoutes);
packTemplatesRoutes.route('/', generateFromTikTokRoutes);

export { packTemplatesRoutes };
