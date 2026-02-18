import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { detectImageMismatches } from '../../utils/catalogImageValidator';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/image-mismatches',
  tags: ['Catalog', 'Admin'],
  summary: 'Detect catalog image mismatches',
  description: 'Scan catalog for items where the image does not match the item name/category (e.g., backpack showing jacket image)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of potential image mismatches',
      content: {
        'application/json': {
          schema: z.object({
            mismatches: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                categories: z.array(z.string()),
                imageUrl: z.string(),
                issue: z.string(),
              }),
            ),
            count: z.number(),
          }),
        },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  // TODO: Add admin-only authorization
  const env = c.env;

  try {
    const mismatches = await detectImageMismatches(env);

    return c.json({
      mismatches,
      count: mismatches.length,
    }, 200);
  } catch (error) {
    console.error('Error detecting image mismatches:', error);
    return c.json({ error: 'Failed to detect image mismatches' }, 500);
  }
};
