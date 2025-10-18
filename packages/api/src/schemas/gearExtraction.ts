import { z } from '@hono/zod-openapi';

export const ExtractedGearItemSchema = z
  .object({
    name: z.string().describe('Name of the gear/equipment item'),
    category: z.string().describe('Category of the gear (e.g., shelter, clothing, cooking)'),
    description: z.string().optional().describe('Brief description of the gear item'),
    keywords: z.array(z.string()).describe('Related keywords that could help in product matching'),
  })
  .openapi('ExtractedGearItem');

export const GearExtractionResultSchema = z
  .object({
    gears: z.array(ExtractedGearItemSchema).describe('List of extracted gear items from the guide'),
  })
  .openapi('GearExtractionResult');

export const GearExtractionRequestSchema = z
  .object({
    guideContent: z.string().min(1).describe('The full markdown content of the guide'),
    guideTitle: z.string().min(1).describe('Title of the guide for context'),
  })
  .openapi('GearExtractionRequest');

export const ProductMatchSchema = z
  .object({
    extractedGear: ExtractedGearItemSchema,
    catalogMatches: z
      .array(
        z.object({
          id: z.number().describe('Catalog item ID'),
          name: z.string().describe('Product name'),
          brand: z.string().nullable().describe('Product brand'),
          productUrl: z.string().describe('Product URL'),
          price: z.number().nullable().describe('Product price'),
          similarity: z.number().min(0).max(1).describe('Similarity score'),
        }),
      )
      .describe('Matching catalog products'),
  })
  .openapi('ProductMatch');

export const ExtractAndMatchResponseSchema = z
  .object({
    extractionResult: GearExtractionResultSchema,
    productMatches: z.array(ProductMatchSchema),
    processedAt: z.string().datetime().describe('When the extraction was processed'),
  })
  .openapi('ExtractAndMatchResponse');

export const ErrorResponseSchema = z
  .object({
    error: z.string().describe('Error message'),
    code: z.string().optional().describe('Error code for programmatic handling'),
  })
  .openapi('ErrorResponse');
