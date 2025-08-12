import { createRoute } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  GuideSearchQuerySchema,
  GuideSearchResponseSchema,
} from '@packrat/api/schemas/guides';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest } from '@packrat/api/utils/api-middleware';
import { getEnv } from '@packrat/api/utils/env-validation';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/search',
  tags: ['Guides'],
  summary: 'Search guides',
  description: 'Search through guide titles, descriptions, and content using text matching',
  security: [{ bearerAuth: [] }],
  request: {
    query: GuideSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'Search results retrieved successfully',
      content: {
        'application/json': {
          schema: GuideSearchResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid search query',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
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

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const _auth = await authenticateRequest(c);

  const { q, page, limit, category } = c.req.valid('query');
  const searchQuery = q.toLowerCase();

  try {
    // Use the new R2 service with org credentials
    const bucket = new R2BucketService({
      env: getEnv(c),
      bucketType: 'guides',
    });
    const list = await bucket.list({
      limit: 1000,
    });

    // Search through guides
    const searchResults = await Promise.all(
      list.objects
        .filter((obj) => obj.key.endsWith('.mdx'))
        .map(async (obj) => {
          const guide = {
            id: obj.key.replace('.mdx', ''),
            key: obj.key,
            title: obj.customMetadata?.title || obj.key.replace('.mdx', '').replace(/-/g, ' '),
            category: obj.customMetadata?.category || 'general',
            description: obj.customMetadata?.description || '',
            createdAt: obj.uploaded.toISOString(),
            updatedAt: obj.uploaded.toISOString(),
            score: 0,
          };

          // Apply category filter first
          if (category && guide.category !== category) {
            return null;
          }

          // Search in title and description
          if (guide.title.toLowerCase().includes(searchQuery)) {
            guide.score += 10;
          }
          if (guide.description.toLowerCase().includes(searchQuery)) {
            guide.score += 5;
          }

          // If there's a match in metadata, include it
          if (guide.score > 0) {
            return guide;
          }

          // Otherwise, search in content
          try {
            const object = await bucket.get(obj.key);
            if (object) {
              const content = await object.text();
              if (content.toLowerCase().includes(searchQuery)) {
                guide.score += 1;
                return guide;
              }
            }
          } catch (error) {
            console.error(`Error reading guide ${obj.key}:`, error);
          }

          return null;
        }),
    );

    // Filter out nulls and sort by score
    const guides = searchResults
      .filter((guide): guide is NonNullable<typeof guide> => guide !== null)
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...guide }) => guide); // Remove score from final output

    // Apply pagination
    const total = guides.length;
    const offset = (page - 1) * limit;
    const paginatedGuides = guides.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit);

    return c.json(
      {
        items: paginatedGuides,
        totalCount: total,
        page,
        limit,
        totalPages,
        query: q,
      },
      200,
    );
  } catch (error) {
    console.error('Error searching guides:', error);
    return c.json({ error: 'Failed to search guides' }, 500);
  }
};
