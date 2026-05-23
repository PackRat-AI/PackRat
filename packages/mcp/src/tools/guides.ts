import { z } from 'zod';
import { call } from '../client';
import { SortOrder } from '../enums';
import type { AgentContext } from '../types';

export function registerGuidesTools(agent: AgentContext): void {
  agent.server.registerTool(
    'packrat_list_guides',
    {
      title: 'List Outdoor Guides',
      description: 'List PackRat outdoor guides (paginated, filterable by category).',
      inputSchema: {
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        category: z.string().optional(),
        sort_field: z.string().optional(),
        sort_order: z.nativeEnum(SortOrder).optional(),
      },
      annotations: {
        title: 'List Outdoor Guides',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ page, limit, category, sort_field, sort_order }) =>
      call(
        agent.api.user.guides.get({
          query: {
            page,
            limit,
            category,
            'sort[field]': sort_field,
            'sort[order]': sort_order,
          },
        }),
        { action: 'list guides' },
      ),
  );

  agent.server.registerTool(
    'packrat_list_guide_categories',
    {
      title: 'List Guide Categories',
      description: 'List all guide categories.',
      inputSchema: {},
      annotations: {
        title: 'List Guide Categories',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => call(agent.api.user.guides.categories.get(), { action: 'list guide categories' }),
  );

  agent.server.registerTool(
    'packrat_search_guides',
    {
      title: 'Search Outdoor Guides',
      description: 'Full-text search across PackRat outdoor guides.',
      inputSchema: {
        query: z.string().min(2),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        category: z.string().optional(),
      },
      annotations: {
        title: 'Search Outdoor Guides',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, page, limit, category }) =>
      call(agent.api.user.guides.search.get({ query: { q: query, page, limit, category } }), {
        action: 'search guides',
      }),
  );

  agent.server.registerTool(
    'packrat_get_guide',
    {
      title: 'Get Guide',
      description: 'Get a specific guide by ID. Returns MDX/Markdown content.',
      inputSchema: { guide_id: z.string() },
      annotations: {
        title: 'Get Guide',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ guide_id }) =>
      call(agent.api.user.guides({ id: guide_id }).get(), {
        action: 'get guide',
        resourceHint: `guide ${guide_id}`,
      }),
  );
}
