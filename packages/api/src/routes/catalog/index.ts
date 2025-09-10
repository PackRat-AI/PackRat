import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import { backfillEmbeddingsRoute } from './backfillEmbeddingsRoute';
import * as createCatalogItemRoute from './createCatalogItemRoute';
import * as deleteCatalogItemRoute from './deleteCatalogItemRoute';
import * as getCatalogItemRoute from './getCatalogItemRoute';
import { getCatalogItemsCategoriesRoute } from './getCatalogItemsCategoriesRoute';
import * as getCatalogItemsRoute from './getCatalogItemsRoute';
import * as queueCatalogEtlRoute from './queueCatalogEtlRoute';
import * as updateCatalogItemRoute from './updateCatalogItemRoute';
import * as vectorSearchRoute from './vectorSearchRoute';

const catalogRoutes = new OpenAPIHono<{ Bindings: Env }>();

catalogRoutes.openapi(getCatalogItemsRoute.routeDefinition, getCatalogItemsRoute.handler);
catalogRoutes.openapi(createCatalogItemRoute.routeDefinition, createCatalogItemRoute.handler);
catalogRoutes.route('/', getCatalogItemsCategoriesRoute);
catalogRoutes.openapi(getCatalogItemRoute.routeDefinition, getCatalogItemRoute.handler);
catalogRoutes.openapi(deleteCatalogItemRoute.routeDefinition, deleteCatalogItemRoute.handler);
catalogRoutes.openapi(updateCatalogItemRoute.routeDefinition, updateCatalogItemRoute.handler);
catalogRoutes.openapi(queueCatalogEtlRoute.routeDefinition, queueCatalogEtlRoute.handler);
catalogRoutes.openapi(vectorSearchRoute.routeDefinition, vectorSearchRoute.handler);
catalogRoutes.route('/', backfillEmbeddingsRoute);

export { catalogRoutes };
