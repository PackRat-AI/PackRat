import { Hono } from 'hono';
import { packTemplateItemsRoutes } from './packTemplateItems';
import { packTemplateRoutes } from './packTemplates';

const packTemplatesRoutes = new Hono();

packTemplatesRoutes.route('/', packTemplateRoutes);
packTemplatesRoutes.route('/', packTemplateItemsRoutes);

export { packTemplatesRoutes };
