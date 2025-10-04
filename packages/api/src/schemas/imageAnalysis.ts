import { z } from '@hono/zod-openapi';

export const DetectedItemSchema = z
  .object({
    name: z.string().openapi({
      description: 'Name of the detected outdoor gear item',
      example: 'Osprey Atmos 65L Backpack',
    }),
    description: z.string().openapi({
      description: 'Description of the item and its visible features',
      example: 'Large hiking backpack with external frame and multiple compartments',
    }),
    category: z.string().openapi({
      description: 'Category of the outdoor gear item',
      example: 'Backpacks & Bags',
    }),
    confidence: z.number().min(0.1).max(1.0).openapi({
      description: 'Confidence level of the detection (0.1-1.0)',
      example: 0.95,
    }),
    brand: z.string().optional().openapi({
      description: 'Brand name if visible in the image',
      example: 'Osprey',
    }),
    model: z.string().optional().openapi({
      description: 'Model name if identifiable',
      example: 'Atmos 65',
    }),
    color: z.string().optional().openapi({
      description: 'Primary color(s) of the item',
      example: 'Navy Blue',
    }),
    material: z.string().optional().openapi({
      description: 'Material type if identifiable',
      example: 'Nylon',
    }),
  })
  .openapi('DetectedItem');

export const ImageAnalysisRequestSchema = z
  .object({
    imageUrl: z.string().url().openapi({
      description: 'URL of the image to analyze for gear detection',
      example: 'https://example.com/gear-image.jpg',
    }),
    includeVectorSearch: z.boolean().optional().default(true).openapi({
      description: 'Whether to include vector search results for detected items',
      example: true,
    }),
    vectorSearchLimit: z.number().min(1).max(10).optional().default(5).openapi({
      description: 'Number of similar items to return from vector search per detected item',
      example: 5,
    }),
  })
  .openapi('ImageAnalysisRequest');

export const VectorSearchResultSchema = z
  .object({
    id: z.string().openapi({
      description: 'Catalog item ID',
      example: 'item-123',
    }),
    name: z.string().openapi({
      description: 'Item name',
      example: 'Osprey Atmos AG 65 Backpack',
    }),
    description: z.string().openapi({
      description: 'Item description',
      example: 'Anti-Gravity suspension hiking backpack',
    }),
    brand: z.string().optional().openapi({
      description: 'Item brand',
      example: 'Osprey',
    }),
    category: z.string().optional().openapi({
      description: 'Item category',
      example: 'Backpacks & Bags',
    }),
    similarity: z.number().openapi({
      description: 'Similarity score to the detected item',
      example: 0.92,
    }),
    price: z.number().optional().openapi({
      description: 'Item price',
      example: 299.99,
    }),
    imageUrl: z.string().optional().openapi({
      description: 'Item image URL',
      example: 'https://example.com/osprey-backpack.jpg',
    }),
  })
  .openapi('VectorSearchResult');

export const DetectedItemWithSearchSchema = DetectedItemSchema.extend({
  vectorSearchResults: z.array(VectorSearchResultSchema).optional().openapi({
    description: 'Similar items found in catalog via vector search',
  }),
}).openapi('DetectedItemWithSearch');

export const ImageAnalysisResponseSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Whether the analysis was successful',
      example: true,
    }),
    items: z.array(DetectedItemWithSearchSchema).openapi({
      description: 'Array of detected outdoor gear items',
    }),
    totalItemsFound: z.number().openapi({
      description: 'Total number of items detected in the image',
      example: 3,
    }),
    analysisConfidence: z.number().min(0.0).max(1.0).openapi({
      description: 'Overall confidence of the image analysis',
      example: 0.87,
    }),
    processingTimeMs: z.number().openapi({
      description: 'Time taken to process the analysis in milliseconds',
      example: 2450,
    }),
  })
  .openapi('ImageAnalysisResponse');

export const ErrorResponseSchema = z
  .object({
    success: z.boolean().default(false).openapi({
      description: 'Whether the request was successful',
      example: false,
    }),
    error: z.string().openapi({
      description: 'Error message',
      example: 'Invalid image URL provided',
    }),
    code: z.string().optional().openapi({
      description: 'Error code for programmatic handling',
      example: 'INVALID_IMAGE_URL',
    }),
  })
  .openapi('ImageAnalysisError');
