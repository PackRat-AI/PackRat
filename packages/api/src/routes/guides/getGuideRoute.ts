import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema, GuideDetailSchema } from '@packrat/api/schemas/guides';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { getEnv } from '@packrat/api/utils/env-validation';
import matter from 'gray-matter';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Guides'],
  summary: 'Get a specific guide',
  description: 'Retrieve detailed content for a specific guide by its ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({
        example: 'ultralight-backpacking',
        description: 'The unique identifier of the guide',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Guide retrieved successfully',
      content: {
        'application/json': {
          schema: GuideDetailSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - Invalid or missing authentication token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Guide not found',
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
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id } = c.req.valid('param');

  try {
    const bucket = new R2BucketService({
      env: getEnv(c),
      bucketType: 'guides',
    });

    // Try .mdx first, then .md
    let key = `${id}.mdx`;
    let object = await bucket.get(key);

    if (!object) {
      key = `${id}.md`;
      object = await bucket.get(key);
    }

    if (!object) {
      return c.json({ error: 'Guide not found' }, 404);
    }

    // Get metadata
    const headResult = await bucket.head(key);
    const metadata = headResult?.customMetadata || {};

    // Get content
    const rawContent = await object.text();

    // Parse frontmatter
    const { data: frontmatter, content } = matter(rawContent);

    return c.json({
      id,
      title: frontmatter.title || metadata.title || id.replace(/-/g, ' '),
      category: metadata.category || 'general',
      categories: frontmatter.categories || [],
      description: frontmatter.description || metadata.description || '',
      author: frontmatter.author,
      readingTime: frontmatter.readingTime,
      difficulty: frontmatter.difficulty,
      content,
      createdAt: object.uploaded.toISOString(),
      updatedAt: object.uploaded.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching guide:', error);
    return c.json({ error: 'Failed to fetch guide' }, 500);
  }
};
