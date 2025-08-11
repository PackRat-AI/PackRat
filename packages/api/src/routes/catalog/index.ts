import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/utils/env-validation';
import { backfillEmbeddingsRoute } from './backfillEmbeddingsRoute';
import * as createCatalogItemRoute from './createCatalogItemRoute';
import * as deleteCatalogItemRoute from './deleteCatalogItemRoute';
import * as getCatalogItemRoute from './getCatalogItemRoute';
import * as getCatalogItemsCategoriesRoute from './getCatalogItemsCategoriesRoute';
import * as getCatalogItemsRoute from './getCatalogItemsRoute';
import * as queueCatalogEtlRoute from './queueCatalogEtlRoute';
import * as updateCatalogItemRoute from './updateCatalogItemRoute';

const catalogRoutes = new OpenAPIHono<{ Bindings: Env }>();

catalogRoutes.openapi(getCatalogItemsRoute.routeDefinition, getCatalogItemsRoute.handler);
catalogRoutes.openapi(createCatalogItemRoute.routeDefinition, createCatalogItemRoute.handler);
catalogRoutes.openapi(
  getCatalogItemsCategoriesRoute.routeDefinition,
  getCatalogItemsCategoriesRoute.handler,
);
catalogRoutes.openapi(getCatalogItemRoute.routeDefinition, getCatalogItemRoute.handler);
catalogRoutes.openapi(deleteCatalogItemRoute.routeDefinition, deleteCatalogItemRoute.handler);
catalogRoutes.openapi(updateCatalogItemRoute.routeDefinition, updateCatalogItemRoute.handler);
catalogRoutes.openapi(queueCatalogEtlRoute.routeDefinition, queueCatalogEtlRoute.handler);
catalogRoutes.route('/', backfillEmbeddingsRoute);

export { catalogRoutes };
