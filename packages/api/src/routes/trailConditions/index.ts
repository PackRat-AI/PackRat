import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { trailConditionListRoutes } from './list';
import { trailConditionRoutes } from './report';

const trailConditionsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

trailConditionsRoutes.route('/', trailConditionListRoutes);
trailConditionsRoutes.route('/', trailConditionRoutes);

export { trailConditionsRoutes };
