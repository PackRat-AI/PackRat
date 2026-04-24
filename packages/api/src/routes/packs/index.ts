import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { analyzeImageRouteEntries } from './analyzeImage';
import { generatePacksRoute } from './generatePacksRoute';
import { packItemsRouteEntries } from './items';
import { packsListRouteEntries } from './list';
import { packRouteEntries } from './pack';

const packsOpenApiRoutes = [
  ...analyzeImageRouteEntries,
  ...packsListRouteEntries,
  ...packRouteEntries,
  ...packItemsRouteEntries,
] as const;

const packsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>()
  .openapiRoutes(packsOpenApiRoutes)
  .route('/', generatePacksRoute);

export { packsRoutes };
