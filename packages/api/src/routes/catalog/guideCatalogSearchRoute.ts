import { createRoute, z } from '@hono/zod-openapi';
import { CatalogService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';

const CatalogItemLinkSchema = z.object({
  id: z.number(),
  name: z.string(),
  productUrl: z.string(),
  brand: z.string().nullable().optional(),
  categories: z.array(z.string()).nullable().optional(),
  price: z.number().nullable().optional(),
  ratingValue: z.number().nullable().optional(),
});

const GuideCatalogSearchResultSchema = z.object({
  items: z.array(CatalogItemLinkSchema),
  query: z.string(),
  total: z.number(),
});

export const routeDefinition = createRoute({
  method: 'get',
  path: '/guides/search',
  request: {
    query: z.object({
      q: z.string().min(1),
      limit: z.coerce.number().int().positive().optional().default(10),
      category: z.string().optional(),
      minRating: z.coerce.number().min(0).max(5).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Search catalog items optimized for guide generation',
      content: {
        'application/json': {
          schema: GuideCatalogSearchResultSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
    },
    500: {
      description: 'Internal Server Error',
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { q: query, limit, category, minRating } = c.req.valid('query');

  try {
    const catalogService = new CatalogService(c);
    
    // Use semantic search for better results
    const searchResult = await catalogService.semanticSearch(query, limit, 0);

    // Filter and transform results for guide generation
    const filteredItems = searchResult.items
      .filter(item => {
        // Filter by category if specified
        if (category && item.categories && !item.categories.includes(category)) {
          return false;
        }
        // Filter by minimum rating if specified
        if (minRating && (!item.ratingValue || item.ratingValue < minRating)) {
          return false;
        }
        // Ensure we have a valid product URL
        if (!item.productUrl) {
          return false;
        }
        return true;
      })
      .map(item => ({
        id: item.id,
        name: item.name,
        productUrl: item.productUrl,
        brand: item.brand,
        categories: item.categories,
        price: item.price,
        ratingValue: item.ratingValue,
      }));

    return c.json({
      items: filteredItems,
      query,
      total: filteredItems.length,
    });
  } catch (error) {
    console.error('Error searching catalog for guides:', error);
    return c.json(
      {
        error: 'Failed to search catalog',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      500,
    );
  }
};