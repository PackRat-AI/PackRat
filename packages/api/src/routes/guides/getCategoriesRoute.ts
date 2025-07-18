import { createRoute } from '@hono/zod-openapi';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import matter from 'gray-matter';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/categories',
  responses: { 200: { description: 'Get all unique guide categories' } },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    // Use the new R2 service with org credentials
    const bucket = new R2BucketService({
      env: c.env,
      bucketType: 'guides',
      config: {
        useOrgCredentials: true,
      },
    });

    const list = await bucket.list();
    const categoriesSet = new Set<string>();

    // Process each guide to extract categories
    for (const obj of list.objects) {
      try {
        // Get the guide content
        const response = await bucket.get(obj.key);
        if (response) {
          const text = await response.text();

          // Parse frontmatter to extract categories
          const { data } = matter(text);

          if (data.categories && Array.isArray(data.categories)) {
            data.categories.forEach((category: string) => {
              categoriesSet.add(category);
            });
          }
        }
      } catch (error) {
        console.error(`Error processing guide ${obj.key}:`, error);
        // Continue processing other guides
      }
    }

    // Convert set to sorted array
    const categories = Array.from(categoriesSet).sort();

    return c.json({
      categories,
      count: categories.length,
    });
  } catch (error) {
    console.error('Error getting guide categories:', error);
    return c.json({ error: 'Failed to get guide categories' }, 500);
  }
};
