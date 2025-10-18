import { openai } from '@ai-sdk/openai';
import { createRoute } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  ExtractAndMatchResponseSchema,
  GearExtractionRequestSchema,
  GearExtractionResultSchema,
} from '@packrat/api/schemas/gearExtraction';
import { CatalogService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { generateObject } from 'ai';

export const routeDefinition = createRoute({
  method: 'post',
  path: '/extract-products',
  tags: ['Guides'],
  summary: 'Extract gear and match products from guide content',
  description:
    'Uses AI to extract outdoor gear mentioned in guide content and matches them to catalog products using vector search',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: GearExtractionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successfully extracted gear and matched products',
      content: {
        'application/json': {
          schema: ExtractAndMatchResponseSchema,
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
    const { guideContent, guideTitle } = c.req.valid('json');
    const { OPENAI_API_KEY } = c.env;

    if (!OPENAI_API_KEY) {
      return c.json({ error: 'OpenAI API key not configured' }, 500);
    }

    // Step 1: Extract gear using AI
    const model = openai(DEFAULT_MODELS.OPENAI_CHAT, {
      apiKey: OPENAI_API_KEY,
    });

    const system = `You are an outdoor gear expert. Your task is to analyze hiking and outdoor adventure guides to extract all mentions of outdoor gear, equipment, and supplies.

Focus on:
- Camping gear (tents, sleeping bags, backpacks, etc.)
- Hiking equipment (boots, poles, navigation tools, etc.)
- Clothing and layers (jackets, pants, base layers, etc.)
- Cooking and food supplies (stoves, cookware, water filters, etc.)
- Safety and emergency equipment (first aid, communication devices, etc.)
- Technical gear (ropes, harnesses, crampons for specific activities)

For each item, provide:
- A clear, standardized name
- The appropriate category
- Relevant keywords that would help match it to products
- A brief description if context helps clarify the specific type needed

Only extract items that are explicitly mentioned or clearly implied as necessary equipment. Avoid generic terms and focus on specific gear types.`;

    const { object: extractionResult } = await generateObject({
      model,
      schema: GearExtractionResultSchema,
      system,
      prompt: `Please analyze this guide titled "${guideTitle}" to extract all the outdoor gears and equipments mentioned.

Guide content:
${guideContent}`,
      temperature: Number(c.env.OPENAI_TEMPERATURE) || 0.3, // Configurable temperature for consistency
    });

    // Step 2: Match extracted gear to catalog products using vector search
    const catalogService = new CatalogService(c);
    const productMatches = [];

    for (const gear of extractionResult.gears) {
      try {
        // Create search query from gear information
        const searchQuery = [gear.name, gear.description, ...(gear.keywords || []), gear.category]
          .filter(Boolean)
          .join(' ');

        // Use vector search to find matching products
        const searchResults = await catalogService.vectorSearch(searchQuery, 5, 0);

        const matches = searchResults.items.map((item) => ({
          id: item.id,
          name: item.name,
          brand: item.brand,
          productUrl: item.productUrl,
          price: item.price,
          similarity: item.similarity,
        }));

        productMatches.push({
          extractedGear: gear,
          catalogMatches: matches,
        });
      } catch (error) {
        console.error(`Error matching gear "${gear.name}":`, error);
        // Continue with other gear items even if one fails
        productMatches.push({
          extractedGear: gear,
          catalogMatches: [],
        });
      }
    }

    const response = {
      extractionResult,
      productMatches,
      processedAt: new Date().toISOString(),
    };

    return c.json(response, 200);
  } catch (error) {
    console.error('Product extraction error:', error);
    return c.json(
      {
        error: 'Failed to extract products from guide content',
        code: 'EXTRACTION_ERROR',
      },
      500,
    );
  }
};
