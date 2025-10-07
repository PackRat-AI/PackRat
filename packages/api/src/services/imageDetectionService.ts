import { createOpenAI } from '@ai-sdk/openai';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateObject } from 'ai';
import type { Context } from 'hono';
import { z } from 'zod';
import type { CatalogItem } from '../db/schema';
import { CatalogService } from './catalogService';

const ITEM_DETECTION_SYSTEM_PROMPT = `You are an expert gear identification assistant specializing in outdoor and adventure equipment. 

When analyzing images of items laid out for packing, identify each visible item with the following guidelines:
- Focus on outdoor gear, camping equipment, hiking tools, and travel items
- Be as precise as possible in identifying items (e.g., "The North Face Eco Trail Down 20°F Sleeping Bag" not just "sleeping bag")
- Include relevant descriptive details that would help match items in a gear catalog
- Ignore background items like floors, tables, or walls
- Only identify items that would typically be packed for outdoor adventures
- Provide a brief description that includes key characteristics (material, type, color if relevant)
- Estimate quantity if multiple identical items are visible

Be thorough but focused on packable outdoor gear and equipment.`;

const detectedItemSchema = z.object({
  name: z.string().describe('Specific name of the detected item'),
  description: z
    .string()
    .describe('Brief description including key characteristics optimized for catalog search'),
  quantity: z.number().int().positive().default(1).describe('Number of this item visible'),
  category: z.string().describe('Category of outdoor gear (e.g., Sleep System, Clothing, etc.)'),
  consumable: z.boolean().default(false).describe('Whether the item is consumable'),
  worn: z.boolean().default(false).describe('Whether the item is worn'),
  notes: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).describe('Confidence level in the identification (0-1)'),
});

const imageAnalysisSchema = z.object({
  items: z.array(detectedItemSchema).describe('Array of detected outdoor gear items'),
});

type DetectedItem = z.infer<typeof detectedItemSchema>;
type ImageAnalysisResult = z.infer<typeof imageAnalysisSchema>;

export interface DetectedItemWithMatches {
  detected: DetectedItem;
  catalogMatches: Array<Omit<CatalogItem, 'embedding'> & { similarity: number }>;
}

export class ImageDetectionService {
  private readonly c: Context;

  constructor(c: Context) {
    this.c = c;
  }

  /**
   * Analyze an image to detect outdoor gear items
   */
  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    const { OPENAI_API_KEY } = getEnv(this.c);
    const openai = createOpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const { object } = await generateObject({
      model: openai(DEFAULT_MODELS.OPENAI_CHAT),
      schema: imageAnalysisSchema,
      system: ITEM_DETECTION_SYSTEM_PROMPT,
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please identify all the outdoor gear and equipment items visible in this image.',
            },
            {
              type: 'image',
              image: imageUrl,
            },
          ],
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent results
    });

    return object;
  }

  /**
   * Detect items in an image and find matching catalog items
   */
  async detectAndMatchItems(
    imageUrl: string,
    matchLimit: number = 3,
  ): Promise<DetectedItemWithMatches[]> {
    try {
      // First, detect items in the image
      const analysis = await this.analyzeImage(imageUrl);

      // If no items detected, return early
      if (!analysis.items || analysis.items.length === 0) {
        return [];
      }

      // Filter out low-confidence detections
      const highConfidenceItems = analysis.items.filter((item) => item.confidence >= 0.5);

      // Find catalog matches for each detected item
      const catalogService = new CatalogService(this.c);

      const searchQueries = highConfidenceItems.map((detected) =>
        `${detected.name} ${detected.description}`.trim(),
      );
      const result = await catalogService.batchVectorSearch(searchQueries, matchLimit);

      // Combine detected items with their catalog matches
      const itemsWithMatches: DetectedItemWithMatches[] = highConfidenceItems
        .map((detected, index) => ({
          detected,
          catalogMatches: result.items[index],
        }))
        .filter(
          (item): item is DetectedItemWithMatches =>
            item.catalogMatches !== undefined && item.catalogMatches.length > 0,
        );

      return itemsWithMatches;
    } catch (error) {
      console.error('Error in detectAndMatchItems:', error);
      throw new Error(
        `Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
