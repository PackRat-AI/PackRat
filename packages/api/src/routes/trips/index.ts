import { defineOpenAPIRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import * as createTripRoute from './createTripRoute';
import * as deleteTripRoute from './deleteTripRoute';
import * as getTripByIdRoute from './getTripByIdRoute';
import * as getTripsRoute from './getTripsRoute';
import * as updateTripRoute from './updateTripRoute';

const tripsOpenApiRoutes = [
  defineOpenAPIRoute({
    route: getTripsRoute.routeDefinition,
    handler: getTripsRoute.handler,
  }),
  defineOpenAPIRoute({
    route: createTripRoute.routeDefinition,
    handler: createTripRoute.handler,
  }),
  defineOpenAPIRoute({
    route: getTripByIdRoute.routeDefinition,
    handler: getTripByIdRoute.handler,
  }),
  defineOpenAPIRoute({
    route: updateTripRoute.routeDefinition,
    handler: updateTripRoute.handler,
  }),
  defineOpenAPIRoute({
    route: deleteTripRoute.routeDefinition,
    handler: deleteTripRoute.handler,
  }),
] as const;

const tripsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>().openapiRoutes(
  tripsOpenApiRoutes,
);

export { tripsRoutes };
