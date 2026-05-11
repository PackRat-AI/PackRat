import { Elysia } from 'elysia';
import { trailConditionRoutes } from './reports';

export const trailConditionsRoutes = new Elysia({ prefix: '/trail-conditions' }).use(
  trailConditionRoutes,
);
