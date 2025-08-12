import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { adminMiddleware } from '@packrat/api/middleware/adminMiddleware';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import { PackSchema } from '@packrat/api/schemas/packs';
import { PackService } from '@packrat/api/services/packService';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { z } from 'zod';

const generatePacksRoute = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

const route = createRoute({
  method: 'post',
  path: '/generate-packs',
  tags: ['Packs'],
  summary: 'Generate sample packs (Admin only)',
  description:
    'Generate sample packs with AI-powered content for testing and demonstration purposes. Requires admin privileges.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            count: z.number().int().positive().default(1).openapi({
              example: 5,
              description: 'Number of packs to generate',
            }),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Packs generated successfully',
      content: {
        'application/json': {
          schema: z.array(PackSchema),
        },
      },
    },
    403: {
      description: 'Forbidden - admin access required',
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

generatePacksRoute.use('*', adminMiddleware);

generatePacksRoute.openapi(route, async (c) => {
  const { count } = c.req.valid('json');
  const user = c.get('user');
  const packService = new PackService(c, user.id);
  const generatedPacks = await packService.generatePacks(count);

  return c.json(generatedPacks, 200);
});

export { generatePacksRoute };
