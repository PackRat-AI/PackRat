import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { PackService } from '@packrat/api/services/packService';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { z } from 'zod';

const generatePacksRoute = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

const route = createRoute({
  method: 'post',
  path: '/generate-packs',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            count: z.number().int().positive().default(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successfully generated packs.',
      content: {
        'application/json': {
          schema: z.any(),
        },
      },
    },
  },
});

generatePacksRoute.openapi(route, async (c) => {
  const { count } = c.req.valid('json');
  const user = c.get('user');
  const packGenerator = new PackService(c, user.id);
  const generatedPacks = await packGenerator.generatePacks(count);

  return c.json(generatedPacks);
});

export { generatePacksRoute };
