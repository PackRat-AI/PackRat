import { createRoute } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  ImageAnalysisRequestSchema,
  ImageAnalysisResponseSchema,
} from '@packrat/api/schemas/imageAnalysis';
import { CatalogService } from '@packrat/api/services/catalogService';
import { ImageAnalysisService } from '@packrat/api/services/imageAnalysisService';
import type { RouteHandler } from '@packrat/api/types/routeHandler';

export const routeDefinition = createRoute({
  method: 'post',
  path: '/analyze-image',
  tags: ['Catalog'],
  summary: 'Analyze gear image with AI vision',
  description:
    'Use OpenAI vision model to detect outdoor gear items in an image and find similar items via vector search',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ImageAnalysisRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Image analysis completed successfully',
      content: {
        'application/json': {
          schema: ImageAnalysisResponseSchema,
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

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const startTime = Date.now();

  try {
    const { imageUrl, includeVectorSearch = true, vectorSearchLimit = 5 } = c.req.valid('json');

    // Validate image URL format
    try {
      new URL(imageUrl);
    } catch {
      return c.json(
        {
          success: false,
          error: 'Invalid image URL format',
          code: 'INVALID_IMAGE_URL',
        },
        400,
      );
    }

    // Initialize services
    const imageAnalysisService = new ImageAnalysisService(c);
    const catalogService = new CatalogService(c);

    // Step 1: Analyze the image with OpenAI Vision
    let analysisResult: Awaited<ReturnType<ImageAnalysisService['analyzeImage']>>;
    try {
      analysisResult = await imageAnalysisService.analyzeImage(imageUrl);
    } catch (error) {
      console.error('Vision analysis failed:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to analyze image with AI vision model',
          code: 'VISION_ANALYSIS_FAILED',
        },
        500,
      );
    }

    // Step 2: If requested, perform vector search for each detected item
    const itemsWithSearch = await Promise.all(
      analysisResult.items.map(async (item) => {
        if (!includeVectorSearch) {
          return item;
        }

        try {
          // Create search query from detected item
          const searchQuery =
            `${item.name} ${item.description} ${item.brand || ''} ${item.model || ''} ${item.category}`.trim();

          // Perform vector search
          const vectorSearchResult = await catalogService.vectorSearch(
            searchQuery,
            vectorSearchLimit,
            0,
          );

          // Transform the results to match our schema
          const vectorSearchResults = vectorSearchResult.items.map((catalogItem) => ({
            id: String(catalogItem.id),
            name: catalogItem.name,
            description: catalogItem.description || '',
            brand: catalogItem.brand || undefined,
            category: catalogItem.categories?.[0] || undefined,
            similarity: catalogItem.similarity,
            price: catalogItem.price || undefined,
            imageUrl: catalogItem.images?.[0] || undefined,
          }));

          return {
            ...item,
            vectorSearchResults,
          };
        } catch (vectorError) {
          console.error('Vector search failed for item:', item.name, vectorError);
          // Return item without vector search results if search fails
          return {
            ...item,
            vectorSearchResults: [],
          };
        }
      }),
    );

    const processingTimeMs = Date.now() - startTime;

    return c.json(
      {
        success: true,
        items: itemsWithSearch,
        totalItemsFound: analysisResult.totalItemsFound,
        analysisConfidence: analysisResult.analysisConfidence,
        processingTimeMs,
      },
      200,
    );
  } catch (error) {
    console.error('Image analysis route error:', error);

    return c.json(
      {
        success: false,
        error: 'Internal server error during image analysis',
        code: 'INTERNAL_ERROR',
      },
      500,
    );
  }
};
