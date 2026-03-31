import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  RagSearchQuerySchema,
  RagSearchResponseSchema,
  WebSearchQuerySchema,
  WebSearchResponseSchema,
} from '@packrat/api/schemas/ai';
import { AIService } from '@packrat/api/services/aiService';
import { executeSqlAiTool } from '@packrat/api/services/executeSqlAiTool';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { getSchemaInfo } from '@packrat/api/utils/DbUtils';

const aiRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// ─── RAG search ─────────────────────────────────────────────────────────────

const ragSearchRoute = createRoute({
  method: 'get',
  path: '/rag-search',
  tags: ['AI'],
  summary: 'Search outdoor guides (RAG)',
  description: 'Search the PackRat outdoor guides knowledge base using RAG',
  security: [{ bearerAuth: [] }],
  request: {
    query: RagSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'RAG search results',
      content: { 'application/json': { schema: RagSearchResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

aiRoutes.openapi(ragSearchRoute, async (c) => {
  try {
    const { q: query, limit } = c.req.valid('query');
    const aiService = new AIService(c);
    const result = await aiService.searchPackratOutdoorGuidesRAG(query, limit);
    return c.json(result, 200);
  } catch (error) {
    console.error('RAG search error:', error);
    return c.json({ error: 'Failed to search outdoor guides' }, 500);
  }
});

// ─── Web search ──────────────────────────────────────────────────────────────

const webSearchRoute = createRoute({
  method: 'get',
  path: '/web-search',
  tags: ['AI'],
  summary: 'Web search via Perplexity',
  description: 'Search the web for current information using Perplexity',
  security: [{ bearerAuth: [] }],
  request: {
    query: WebSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'Web search results',
      content: { 'application/json': { schema: WebSearchResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

aiRoutes.openapi(webSearchRoute, async (c) => {
  try {
    const { q: query } = c.req.valid('query');
    const aiService = new AIService(c);
    const result = await aiService.perplexitySearch(query);
    return c.json(result, 200);
  } catch (error) {
    console.error('Web search error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

// ─── Execute SQL ─────────────────────────────────────────────────────────────

const ExecuteSqlBodySchema = z
  .object({
    query: z.string().min(1).openapi({
      example: 'SELECT id, name FROM packs WHERE user_id = 1 LIMIT 10',
      description: 'SQL SELECT statement to execute',
    }),
    limit: z.number().int().min(1).max(1000).default(100).optional().openapi({
      example: 100,
      description: 'Maximum number of rows to return',
    }),
  })
  .openapi('ExecuteSqlBody');

const executeSqlRoute = createRoute({
  method: 'post',
  path: '/execute-sql',
  tags: ['AI'],
  summary: 'Execute read-only SQL',
  description:
    'Execute a read-only SELECT query against the database. Only SELECT statements are allowed.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: ExecuteSqlBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Query results',
      content: {
        'application/json': {
          schema: z
            .union([
              z.object({
                success: z.literal(true),
                data: z.array(z.unknown()),
                rowCount: z.number().optional(),
                executionTime: z.number(),
                query: z.string(),
              }),
              z.object({
                error: z.string(),
                query: z.string().optional(),
              }),
            ])
            .openapi('ExecuteSqlResponse'),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

aiRoutes.openapi(executeSqlRoute, async (c) => {
  try {
    const auth = c.get('user');
    const { query, limit = 100 } = c.req.valid('json');
    const result = await executeSqlAiTool({ query, limit, c, userId: auth.userId });
    if ('error' in result) {
      return c.json({ error: result.error ?? 'Unknown error', query: result.query }, 200);
    }
    return c.json(
      {
        success: true as const,
        data: result.data,
        rowCount: result.rowCount,
        executionTime: result.executionTime,
        query: result.query,
      },
      200,
    );
  } catch (error) {
    console.error('Execute SQL error:', error);
    return c.json({ error: 'Failed to execute query' }, 500);
  }
});

// ─── Database schema ─────────────────────────────────────────────────────────

const dbSchemaRoute = createRoute({
  method: 'get',
  path: '/db-schema',
  tags: ['AI'],
  summary: 'Get database schema',
  description: 'Returns the database schema so the AI can generate accurate SQL queries',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Database schema information',
      content: {
        'application/json': {
          schema: z.object({ schema: z.string() }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

aiRoutes.openapi(dbSchemaRoute, async (c) => {
  try {
    const result = await getSchemaInfo(c);
    if (typeof result !== 'string') {
      return c.json({ error: result.error ?? 'Failed to retrieve database schema' }, 500);
    }
    return c.json({ schema: result }, 200);
  } catch (error) {
    console.error('DB schema error:', error);
    return c.json({ error: 'Failed to retrieve database schema' }, 500);
  }
});

export { aiRoutes };
