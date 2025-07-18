import { createRoute, z } from '@hono/zod-openapi';
import { createR2BucketService } from '@packrat/api/services/r2-factory';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional().default(1),
      limit: z.coerce.number().int().nonnegative().optional().default(20),
      category: z.string().optional(),
      sort: z
        .object({
          field: z.enum(['title', 'category', 'createdAt', 'updatedAt']),
          order: z.enum(['asc', 'desc']),
        })
        .optional(),
    }),
  },
  responses: { 200: { description: 'Get guides list' } },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

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
    // Use the new R2 service instead of the binding
    const bucket = createR2BucketService(c.env, 'guides');

    const list = await bucket.list();
    console.log('Bucket list returned:', list.objects.length, 'objects');

    let guides = list.objects.map((obj) => ({
      id: obj.key.replace(/\.(mdx?|md)$/, ''), // Remove .mdx or .md extension
      key: obj.key,
      title: obj.customMetadata?.title || obj.key.replace(/\.(mdx?|md)$/, '').replace(/-/g, ' '),
      category: obj.customMetadata?.category || 'general',
      description: obj.customMetadata?.description || '',
      createdAt: obj.uploaded.toISOString(),
      updatedAt: obj.uploaded.toISOString(),
    }));

    // Apply category filter
    if (category) {
      guides = guides.filter((guide) => guide.category === category);
    }

    // Apply sorting
    if (sort) {
      guides.sort((a, b) => {
        const aValue = a[sort.field as keyof typeof a];
        const bValue = b[sort.field as keyof typeof b];

        if (sort.order === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    } else {
      // Default sort by title
      guides.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Apply pagination
    const total = guides.length;
    const offset = (page - 1) * limit;
    const paginatedGuides = guides.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit);

    return c.json({
      items: paginatedGuides,
      totalCount: total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error listing guides:', error);
    return c.json({ error: 'Failed to list guides' }, 500);
  }
};
