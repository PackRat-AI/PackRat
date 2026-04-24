import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import { readerRoutes } from './reader';

const knowledgeBaseRoutes = new OpenAPIHono<{ Bindings: Env }>().route('/reader', readerRoutes);

export { knowledgeBaseRoutes };
