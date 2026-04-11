import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { commentsRoutes } from './comments';
import { postsRoutes } from './posts';

const feedRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

feedRoutes.route('/', postsRoutes);
feedRoutes.route('/', commentsRoutes);

export { feedRoutes };
