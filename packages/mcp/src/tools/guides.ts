import { z } from 'zod';
import { call } from '../client';
import {
  GetGuideOutputSchema,
  ListGuideCategoriesOutputSchema,
  ListGuidesOutputSchema,
  SearchGuidesOutputSchema,
} from '../output-schemas';
import { tool } from '../registerTool';
import type { AgentContext } from '../types';

export function registerGuidesTools(agent: AgentContext): void {
  tool<{
    page: number;
    limit: number;
    category?: string;
    sort_field?: 'title' | 'category' | 'createdAt' | 'updatedAt';
    sort_order?: 'asc' | 'desc';
  }>(
    agent.server,
    'packrat_list_guides',
    {
      title: 'List Outdoor Guides',
      description: 'List PackRat outdoor guides (paginated, filterable by category).',
      inputSchema: {
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        category: z.string().optional(),
        sort_field: z.enum(['title', 'category', 'createdAt', 'updatedAt']).optional(),
        sort_order: z.enum(['asc', 'desc']).optional(),
      },
      outputSchema: ListGuidesOutputSchema.shape,
      annotations: {
        title: 'List Outdoor Guides',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ page, limit, category, sort_field, sort_order }) =>
      call({
        promise: agent.api.user.guides.get({
          query: {
            page,
            limit,
            category,
            ...(sort_field ? { sort: { field: sort_field, order: sort_order ?? 'asc' } } : {}),
          },
        }),
        action: 'list guides',
        structured: true,
      }),
  );

  tool<Record<string, never>>(
    agent.server,
    'packrat_list_guide_categories',
    {
      title: 'List Guide Categories',
      description: 'List all guide categories.',
      inputSchema: {},
      outputSchema: ListGuideCategoriesOutputSchema.shape,
      annotations: {
        title: 'List Guide Categories',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      call({
        promise: agent.api.user.guides.categories.get(),
        action: 'list guide categories',
        structured: true,
      }),
  );

  tool<{
    query: string;
    page: number;
    limit: number;
    category?: string;
  }>(
    agent.server,
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
      outputSchema: SearchGuidesOutputSchema.shape,
      annotations: {
        title: 'Search Outdoor Guides',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, page, limit, category }) =>
      call({
        promise: agent.api.user.guides.search.get({ query: { q: query, page, limit, category } }),
        action: 'search guides',
        structured: true,
      }),
  );

  tool<{ guide_id: string }>(
    agent.server,
    'packrat_get_guide',
    {
      title: 'Get Guide',
      description: 'Get a specific guide by ID. Returns MDX/Markdown content.',
      inputSchema: { guide_id: z.string() },
      outputSchema: GetGuideOutputSchema.shape,
      annotations: {
        title: 'Get Guide',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ guide_id }) =>
      call({
        promise: agent.api.user.guides({ id: guide_id }).get(),
        action: 'get guide',
        structured: true,
        resourceHint: `guide ${guide_id}`,
      }),
  );
}
