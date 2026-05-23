import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerAiTools(agent: AgentContext): void {
  // ── Web search (Perplexity) ───────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_web_search',
    {
      title: 'Web Search',
      description:
        'Search the public web for current, real-time information. Use this for current trail conditions, recent news, current gear prices and deals, permit availability, or anything requiring up-to-date info not in the PackRat knowledge base.',
      inputSchema: { query: z.string().min(3) },
      annotations: {
        title: 'Web Search',
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ query }) =>
      call(agent.api.user.ai['web-search'].get({ query: { q: query } }), {
        action: 'web search',
      }),
  );

  // ── Execute SQL (read-only) ───────────────────────────────────────────────
  //
  // Admin-classified per the EXPLICIT_ADMIN override in `scopes.ts`. Even
  // though the API itself rejects non-SELECT statements, raw DB access is
  // too high-blast-radius to expose to mcp:read or mcp:write clients.

  agent.server.registerTool(
    'packrat_execute_sql_query',
    {
      title: 'Execute Read-Only SQL Query',
      description:
        'Execute a read-only SQL SELECT query against the PackRat database for advanced analytics. Only SELECT statements are allowed. Admin-only.',
      inputSchema: {
        query: z.string().min(10),
        limit: z.number().int().min(1).max(500).default(100),
      },
      annotations: {
        title: 'Execute Read-Only SQL Query',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, limit }) =>
      call(agent.api.user.ai['execute-sql'].post({ query, limit }), {
        action: 'execute SQL',
      }),
  );

  // ── DB schema ─────────────────────────────────────────────────────────────
  //
  // Admin-classified per the EXPLICIT_ADMIN override in `scopes.ts`.

  agent.server.registerTool(
    'packrat_get_database_schema',
    {
      title: 'Get Database Schema',
      description: 'Get the PackRat DB schema — table names, columns, types. Admin-only.',
      inputSchema: {},
      annotations: {
        title: 'Get Database Schema',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => call(agent.api.user.ai['db-schema'].get(), { action: 'fetch DB schema' }),
  );
}
