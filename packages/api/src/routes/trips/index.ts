import { OpenAPIHono } from '@hono/zod-openapi';

import { tripRoutes } from './trip';
import { tripsListRoutes } from './list';

const tripsRoutes = new OpenAPIHono();

tripsRoutes.route('/', tripRoutes);
tripsRoutes.route('/', tripsListRoutes);

export { tripsRoutes };
