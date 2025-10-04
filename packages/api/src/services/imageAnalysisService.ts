import type { Env } from '@packrat/api/types/env';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { createAIProvider } from '@packrat/api/utils/ai/provider';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateText } from 'ai';
import type { Context } from 'hono';

export interface DetectedItem {
  name: string;
  description: string;
  category: string;
  confidence: number;
  brand?: string;
  model?: string;
  color?: string;
  material?: string;
}

export interface ImageAnalysisResult {
  items: DetectedItem[];
  totalItemsFound: number;
  analysisConfidence: number;
}

const IMAGE_ANALYSIS_SYSTEM_PROMPT = `You are an expert outdoor gear identification assistant. Analyze the provided image to identify outdoor gear, camping equipment, hiking gear, and outdoor clothing.

For each item you can clearly identify in the image, provide:
- name: A descriptive name for the item
- description: Brief description of the item's appearance and features
- category: One of these categories: "Backpacks & Bags", "Tents & Shelters", "Sleeping Gear", "Cooking & Hydration", "Clothing & Footwear", "Climbing & Safety", "Tools & Accessories", "Electronics", "Other"
- confidence: Your confidence level (0.1-1.0) in the identification
- brand: Brand name if clearly visible (optional)
- model: Model name if identifiable (optional)
- color: Primary color(s) (optional)
- material: Material type if identifiable (optional)

Focus on outdoor and camping gear. Be specific and accurate. Only include items you can confidently identify.

Respond with a JSON object in this format:
{
  "items": [
    {
      "name": "item name",
      "description": "item description",
      "category": "category name",
      "confidence": 0.95,
      "brand": "brand name",
      "model": "model name", 
      "color": "color",
      "material": "material"
    }
  ],
  "totalItemsFound": number,
  "analysisConfidence": overall_confidence_score
}`;

export class ImageAnalysisService {
  private env: Env;

  constructor(c: Context) {
    this.env = getEnv(c);
  }

  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    const aiProvider = createAIProvider({
      openAiApiKey: this.env.OPENAI_API_KEY,
      provider: this.env.AI_PROVIDER,
      cloudflareAccountId: this.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: this.env.CLOUDFLARE_AI_GATEWAY_ID,
      cloudflareAiBinding: this.env.AI,
    });

    try {
      const response = await generateText({
        model: aiProvider.languageModel(DEFAULT_MODELS.OPENAI_VISION),
        system: IMAGE_ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this image and identify all the outdoor gear items you can see.',
              },
              {
                type: 'image',
                image: imageUrl,
              },
            ],
          },
        ],
        temperature: 0.1, // Low temperature for consistent, factual responses
      });

      // Parse the JSON response
      let analysisResult: ImageAnalysisResult;
      try {
        analysisResult = JSON.parse(response.text);
      } catch (parseError) {
        console.error('Failed to parse vision analysis response:', parseError);
        console.error('Raw response:', response.text);

        // Fallback: try to extract items from text response
        analysisResult = this.parseTextualResponse(response.text);
      }

      // Validate and clean the result
      return this.validateAndCleanResult(analysisResult);
    } catch (error) {
      console.error('Image analysis error:', error);
      throw new Error(
        `Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private parseTextualResponse(_text: string): ImageAnalysisResult {
    // Fallback parser for cases where the model doesn't return valid JSON
    // This is a simple implementation - could be enhanced with more sophisticated parsing
    return {
      items: [],
      totalItemsFound: 0,
      analysisConfidence: 0.0,
    };
  }

  private validateAndCleanResult(result: ImageAnalysisResult): ImageAnalysisResult {
    if (!result || typeof result !== 'object') {
      return {
        items: [],
        totalItemsFound: 0,
        analysisConfidence: 0.0,
      };
    }

    const validCategories = new Set([
      'Backpacks & Bags',
      'Tents & Shelters',
      'Sleeping Gear',
      'Cooking & Hydration',
      'Clothing & Footwear',
      'Climbing & Safety',
      'Tools & Accessories',
      'Electronics',
      'Other',
    ]);

    const cleanedItems = (result.items || [])
      .filter((item: unknown): item is Record<string, unknown> => 
        Boolean(item && typeof item === 'object' && item !== null)
      )
      .map((item) => ({
        name: String(item.name || '').trim(),
        description: String(item.description || '').trim(),
        category: typeof item.category === 'string' && validCategories.has(item.category) 
          ? item.category 
          : 'Other',
        confidence: Math.max(0.1, Math.min(1.0, Number(item.confidence) || 0.1)),
        brand: item.brand ? String(item.brand).trim() : undefined,
        model: item.model ? String(item.model).trim() : undefined,
        color: item.color ? String(item.color).trim() : undefined,
        material: item.material ? String(item.material).trim() : undefined,
      }))
      .filter((item) => item.name && item.description);

    return {
      items: cleanedItems,
      totalItemsFound: cleanedItems.length,
      analysisConfidence: Math.max(0.0, Math.min(1.0, Number(result.analysisConfidence) || 0.0)),
    };
  }
}
