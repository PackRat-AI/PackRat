import { z } from 'zod';
import { call } from '../client';
import { SortOrder } from '../enums';
import type { AgentContext } from '../types';

export function registerGuidesTools(agent: AgentContext): void {
  agent.server.registerTool(
    'list_guides',
    {
      description: 'List PackRat outdoor guides (paginated, filterable by category).',
      inputSchema: {
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        category: z.string().optional(),
        sort_field: z.string().optional(),
        sort_order: z.nativeEnum(SortOrder).optional(),
      },
    },
    async ({ page, limit, category, sort_field, sort_order }) =>
      call({
        promise: agent.api.user.guides.get({
          query: {
            page,
            limit,
            category,
            'sort[field]': sort_field,
            'sort[order]': sort_order,
          },
        }),
        action: 'list guides',
      }),
  );

  agent.server.registerTool(
    'list_guide_categories',
    {
      description: 'List all guide categories.',
      inputSchema: {},
    },
    async () =>
      call({ promise: agent.api.user.guides.categories.get(), action: 'list guide categories' }),
  );

  agent.server.registerTool(
    'search_guides',
    {
      description: 'Full-text search across PackRat outdoor guides.',
      inputSchema: {
        query: z.string().min(2),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        category: z.string().optional(),
      },
    },
    async ({ query, page, limit, category }) =>
      call({
        promise: agent.api.user.guides.search.get({ query: { q: query, page, limit, category } }),
        action: 'search guides',
      }),
  );

  agent.server.registerTool(
    'get_guide',
    {
      description: 'Get a specific guide by ID. Returns MDX/Markdown content.',
      inputSchema: { guide_id: z.string() },
    },
    async ({ guide_id }) =>
      call({
        promise: agent.api.user.guides({ id: guide_id }).get(),
        action: 'get guide',
        resourceHint: `guide ${guide_id}`,
      }),
  );
}
