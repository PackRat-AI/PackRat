import { createRoute } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  ExtractedGearsSchema,
  ExtractGearsRequestSchema,
} from '@packrat/api/schemas/gearAugmentation';
import { GearAugmentationService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';

export const routeDefinition = createRoute({
  method: 'post',
  path: '/extract-gears',
  tags: ['Guides'],
  summary: 'Extract gear mentions from content',
  description: 'Analyze content and extract all outdoor gear and equipment mentions using AI',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ExtractGearsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successfully extracted gear mentions',
      content: {
        'application/json': {
          schema: ExtractedGearsSchema,
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
    const { content } = c.req.valid('json');

    if (!content || content.trim() === '') {
      return c.json({ error: 'Content is required and cannot be empty' }, 400);
    }

    const gearAugmentationService = new GearAugmentationService(c);
    const gears = await gearAugmentationService.extractGearMentions(content);

    return c.json({ gears }, 200);
  } catch (error) {
    console.error('Gear extraction error:', error);
    return c.json(
      {
        error: 'Failed to extract gear mentions',
        code: 'EXTRACTION_ERROR',
      },
      500,
    );
  }
};
