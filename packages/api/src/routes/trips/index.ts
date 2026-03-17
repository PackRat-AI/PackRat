import { OpenAPIHono } from '@hono/zod-openapi';
import { tripAnalyticsRoutes } from './analytics';
import { tripsListRoutes } from './list';
import { tripRoutes } from './trip';

const tripsRoutes = new OpenAPIHono();

tripsRoutes.route('/', tripAnalyticsRoutes);
tripsRoutes.route('/', tripRoutes);
tripsRoutes.route('/', tripsListRoutes);

export { tripsRoutes };
