import { Elysia } from 'elysia';
import { readerRoutes } from './reader';

export const knowledgeBaseRoutes = new Elysia({ prefix: '/knowledge-base' }).use(readerRoutes);
