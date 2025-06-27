import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { readerRoutes } from './reader';

const knowledgeBaseRoutes = new OpenAPIHono<{ Bindings: Env }>();

// Mount reader routes
knowledgeBaseRoutes.route('/reader', readerRoutes);

export { knowledgeBaseRoutes };
