import { OpenAPIHono } from '@hono/zod-openapi';
import { tripsListRoutes } from './list';
import { tripRoutes } from './trip';

const tripsRoutes = new OpenAPIHono().route('/', tripRoutes).route('/', tripsListRoutes);

export { tripsRoutes };
