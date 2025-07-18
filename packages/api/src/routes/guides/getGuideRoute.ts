import { createRoute, z } from '@hono/zod-openapi';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: { description: 'Get guide content' },
    404: { description: 'Guide not found' },
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
    // Use the new R2 service with org credentials
    const bucket = new R2BucketService({
      env: c.env,
      bucketType: 'guides',
      config: {
        useOrgCredentials: true,
      },
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
    const content = await object.text();

    return c.json({
      id,
      title: metadata.title || id.replace(/-/g, ' '),
      category: metadata.category || 'general',
      description: metadata.description || '',
      content,
      createdAt: object.uploaded.toISOString(),
      updatedAt: object.uploaded.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching guide:', error);
    return c.json({ error: 'Failed to fetch guide' }, 500);
  }
};
