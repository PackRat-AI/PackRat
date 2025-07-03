import { createRoute, z } from '@hono/zod-openapi';
import { CatalogService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional().default(1),
      limit: z.coerce.number().int().nonnegative().optional().default(20),
      q: z.string().optional(),
      category: z.string().optional(),
      sort: z
        .object({
          field: z.enum([
            'name',
            'brand',
            'category',
            'price',
            'ratingValue',
            'createdAt',
            'updatedAt',
          ]),
          order: z.enum(['asc', 'desc']),
        })
        .optional(),
    }),
  },
  responses: { 200: { description: 'Get catalog items' } },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { page, limit, q, category } = c.req.valid('query');

  // Manually parse sort parameters from raw query
  const url = new URL(c.req.url);
  const sortField = url.searchParams.get('sort[field]');
  const sortOrder = url.searchParams.get('sort[order]');

  // Validate sort parameters
  const validSortFields = [
    'name',
    'brand',
    'category',
    'price',
    'ratingValue',
    'createdAt',
    'updatedAt',
  ] as const;
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

  // Use CatalogService for list queries
  const catalogService = new CatalogService(c);
  const offset = (page - 1) * limit;

  const result = await catalogService.getCatalogItems({
    q,
    limit,
    offset,
    category,
    sort,
  });

  const totalPages = Math.ceil(result.total / limit);

  return c.json({
    items: result.items,
    totalCount: result.total,
    page,
    limit,
    totalPages,
  });
};
