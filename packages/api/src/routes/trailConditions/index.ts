import { Elysia } from 'elysia';
import { trailConditionAlertRoutes } from './alerts';
import { trailConditionRoutes } from './reports';
import { trailIndexRoutes } from './trails';
import { tripTrailConditionRoutes } from './trip';

export const trailConditionsRoutes = new Elysia({ prefix: '/trail-conditions' })
  .use(trailIndexRoutes)
  .use(tripTrailConditionRoutes)
  .use(trailConditionAlertRoutes)
  .use(trailConditionRoutes);
