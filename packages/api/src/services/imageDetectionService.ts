import { createOpenAI } from '@ai-sdk/openai';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateObject } from 'ai';
import type { Context } from 'hono';
import { z } from 'zod';
import { CatalogService } from './catalogService';

const ITEM_DETECTION_SYSTEM_PROMPT = `You are an expert gear identification assistant specializing in outdoor and adventure equipment. 

When analyzing images of items laid out for packing, identify each visible item with the following guidelines:
- Focus on outdoor gear, camping equipment, hiking tools, and travel items
- Be specific about item names (e.g., "down sleeping bag" not just "bag")
- Include relevant descriptive details that would help match items in a gear catalog
- Ignore background items like floors, tables, or walls
- Only identify items that would typically be packed for outdoor adventures
- Provide a brief description that includes key characteristics (material, type, color if relevant)
- Estimate quantity if multiple identical items are visible

Be thorough but focused on packable outdoor gear and equipment.`;

const detectedItemSchema = z.object({
  name: z.string().describe('Specific name of the detected item optimized for catalog search'),
  description: z.string().describe('Brief description including key characteristics'),
  quantity: z.number().int().positive().default(1).describe('Number of this item visible'),
  category: z.string().describe('Category of outdoor gear (e.g., Sleep System, Clothing, etc.)'),
  confidence: z.number().min(0).max(1).describe('Confidence level in the identification (0-1)'),
});

const imageAnalysisSchema = z.object({
  items: z.array(detectedItemSchema).describe('Array of detected outdoor gear items'),
  summary: z.string().describe('Brief summary of the gear layout observed'),
});

type DetectedItem = z.infer<typeof detectedItemSchema>;
type ImageAnalysisResult = z.infer<typeof imageAnalysisSchema>;

export interface DetectedItemWithMatches {
  detected: DetectedItem;
  catalogMatches: Array<{
    id: number;
    name: string;
    description: string | null;
    weight: number | null;
    weightUnit: string | null;
    image: string | null;
    similarity: number;
  }>;
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
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please identify all the outdoor gear and equipment items visible in this image. Focus on items that would typically be packed for outdoor adventures.',
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
  ): Promise<{
    detectedItems: DetectedItemWithMatches[];
    summary: string;
  }> {
    // First, detect items in the image
    const analysis = await this.analyzeImage(imageUrl);

    // Filter out low-confidence detections
    const highConfidenceItems = analysis.items.filter((item) => item.confidence >= 0.5);

    // Find catalog matches for each detected item
    const catalogService = new CatalogService(this.c);
    const itemsWithMatches: DetectedItemWithMatches[] = [];

    for (const detected of highConfidenceItems) {
      // Create search query combining name and description
      const searchQuery = `${detected.name} ${detected.description}`.trim();

      try {
        const searchResult = await catalogService.vectorSearch(searchQuery, matchLimit);

        itemsWithMatches.push({
          detected,
          catalogMatches: searchResult.items.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            weight: item.weight,
            weightUnit: item.weightUnit,
            image: item.images?.[0] || null,
            similarity: item.similarity,
          })),
        });
      } catch (error) {
        console.error(`Failed to search catalog for item: ${detected.name}`, error);
        // Include the detected item even if catalog search fails
        itemsWithMatches.push({
          detected,
          catalogMatches: [],
        });
      }
    }

    return {
      detectedItems: itemsWithMatches,
      summary: analysis.summary,
    };
  }

  /**
   * Convert detected items to pack item format suitable for pack creation
   */
  convertToPackItems(
    detectedItems: DetectedItemWithMatches[],
    packId: string,
    userId: number,
  ): Array<{
    id: string;
    name: string;
    description: string | null;
    weight: number;
    weightUnit: string;
    quantity: number;
    category: string | null;
    consumable: boolean;
    worn: boolean;
    image: string | null;
    notes: string | null;
    packId: string;
    catalogItemId: number | null;
    userId: number;
    isAIGenerated: boolean;
  }> {
    return detectedItems.map((itemWithMatches) => {
      const { detected, catalogMatches } = itemWithMatches;
      const bestMatch = catalogMatches[0]; // Highest similarity match

      return {
        id: crypto.randomUUID(),
        name: bestMatch?.name || detected.name,
        description: bestMatch?.description || detected.description,
        weight: bestMatch?.weight || 100, // Default weight if not found
        weightUnit: bestMatch?.weightUnit || 'g',
        quantity: detected.quantity,
        category: detected.category,
        consumable: false,
        worn: false,
        image: bestMatch?.image || null,
        notes: `AI detected from image (confidence: ${Math.round(detected.confidence * 100)}%)`,
        packId,
        catalogItemId: bestMatch?.id || null,
        userId,
        isAIGenerated: true,
      };
    });
  }
}
