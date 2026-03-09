import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { trailConditionRoutes } from './reports';

const trailConditionsRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

trailConditionsRoutes.route('/', trailConditionRoutes);

export { trailConditionsRoutes };
