import { createRoute } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  GuidesQuerySchema,
  GuidesResponseSchema,
} from '@packrat/api/schemas/guides';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { getEnv } from '@packrat/api/utils/env-validation';
import matter from 'gray-matter';
import { isArray } from 'radash';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/',
  tags: ['Guides'],
  summary: 'Get all guides',
  description:
    'Retrieve a paginated list of all available guides with optional filtering and sorting',
  security: [{ bearerAuth: [] }],
  request: {
    query: GuidesQuerySchema,
  },
  responses: {
    200: {
      description: 'Guides retrieved successfully',
      content: {
        'application/json': {
          schema: GuidesResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const handler = (async (c) => {
  const { page, limit, category } = c.req.valid('query');

  // Manually parse sort parameters from raw query
  const url = new URL(c.req.url);
  const sortField = url.searchParams.get('sort[field]');
  const sortOrder = url.searchParams.get('sort[order]');

  // Validate sort parameters
  const validSortFields = ['title', 'category', 'createdAt', 'updatedAt'] as const;
  const validSortOrders = ['asc', 'desc'] as const;

  const sort =
    sortField &&
    sortOrder &&
    validSortFields.includes(sortField as (typeof validSortFields)[number]) &&
    validSortOrders.includes(sortOrder as (typeof validSortOrders)[number])
      ? {
          field: sortField as (typeof validSortFields)[number],
          order: sortOrder as (typeof validSortOrders)[number],
        }
      : undefined;

  try {
    const bucket = new R2BucketService({
      env: getEnv(c),
      bucketType: 'guides',
    });

    const list = await bucket.list();
    console.log('Bucket list returned:', list.objects.length, 'objects');

    const guides = await Promise.all(
      list.objects.map(async (obj) => {
        // Try to get frontmatter data
        let frontmatter: Record<string, unknown> = {};
        try {
          const response = await bucket.get(obj.key);
          if (response) {
            const text = await response.text();
            const { data } = matter(text);
            frontmatter = data;
          }
        } catch (error) {
          console.error(`Error parsing frontmatter for ${obj.key}:`, error);
        }

        return {
          id: obj.key.replace(/\.(mdx?|md)$/, ''), // Remove .mdx or .md extension
          key: obj.key,
          title:
            frontmatter.title ||
            obj.customMetadata?.title ||
            obj.key.replace(/\.(mdx?|md)$/, '').replace(/-/g, ' '),
          category: obj.customMetadata?.category || 'general',
          categories: frontmatter.categories || [],
          description: frontmatter.description || obj.customMetadata?.description || '',
          author: frontmatter.author,
          readingTime: frontmatter.readingTime,
          difficulty: frontmatter.difficulty,
          createdAt: obj.uploaded.toISOString(),
          updatedAt: obj.uploaded.toISOString(),
        };
      }),
    );

    // Apply category filter
    let filteredGuides = guides;
    if (category) {
      filteredGuides = guides.filter(
        (guide) =>
          guide.category === category ||
          (isArray(guide.categories) && guide.categories.includes(category)),
      );
    }

    // Apply sorting
    if (sort) {
      filteredGuides.sort((a, b) => {
        const aValue = String(a[sort.field as keyof typeof a]);
        const bValue = String(b[sort.field as keyof typeof b]);

        if (sort.order === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    } else {
      // Default sort by title
      filteredGuides.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    }

    // Apply pagination
    const total = filteredGuides.length;
    const offset = (page - 1) * limit;
    const paginatedGuides = filteredGuides.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit);

    return c.json(
      {
        items: paginatedGuides,
        totalCount: total,
        page,
        limit,
        totalPages,
      },
      200,
    );
  } catch (error) {
    console.error('Error listing guides:', error);
    return c.json({ error: 'Failed to list guides' }, 500);
  }
}) as any;
