import { createRoute } from '@hono/zod-openapi';
import {
  AugmentGuideRequestSchema,
  AugmentGuideResponseSchema,
  ErrorResponseSchema,
} from '@packrat/api/schemas/gearAugmentation';
import { GearAugmentationService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';

export const routeDefinition = createRoute({
  method: 'post',
  path: '/augment',
  tags: ['Guides'],
  summary: 'Augment guide with product links',
  description:
    'Analyze guide content for gear mentions and add relevant product links from catalog',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: AugmentGuideRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successfully augmented guide with product links',
      content: {
        'application/json': {
          schema: AugmentGuideResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - invalid input',
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
  try {
    const { content, maxProductsPerGear = 3, similarityThreshold = 0.3 } = c.req.valid('json');

    if (!content || content.trim() === '') {
      return c.json({ error: 'Content is required and cannot be empty' }, 400);
    }

    const gearAugmentationService = new GearAugmentationService(c);
    const result = await gearAugmentationService.augmentGuide(
      content,
      maxProductsPerGear,
      similarityThreshold,
    );

    return c.json(result, 200);
  } catch (error) {
    console.error('Guide augmentation error:', error);
    return c.json(
      {
        error: 'Failed to augment guide',
        code: 'AUGMENTATION_ERROR',
      },
      500,
    );
  }
};
