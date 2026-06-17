import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerKnowledgeTools(agent: AgentContext): void {
  // ── Outdoor guides RAG search ─────────────────────────────────────────────

  agent.server.registerTool(
    'search_outdoor_guides',
    {
      description:
        'Search the PackRat outdoor knowledge base using AI-powered retrieval. Contains expert guides on outdoor skills, safety, Leave No Trace principles, gear techniques, navigation, first aid, and outdoor activities. Use this for "how-to" questions, technique guidance, or safety information.',
      inputSchema: {
        query: z.string().min(5).describe('Your question or search topic'),
        limit: z.number().int().min(1).max(10).default(5),
      },
    },
    async ({ query, limit }) =>
      call({
        promise: agent.api.user.ai['rag-search'].get({ query: { q: query, limit } }),
        action: 'search outdoor guides',
      }),
  );

  // ── Knowledge-base reader (URL extraction) ────────────────────────────────

  agent.server.registerTool(
    'extract_url_content',
    {
      description:
        'Extract the readable article content from any URL using Readability. Useful for ingesting blog posts, trip reports, or gear reviews.',
      inputSchema: { url: z.string().url() },
    },
    async ({ url }) =>
      call({
        promise: agent.api.user['knowledge-base'].reader.extract.post({ url }),
        action: 'extract URL content',
        resourceHint: url,
      }),
  );
}
