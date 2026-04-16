import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { backfillEmbeddingsRoute } from './backfillEmbeddingsRoute';
import * as createCatalogItemRoute from './createCatalogItemRoute';
import * as deleteCatalogItemRoute from './deleteCatalogItemRoute';
import * as getCatalogItemRoute from './getCatalogItemRoute';
import { getCatalogItemsCategoriesRoute } from './getCatalogItemsCategoriesRoute';
import * as getCatalogItemsRoute from './getCatalogItemsRoute';
import * as getSimilarCatalogItemsRoute from './getSimilarCatalogItemsRoute';
import { queueCatalogEtlRoute } from './queueCatalogEtlRoute';
import * as updateCatalogItemRoute from './updateCatalogItemRoute';
import * as vectorSearchRoute from './vectorSearchRoute';

const catalogRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>()
  .openapi(getCatalogItemsRoute.routeDefinition, getCatalogItemsRoute.handler)
  .openapi(vectorSearchRoute.routeDefinition, vectorSearchRoute.handler)
  .openapi(createCatalogItemRoute.routeDefinition, createCatalogItemRoute.handler)
  .route('/', getCatalogItemsCategoriesRoute)
  .openapi(getCatalogItemRoute.routeDefinition, getCatalogItemRoute.handler)
  .openapi(
    getSimilarCatalogItemsRoute.routeDefinition,
    getSimilarCatalogItemsRoute.handler,
  )
  .openapi(deleteCatalogItemRoute.routeDefinition, deleteCatalogItemRoute.handler)
  .openapi(updateCatalogItemRoute.routeDefinition, updateCatalogItemRoute.handler)
  .route('/', queueCatalogEtlRoute)
  .route('/', backfillEmbeddingsRoute);

export { catalogRoutes };
