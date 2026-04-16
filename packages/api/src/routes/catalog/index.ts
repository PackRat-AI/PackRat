import { defineOpenAPIRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { backfillEmbeddingsRoute } from './backfillEmbeddingsRoute';
import * as createCatalogItemRoute from './createCatalogItemRoute';
import * as deleteCatalogItemRoute from './deleteCatalogItemRoute';
import * as getCatalogItemRoute from './getCatalogItemRoute';
import * as getCatalogItemsCategoriesRoute from './getCatalogItemsCategoriesRoute';
import * as getCatalogItemsRoute from './getCatalogItemsRoute';
import * as getSimilarCatalogItemsRoute from './getSimilarCatalogItemsRoute';
import { queueCatalogEtlRoute } from './queueCatalogEtlRoute';
import * as updateCatalogItemRoute from './updateCatalogItemRoute';
import * as vectorSearchRoute from './vectorSearchRoute';

const catalogOpenApiRoutes = [
  defineOpenAPIRoute({
    route: getCatalogItemsRoute.routeDefinition,
    handler: getCatalogItemsRoute.handler,
  }),
  defineOpenAPIRoute({
    route: vectorSearchRoute.routeDefinition,
    handler: vectorSearchRoute.handler,
  }),
  defineOpenAPIRoute({
    route: createCatalogItemRoute.routeDefinition,
    handler: createCatalogItemRoute.handler,
  }),
  defineOpenAPIRoute({
    route: getCatalogItemsCategoriesRoute.routeDefinition,
    handler: getCatalogItemsCategoriesRoute.handler,
  }),
  defineOpenAPIRoute({
    route: getCatalogItemRoute.routeDefinition,
    handler: getCatalogItemRoute.handler,
  }),
  defineOpenAPIRoute({
    route: getSimilarCatalogItemsRoute.routeDefinition,
    handler: getSimilarCatalogItemsRoute.handler,
  }),
  defineOpenAPIRoute({
    route: deleteCatalogItemRoute.routeDefinition,
    handler: deleteCatalogItemRoute.handler,
  }),
  defineOpenAPIRoute({
    route: updateCatalogItemRoute.routeDefinition,
    handler: updateCatalogItemRoute.handler,
  }),
] as const;

const catalogRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>()
  .openapiRoutes(catalogOpenApiRoutes)
  .route('/', queueCatalogEtlRoute)
  .route('/', backfillEmbeddingsRoute);

export { catalogRoutes };
