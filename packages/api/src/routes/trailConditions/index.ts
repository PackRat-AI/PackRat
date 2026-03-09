import { OpenAPIHono } from '@hono/zod-openapi';
import { trailConditionListRoutes } from './list';
import { trailConditionRoutes } from './report';

const trailConditionsRoutes = new OpenAPIHono();

trailConditionsRoutes.route('/', trailConditionListRoutes);
trailConditionsRoutes.route('/', trailConditionRoutes);

export { trailConditionsRoutes };
