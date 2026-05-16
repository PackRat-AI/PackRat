import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerAiTools(agent: AgentContext): void {
  // ── Web search (Perplexity) ───────────────────────────────────────────────

  agent.server.registerTool(
    'web_search',
    {
      description:
        'Search the web for current, real-time information using Perplexity AI. Use this for current trail conditions, recent news, current gear prices and deals, permit availability, or anything requiring up-to-date info not in the PackRat knowledge base.',
      inputSchema: { query: z.string().min(3) },
    },
    async ({ query }) =>
      call(agent.api.user.ai['web-search'].get({ query: { q: query } }), {
        action: 'web search',
      }),
  );

  // ── Execute SQL (read-only) ───────────────────────────────────────────────

  agent.server.registerTool(
    'execute_sql_query',
    {
      description:
        'Execute a read-only SQL SELECT query against the PackRat database for advanced analytics. Only SELECT statements are allowed.',
      inputSchema: {
        query: z.string().min(10),
        limit: z.number().int().min(1).max(500).default(100),
      },
    },
    async ({ query, limit }) =>
      call(agent.api.user.ai['execute-sql'].post({ query, limit }), {
        action: 'execute SQL',
      }),
  );

  // ── DB schema ─────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_database_schema',
    {
      description: 'Get the PackRat DB schema — table names, columns, types.',
      inputSchema: {},
    },
    async () =>
      call(agent.api.user.ai['db-schema'].get(), { action: 'fetch DB schema' }),
  );
}
