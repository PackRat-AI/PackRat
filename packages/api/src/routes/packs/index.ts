import { OpenAPIHono } from '@hono/zod-openapi';
import { analyzeImageRoutes } from './analyzeImage';
import { generatePacksRoute } from './generatePacksRoute';
import { packItemsRoutes } from './items';
import { packsListRoutes } from './list';
import { packRoutes } from './pack';

const packsRoutes = new OpenAPIHono()
  .route('/', analyzeImageRoutes)
  .route('/', packsListRoutes)
  .route('/', packRoutes)
  .route('/', packItemsRoutes)
  .route('/', generatePacksRoute);

export { packsRoutes };
