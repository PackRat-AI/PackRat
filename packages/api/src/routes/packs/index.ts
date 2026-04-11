import { OpenAPIHono } from '@hono/zod-openapi';
import { analyzeImageRoutes } from './analyzeImage';
import { generatePacksRoute } from './generatePacksRoute';
import { packItemsRoutes } from './items';
import { packsListRoutes } from './list';
import { packRoutes } from './pack';

const packsRoutes = new OpenAPIHono();

packsRoutes.route('/', analyzeImageRoutes);
packsRoutes.route('/', packsListRoutes);
packsRoutes.route('/', packRoutes);
packsRoutes.route('/', packItemsRoutes);
packsRoutes.route('/', generatePacksRoute);

export { packsRoutes };
