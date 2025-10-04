import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packItems, packs } from '@packrat/api/db/schema';
import {
  AnalyzeImageRequestSchema,
  AnalyzeImageResponseSchema,
  CreatePackFromImageRequestSchema,
  CreatePackFromImageResponseSchema,
} from '@packrat/api/schemas/imageDetection';
import { ErrorResponseSchema } from '@packrat/api/schemas/upload';
import { ImageDetectionService } from '@packrat/api/services/imageDetectionService';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';

const analyzeImageRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// Analyze image to detect gear items
const analyzeImageRoute = createRoute({
  method: 'post',
  path: '/analyze-image',
  tags: ['Packs'],
  summary: 'Analyze image to detect gear items',
  description:
    'Use AI vision to identify outdoor gear items in an image and find matching catalog items',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: AnalyzeImageRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Image analyzed successfully',
      content: {
        'application/json': {
          schema: AnalyzeImageResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - invalid image URL or parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - authentication required',
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

analyzeImageRoutes.openapi(analyzeImageRoute, async (c) => {
  try {
    const { imageUrl, matchLimit } = c.req.valid('json');

    // Validate image URL format
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return c.json({ error: 'Invalid image URL format' }, 400);
    }

    const imageDetectionService = new ImageDetectionService(c);
    const result = await imageDetectionService.detectAndMatchItems(imageUrl, matchLimit);

    return c.json(result, 200);
  } catch (error) {
    console.error('Error analyzing image:', error);
    c.get('sentry').captureException(error);

    if (error instanceof Error) {
      // Check for specific error types that should return 400 instead of 500
      if (
        error.message.includes('Invalid image') ||
        error.message.includes('Unsupported image format') ||
        error.message.includes('Image too large')
      ) {
        return c.json({ error: error.message }, 400);
      }

      return c.json({ error: `Failed to analyze image: ${error.message}` }, 500);
    }

    return c.json({ error: 'Failed to analyze image' }, 500);
  }
});

// Create a pack from detected items in an image
const createPackFromImageRoute = createRoute({
  method: 'post',
  path: '/create-from-image',
  tags: ['Packs'],
  summary: 'Create pack from image analysis',
  description:
    'Analyze an image to detect gear items and automatically create a pack with matching catalog items',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePackFromImageRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Pack created successfully from image',
      content: {
        'application/json': {
          schema: CreatePackFromImageResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - invalid parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - authentication required',
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

analyzeImageRoutes.openapi(createPackFromImageRoute, async (c) => {
  const auth = c.get('user');
  const db = createDb(c);

  try {
    const { imageUrl, packName, packDescription, isPublic, minConfidence } = c.req.valid('json');

    const imageDetectionService = new ImageDetectionService(c);

    // Analyze the image
    const analysisResult = await imageDetectionService.detectAndMatchItems(imageUrl, 3);

    // Filter items by confidence threshold
    const highConfidenceItems = analysisResult.detectedItems.filter(
      (item) => item.detected.confidence >= (minConfidence || 0.5),
    );

    if (highConfidenceItems.length === 0) {
      return c.json(
        {
          error:
            'No items detected with sufficient confidence. Try a clearer image or lower confidence threshold.',
        },
        400,
      );
    }

    // Create the pack in a transaction
    const result = await db.transaction(async (tx) => {
      // Create the pack
      const packId = crypto.randomUUID();
      const [createdPack] = await tx
        .insert(packs)
        .values({
          id: packId,
          userId: auth.userId,
          name: packName,
          description:
            packDescription || `Pack created from AI image analysis - ${analysisResult.summary}`,
          category: 'Mixed',
          isPublic: isPublic || false,
          isAIGenerated: true,
          localCreatedAt: new Date(),
          localUpdatedAt: new Date(),
        })
        .returning();

      // Convert detected items to pack items
      const packItemsToInsert = imageDetectionService.convertToPackItems(
        highConfidenceItems,
        packId,
        auth.userId,
      );

      // Insert the pack items
      if (packItemsToInsert.length > 0) {
        await tx.insert(packItems).values(packItemsToInsert);
      }

      return {
        pack: {
          id: createdPack.id,
          name: createdPack.name,
          description: createdPack.description,
          itemsCount: packItemsToInsert.length,
        },
        detectedItems: highConfidenceItems,
        summary: analysisResult.summary,
      };
    });

    return c.json(result, 201);
  } catch (error) {
    console.error('Error creating pack from image:', error);

    if (error instanceof Error) {
      return c.json({ error: `Failed to create pack from image: ${error.message}` }, 500);
    }

    return c.json({ error: 'Failed to create pack from image' }, 500);
  }
});

export { analyzeImageRoutes };
