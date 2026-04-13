import { createRoute } from '@hono/zod-openapi';
import { ErrorResponseSchema, GuideCategoriesResponseSchema } from '@packrat/api/schemas/guides';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { getEnv } from '@packrat/api/utils/env-validation';
import matter from 'gray-matter';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/categories',
  tags: ['Guides'],
  summary: 'Get all guide categories',
  description: 'Retrieve a list of all unique categories across all available guides',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Categories retrieved successfully',
      content: {
        'application/json': {
          schema: GuideCategoriesResponseSchema,
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
  let bucket: R2BucketService;

  try {
    bucket = new R2BucketService({
      env: getEnv(c),
      bucketType: 'guides',
    });
  } catch (error) {
    console.error('Error initializing R2 bucket for guide categories:', error);
    return c.json({ categories: [], count: 0 }, 200);
  }

  let list: Awaited<ReturnType<R2BucketService['list']>>;

  try {
    list = await bucket.list();
  } catch (error) {
    console.error('Error listing guide objects for categories:', error);
    return c.json({ categories: [], count: 0 }, 200);
  }

  const categoriesSet = new Set<string>();

  // Process all guides concurrently
  const promises = list.objects.map(async (obj) => {
    try {
      // Get the guide content
      const response = await bucket.get(obj.key);
      if (response) {
        const text = await response.text();

        // Parse frontmatter to extract categories
        const { data } = matter(text);

        if (data.categories && Array.isArray(data.categories)) {
          return data.categories as string[];
        }
      }
    } catch (error) {
      console.error(`Error processing guide ${obj.key}:`, error);
      // Continue processing other guides
    }
    return [];
  });

  // Wait for all promises to resolve
  const results = await Promise.all(promises);

  // Collect all categories
  results.forEach((categories) => {
    categories.forEach((category) => {
      categoriesSet.add(category);
    });
  });

  // Convert set to sorted array
  const categories = Array.from(categoriesSet).sort();

  return c.json(
    {
      categories,
      count: categories.length,
    },
    200,
  );
};
