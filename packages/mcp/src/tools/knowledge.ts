import { z } from 'zod';
import { err, ok } from '../client';
import type { AgentContext } from '../types';

export function registerKnowledgeTools(agent: AgentContext): void {
  // ── Outdoor guides RAG search ─────────────────────────────────────────────

  agent.server.registerTool(
    'search_outdoor_guides',
    {
      description:
        'Search the PackRat outdoor knowledge base using AI-powered retrieval. Contains expert guides on outdoor skills, safety, Leave No Trace principles, gear techniques, navigation, first aid, and outdoor activities. Use this for "how-to" questions, technique guidance, or safety information.',
      inputSchema: {
        query: z
          .string()
          .min(5)
          .describe(
            'Your question or search topic. Examples: "how to set up a bear hang", "layering system for cold weather camping", "water treatment methods for backcountry"',
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(5)
          .describe('Number of guide sections to return (default 5)'),
      },
    },
    async ({ query, limit }) => {
      try {
        const data = await agent.api.get('/ai/rag-search', { q: query, limit });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Web search ────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'web_search',
    {
      description:
        'Search the web for current, real-time information using Perplexity AI. Use this for: current trail conditions, recent news about parks/trails, current gear prices and deals, recent reviews, event schedules, permit availability, or anything requiring up-to-date information not in the PackRat knowledge base.',
      inputSchema: {
        query: z
          .string()
          .min(3)
          .describe(
            'Search query — be specific. Examples: "John Muir Trail permit availability 2025", "best ultralight tent reviews 2025", "Yosemite Valley campground reservations"',
          ),
      },
    },
    async ({ query }) => {
      try {
        const data = await agent.api.get('/ai/web-search', { q: query });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Execute SQL (power user tool) ─────────────────────────────────────────

  agent.server.registerTool(
    'execute_sql_query',
    {
      description:
        'Execute a read-only SQL SELECT query against the PackRat database. Use this for advanced analytics, custom gear searches by specs, or exploring the data schema. Only SELECT statements are allowed — no INSERT, UPDATE, or DELETE.',
      inputSchema: {
        query: z
          .string()
          .min(10)
          .describe(
            'A valid SQL SELECT statement. Example: "SELECT name, brand, weight FROM catalog_items WHERE category = \'sleeping bags\' AND weight < 500 ORDER BY weight ASC LIMIT 10"',
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(100)
          .describe('Maximum rows to return (default 100, max 500)'),
      },
    },
    async ({ query, limit }) => {
      try {
        const data = await agent.api.post('/ai/execute-sql', { query, limit });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Get DB schema ─────────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_database_schema',
    {
      description:
        'Get the PackRat database schema — table names, column names, and types. Use this before writing SQL queries to understand available data structures.',
      inputSchema: {},
    },
    async () => {
      try {
        const data = await agent.api.get('/ai/db-schema');
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );
}
