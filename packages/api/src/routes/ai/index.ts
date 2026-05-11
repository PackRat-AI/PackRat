import { authPlugin } from '@packrat/api/middleware/auth';
import { RagSearchQuerySchema, WebSearchQuerySchema } from '@packrat/api/schemas/ai';
import { AIService } from '@packrat/api/services/aiService';
import { executeSqlAiTool } from '@packrat/api/services/executeSqlAiTool';
import { getSchemaInfo } from '@packrat/api/utils/DbUtils';
import { isString } from '@packrat/guards';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

export const aiRoutes = new Elysia({ prefix: '/ai' })
  .use(authPlugin)

  // RAG search
  .get(
    '/rag-search',
    async ({ query }) => {
      try {
        const { q, limit } = query;
        const aiService = new AIService();
        const result = await aiService.searchPackratOutdoorGuidesRAG(q, limit);
        return result;
      } catch (error) {
        console.error('RAG search error:', error);
        return status(500, { error: 'Failed to search outdoor guides' });
      }
    },
    {
      query: RagSearchQuerySchema,
      isAuthenticated: true,
      detail: {
        tags: ['AI'],
        summary: 'Search outdoor guides (RAG)',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Web search
  .get(
    '/web-search',
    async ({ query }) => {
      try {
        const aiService = new AIService();
        return await aiService.perplexitySearch(query.q);
      } catch (error) {
        console.error('Web search error:', error);
        return status(500, { error: 'Search failed' });
      }
    },
    {
      query: WebSearchQuerySchema,
      isAuthenticated: true,
      detail: {
        tags: ['AI'],
        summary: 'Web search via Perplexity',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Execute SQL
  .post(
    '/execute-sql',
    async ({ body, user }) => {
      try {
        const { query, limit = 100 } = body;
        const result = await executeSqlAiTool({ query, limit, userId: user.userId });
        return result;
      } catch (error) {
        console.error('Execute SQL error:', error);
        return status(500, { error: 'Failed to execute query' });
      }
    },
    {
      body: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(1000).default(100).optional(),
      }),
      isAuthenticated: true,
      detail: {
        tags: ['AI'],
        summary: 'Execute read-only SQL',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Database schema
  .get(
    '/db-schema',
    async () => {
      try {
        const result = await getSchemaInfo();
        if (!isString(result)) {
          return status(500, { error: result.error ?? 'Failed to retrieve database schema' });
        }
        return { schema: result };
      } catch (error) {
        console.error('DB schema error:', error);
        return status(500, { error: 'Failed to retrieve database schema' });
      }
    },
    {
      isAuthenticated: true,
      detail: {
        tags: ['AI'],
        summary: 'Get database schema',
        security: [{ bearerAuth: [] }],
      },
    },
  );
