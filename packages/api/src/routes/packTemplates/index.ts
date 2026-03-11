import { OpenAPIHono } from '@hono/zod-openapi';
import { generateFromTiktokRoute } from './generateFromTiktok';
import { packTemplateItemsRoutes } from './packTemplateItems';
import { packTemplateRoutes } from './packTemplates';

const packTemplatesRoutes = new OpenAPIHono();

packTemplatesRoutes.route('/', packTemplateRoutes);
packTemplatesRoutes.route('/', packTemplateItemsRoutes);
packTemplatesRoutes.route('/', generateFromTiktokRoute);

export { packTemplatesRoutes };
