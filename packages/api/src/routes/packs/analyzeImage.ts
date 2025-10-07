import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  AnalyzeImageRequestSchema,
  AnalyzeImageResponseSchema,
} from '@packrat/api/schemas/imageDetection';
import { ErrorResponseSchema } from '@packrat/api/schemas/upload';
import { ImageDetectionService } from '@packrat/api/services/imageDetectionService';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { getEnv } from '@packrat/api/utils/env-validation';
import { getPresignedUrl } from '@packrat/api/utils/getPresignedUrl';

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
    403: {
      description: 'Forbidden - access to the image denied',
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
    const auth = c.get('user');
    const { image, matchLimit } = c.req.valid('json');

    if (!image.startsWith(`${auth.userId}-`)) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const { PACKRAT_BUCKET_R2_BUCKET_NAME, PACKRAT_BUCKET } = getEnv(c);
    const command = new GetObjectCommand({
      Bucket: PACKRAT_BUCKET_R2_BUCKET_NAME,
      Key: image,
    });
    const imageUrl = await getPresignedUrl(c, command, {
      expiresIn: 3600,
    });

    const imageDetectionService = new ImageDetectionService(c);
    const result = await imageDetectionService.detectAndMatchItems(imageUrl, matchLimit);

    await PACKRAT_BUCKET.delete(image);

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

export { analyzeImageRoutes };
