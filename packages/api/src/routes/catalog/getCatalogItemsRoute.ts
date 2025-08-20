import { createRoute } from '@hono/zod-openapi';
import { CatalogItemsQuerySchema, CatalogItemsResponseSchema } from '@packrat/api/schemas/catalog';
import { CatalogService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/',
  tags: ['Catalog'],
  summary: 'Get catalog items',
  description: 'Retrieve a paginated list of catalog items with optional filtering and sorting',
  security: [{ bearerAuth: [] }],
  request: {
    query: CatalogItemsQuerySchema,
  },
  responses: {
    200: {
      description: 'List of catalog items',
      content: {
        'application/json': {
          schema: CatalogItemsResponseSchema,
        },
      },
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
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

  return c.json(
    {
      items: result.items,
      totalCount: result.total,
      page,
      limit,
      totalPages,
    },
    200,
  );
};
