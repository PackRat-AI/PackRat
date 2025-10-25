import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import axios from 'axios';
import { z } from 'zod';

// Default models configuration
const DEFAULT_MODELS = {
  OPENAI_CHAT: 'gpt-4o-mini',
} as const;

// System prompt for contextual content enhancement
const SYSTEM_PROMPT = `You are a content enhancement expert specializing in outdoor adventure guides. Your task is to intelligently integrate relevant catalog items into guide content while maintaining natural flow and readability.

Guidelines:
1. Only suggest products that are directly relevant to the content being discussed
2. Integrate product links naturally within the text, not as separate lists
3. Use contextual phrases like "Consider the [Product Name](link)" or "A reliable option is the [Product Name](link)"
4. Focus on gear that would genuinely enhance the reader's experience
5. Maintain the original tone and structure of the content
6. Don't oversell or sound overly promotional
7. Ensure product suggestions align with the difficulty level and context of the guide
8. Use the catalogVectorSearch tool to find the most relevant products for specific contexts

When you find relevant products, integrate them seamlessly into the existing content using markdown link syntax: [Product Name](link)`;

// User prompt for content enhancement
const ENHANCEMENT_PROMPT = `Please enhance the following outdoor adventure guide content by intelligently integrating relevant catalog items. Use the catalogVectorSearch tool to find appropriate products that would genuinely help readers with the activities described. 

Integrate product links naturally within the existing text structure. Focus on key gear mentions and opportunities where specific product recommendations would add value.

Return the enhanced content with the same structure and formatting, but with contextual product links seamlessly integrated.`;

export interface ContentEnhancementOptions {
  temperature?: number;
  maxSearchResults?: number;
  apiBaseUrl?: string;
  apiKey?: string;
}

export interface EnhancedContentResult {
  content: string;
  productsUsed: Array<{
    name: string;
    url: string;
    context: string;
    similarity?: number;
  }>;
}

/**
 * Enhance guide content by contextually integrating relevant catalog items
 * This is the main programmatic API for content enhancement
 */
export async function enhanceGuideContent(
  content: string,
  options: ContentEnhancementOptions = {},
): Promise<EnhancedContentResult> {
  const {
    temperature = 0.3,
    maxSearchResults = 5,
    apiBaseUrl = 'http://localhost:8787',
    apiKey = process.env.OPENAI_API_KEY,
  } = options;

  if (!apiKey) {
    throw new Error('API key is required for content enhancement');
  }

  // Track products used for reporting
  const productsUsed: Array<{
    name: string;
    url: string;
    context: string;
    similarity?: number;
  }> = [];

  try {
    const { text: enhancedContent } = await generateText({
      model: openai(DEFAULT_MODELS.OPENAI_CHAT),
      system: SYSTEM_PROMPT,
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: ENHANCEMENT_PROMPT,
            },
            {
              type: 'text',
              text: content,
            },
          ],
        },
      ],
      tools: {
        catalogVectorSearch: tool({
          description:
            'Search items catalog using vector search to find relevant products for the content.',
          parameters: z.object({
            query: z
              .string()
              .min(1)
              .describe('Search query to find catalog items relevant to the current context'),
            limit: z
              .number()
              .min(1)
              .max(50)
              .optional()
              .default(maxSearchResults)
              .describe('Optional limit for number of results to return'),
            offset: z
              .number()
              .min(0)
              .optional()
              .default(0)
              .describe('Optional offset for pagination of results'),
          }),
          execute: async ({ query, limit, offset }) => {
            try {
              console.log(`🔍 Searching catalog for: "${query}"`);

              const response = await axios.get(`${apiBaseUrl}/api/catalog/vector-search`, {
                params: { q: query, limit, offset },
                headers: {
                  // TODO: Replace with proper API authentication token
                  Authorization: `Bearer ${apiKey}`, // Temporary: should use dedicated API key
                  'Content-Type': 'application/json',
                },
                timeout: 10000, // 10 second timeout
              });

              const searchResults = response.data;

              // Track products for reporting
              if (searchResults.items) {
                searchResults.items.forEach(
                  (item: { name: string; productUrl: string; similarity?: number }) => {
                    productsUsed.push({
                      name: item.name,
                      url: item.productUrl,
                      context: query,
                      similarity: item.similarity,
                    });
                  },
                );
              }

              console.log(`✅ Found ${searchResults.items?.length || 0} relevant products`);
              return {
                success: true,
                data: searchResults,
              };
            } catch (error) {
              console.error('❌ Catalog vector search error:', error);
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to perform vector search',
              };
            }
          },
        }),
      },
      temperature,
      maxRetries: 3,
    });

    return {
      content: enhancedContent,
      productsUsed,
    };
  } catch (error) {
    console.error('Content enhancement error:', error);
    throw new Error(
      `Failed to enhance content: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Batch enhance multiple content pieces
 */
export async function batchEnhanceContent(
  contentPieces: Array<{ id: string; content: string }>,
  options: ContentEnhancementOptions = {},
): Promise<Array<{ id: string; result: EnhancedContentResult }>> {
  const results: Array<{ id: string; result: EnhancedContentResult }> = [];

  for (const piece of contentPieces) {
    try {
      console.log(`🔄 Enhancing content piece: ${piece.id}`);
      const result = await enhanceGuideContent(piece.content, options);
      results.push({ id: piece.id, result });

      // Add delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to enhance content piece ${piece.id}:`, error);
      // Continue with other pieces even if one fails
      results.push({
        id: piece.id,
        result: {
          content: piece.content, // Return original content on error
          productsUsed: [],
        },
      });
    }
  }

  return results;
}

/**
 * Validate that the catalog API is accessible
 */
export async function validateCatalogApi(
  options: ContentEnhancementOptions = {},
): Promise<boolean> {
  const { apiBaseUrl = 'http://localhost:8787', apiKey = process.env.OPENAI_API_KEY } = options;

  if (!apiKey) {
    console.error('❌ API key is required for catalog API validation');
    return false;
  }

  try {
    const response = await axios.get(`${apiBaseUrl}/api/catalog/vector-search`, {
      params: { q: 'test', limit: 1 },
      headers: {
        // TODO: Replace with proper API authentication token
        Authorization: `Bearer ${apiKey}`, // Temporary: should use dedicated API key
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    console.log('✅ Catalog API connection validated');
    return response.status === 200;
  } catch (error) {
    console.error('❌ Catalog API validation failed:', error);
    return false;
  }
}

/**
 * Process markdown content and enhance specific sections
 * Useful for targeting specific parts of a guide
 */
export async function enhanceMarkdownSections(
  markdownContent: string,
  _sectionPatterns: RegExp[] = [/## .+/g, /### .+/g],
  options: ContentEnhancementOptions = {},
): Promise<EnhancedContentResult> {
  // For now, enhance the entire content
  // Future enhancement: could parse sections and enhance individually
  return enhanceGuideContent(markdownContent, options);
}

/**
 * Integration function for the existing guide generation pipeline
 * Designed to be used in generate-content.ts
 */
export async function integrateWithGuideGeneration(
  generatedContent: string,
  metadata: {
    title: string;
    categories: string[];
    difficulty: string;
  },
  options: ContentEnhancementOptions = {},
): Promise<EnhancedContentResult> {
  console.log(`🎯 Integrating catalog items for: "${metadata.title}"`);

  // Enhance the generated content with contextual product links
  const result = await enhanceGuideContent(generatedContent, {
    ...options,
    // Adjust temperature based on difficulty level
    temperature: metadata.difficulty === 'Beginner' ? 0.2 : 0.3,
  });

  // Log enhancement results
  if (result.productsUsed.length > 0) {
    console.log(`✨ Enhanced with ${result.productsUsed.length} product recommendations`);
    result.productsUsed.forEach((product) => {
      console.log(`   - ${product.name} (context: ${product.context})`);
    });
  } else {
    console.log('ℹ️  No relevant products found for this content');
  }

  return result;
}
