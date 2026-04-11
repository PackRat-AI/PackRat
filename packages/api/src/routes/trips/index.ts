import { OpenAPIHono } from '@hono/zod-openapi';
import { tripsListRoutes } from './list';
import { tripRoutes } from './trip';

const tripsRoutes = new OpenAPIHono();

tripsRoutes.route('/', tripRoutes);
tripsRoutes.route('/', tripsListRoutes);

export { tripsRoutes };
