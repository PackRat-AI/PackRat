import { openai } from '@ai-sdk/openai';
import type { CatalogItem } from '@packrat/api/schemas/catalog';
import { generateText } from 'ai';

// Types for the catalog link blending system
export interface CatalogLinkMatch {
  item: CatalogItem & { similarity: number };
  contextualPhrases: string[];
  insertionPoints: InsertionPoint[];
}

export interface InsertionPoint {
  position: number; // Character position in content
  context: string; // Surrounding text for context
  confidence: number; // How confident we are about this insertion
  linkText: string; // Suggested link text
}

export interface BlendingOptions {
  maxLinksPerArticle?: number;
  minSimilarityThreshold?: number;
  contextWindowSize?: number;
  prioritizeNewContent?: boolean;
}

export interface BlendingResult {
  originalContent: string;
  enhancedContent: string;
  insertedLinks: Array<{
    item: CatalogItem;
    linkText: string;
    context: string;
  }>;
  suggestions: CatalogLinkMatch[];
}

// Configuration
const DEFAULT_OPTIONS: Required<BlendingOptions> = {
  maxLinksPerArticle: 5,
  minSimilarityThreshold: 0.7,
  contextWindowSize: 200,
  prioritizeNewContent: true,
};

// API configuration for catalog vector search
interface CatalogSearchAPI {
  vectorSearch: (
    query: string,
    limit?: number,
  ) => Promise<{
    items: Array<CatalogItem & { similarity: number }>;
    total: number;
  }>;
}

/**
 * Main class for blending catalog item links into guide content
 */
export class CatalogLinkBlender {
  private catalogAPI: CatalogSearchAPI;
  private options: Required<BlendingOptions>;

  constructor(catalogAPI: CatalogSearchAPI, options: BlendingOptions = {}) {
    this.catalogAPI = catalogAPI;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Main method to enhance guide content with catalog links
   */
  async enhanceGuideContent(
    content: string,
    guideMetadata?: {
      title?: string;
      categories?: string[];
      difficulty?: string;
    },
  ): Promise<BlendingResult> {
    try {
      // Step 1: Extract semantic keywords and contexts from the content
      const semanticAnalysis = await this.analyzeContentSemantics(content, guideMetadata);

      // Step 2: Search for relevant catalog items using vector search
      const catalogMatches = await this.findRelevantCatalogItems(semanticAnalysis);

      // Step 3: Determine optimal insertion points for each item
      const linkMatches = await this.determineInsertionPoints(content, catalogMatches);

      // Step 4: Generate enhanced content with contextual links
      const enhancedContent = await this.insertContextualLinks(content, linkMatches);

      return {
        originalContent: content,
        enhancedContent,
        insertedLinks: linkMatches.slice(0, this.options.maxLinksPerArticle).map((match) => ({
          item: match.item,
          linkText: match.insertionPoints[0]?.linkText || match.item.name,
          context: match.insertionPoints[0]?.context || '',
        })),
        suggestions: linkMatches,
      };
    } catch (error) {
      console.error('Error enhancing guide content:', error);
      return {
        originalContent: content,
        enhancedContent: content, // Return original on error
        insertedLinks: [],
        suggestions: [],
      };
    }
  }

  /**
   * Analyze content to extract semantic keywords and contexts
   */
  private async analyzeContentSemantics(
    content: string,
    guideMetadata?: {
      title?: string;
      categories?: string[];
      difficulty?: string;
    },
  ): Promise<{
    primaryKeywords: string[];
    gearMentions: string[];
    contexts: Array<{ phrase: string; context: string; position: number }>;
  }> {
    // First try AI analysis, fall back to basic extraction if AI fails
    try {
      const metadataContext = guideMetadata
        ? `
        Guide Title: ${guideMetadata.title || 'Unknown'}
        Categories: ${guideMetadata.categories?.join(', ') || 'General'}
        Difficulty: ${guideMetadata.difficulty || 'All Levels'}
      `
        : '';

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: `Analyze the following hiking/outdoor guide content to identify gear, equipment, and product mentions that could be linked to catalog items.

${metadataContext}

Content to analyze:
"""
${content}
"""

Extract and return a JSON object with:
1. "primaryKeywords": Array of 8-12 main outdoor gear/equipment terms mentioned
2. "gearMentions": Array of specific product names, brands, or detailed equipment descriptions
3. "contexts": Array of objects with "phrase" (the specific gear mention), "context" (surrounding 50 characters), and "position" (approximate character position)

Focus on:
- Hiking and backpacking gear (tents, backpacks, sleeping bags, etc.)
- Clothing and footwear
- Navigation and safety equipment
- Cooking and water systems
- Weather protection gear
- Tools and accessories

Return only valid JSON.`,
        temperature: 0.3,
      });

      // Parse the AI response and extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      return {
        primaryKeywords: analysis.primaryKeywords || [],
        gearMentions: analysis.gearMentions || [],
        contexts: analysis.contexts || [],
      };
    } catch (error) {
      console.warn(
        'AI semantic analysis failed, using fallback:',
        error instanceof Error ? error.message : error,
      );
      // Fallback to basic keyword extraction
      return this.extractBasicKeywords(content);
    }
  }

  /**
   * Fallback method for basic keyword extraction if AI fails
   */
  private extractBasicKeywords(content: string): {
    primaryKeywords: string[];
    gearMentions: string[];
    contexts: Array<{ phrase: string; context: string; position: number }>;
  } {
    const gearPatterns = [
      /\b(?:tent|tents|backpack|backpacks|sleeping bag|hiking boots?|water bottle|headlamp|compass|GPS|stove|cookware|jacket|pants|gloves|hat|socks|trekking poles?|first aid kit|rain gear|fleece|down jacket|trail runners?)\b/gi,
    ];

    const primaryKeywords: string[] = [];
    const gearMentions: string[] = [];
    const contexts: Array<{ phrase: string; context: string; position: number }> = [];

    gearPatterns.forEach((pattern) => {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const phrase = match[0];
        const position = match.index;
        const context = content.slice(
          Math.max(0, position - 25),
          Math.min(content.length, position + phrase.length + 25),
        );

        primaryKeywords.push(phrase.toLowerCase());
        gearMentions.push(phrase);
        contexts.push({ phrase, context, position });
      }
    });

    return {
      primaryKeywords: [...new Set(primaryKeywords)].slice(0, 10),
      gearMentions: [...new Set(gearMentions)],
      contexts,
    };
  }

  /**
   * Search for relevant catalog items using vector search
   */
  private async findRelevantCatalogItems(semanticAnalysis: {
    primaryKeywords: string[];
    gearMentions: string[];
    contexts: Array<{ phrase: string; context: string; position: number }>;
  }): Promise<Array<CatalogItem & { similarity: number }>> {
    const searchQueries = [
      ...semanticAnalysis.primaryKeywords.slice(0, 5), // Top 5 keywords
      ...semanticAnalysis.gearMentions.slice(0, 3), // Top 3 gear mentions
    ];

    const allResults: Array<CatalogItem & { similarity: number }> = [];

    for (const query of searchQueries) {
      try {
        const result = await this.catalogAPI.vectorSearch(query, 10);
        allResults.push(
          ...result.items.filter((item) => item.similarity >= this.options.minSimilarityThreshold),
        );
      } catch (error) {
        console.error(`Error searching for "${query}":`, error);
      }
    }

    // Remove duplicates and sort by similarity
    const uniqueResults = new Map<number, CatalogItem & { similarity: number }>();
    allResults.forEach((item) => {
      const existing = uniqueResults.get(item.id);
      if (!existing || item.similarity > existing.similarity) {
        uniqueResults.set(item.id, item);
      }
    });

    return Array.from(uniqueResults.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.options.maxLinksPerArticle * 2); // Get more than needed for selection
  }

  /**
   * Determine optimal insertion points for catalog items
   */
  private async determineInsertionPoints(
    content: string,
    catalogItems: Array<CatalogItem & { similarity: number }>,
  ): Promise<CatalogLinkMatch[]> {
    const matches: CatalogLinkMatch[] = [];

    for (const item of catalogItems) {
      const insertionPoints = this.findInsertionPointsForItem(content, item);
      const contextualPhrases = this.generateContextualPhrases(item);

      if (insertionPoints.length > 0) {
        matches.push({
          item,
          contextualPhrases,
          insertionPoints: insertionPoints.sort((a, b) => b.confidence - a.confidence),
        });
      }
    }

    return matches.sort((a, b) => {
      // Sort by combination of similarity and confidence
      const aScore = a.item.similarity * (a.insertionPoints[0]?.confidence || 0);
      const bScore = b.item.similarity * (b.insertionPoints[0]?.confidence || 0);
      return bScore - aScore;
    });
  }

  /**
   * Find specific insertion points for a catalog item in the content
   */
  private findInsertionPointsForItem(
    content: string,
    item: CatalogItem & { similarity: number },
  ): InsertionPoint[] {
    const insertionPoints: InsertionPoint[] = [];
    const itemKeywords = [
      item.name.toLowerCase(),
      ...(item.categories || []).map((c) => c.toLowerCase()),
      item.brand?.toLowerCase() || '',
    ].filter(Boolean);

    // Look for direct mentions or related context
    const patterns = [
      // Direct product mentions
      new RegExp(`\\b(?:${itemKeywords.join('|')})\\b`, 'gi'),
      // Generic gear type mentions that could match item categories
      ...itemKeywords.map((keyword) => new RegExp(`\\b${keyword}\\w*\\b`, 'gi')),
    ];

    patterns.forEach((pattern) => {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const position = match.index;
        const context = content.slice(
          Math.max(0, position - this.options.contextWindowSize / 2),
          Math.min(content.length, position + this.options.contextWindowSize / 2),
        );

        // Calculate confidence based on context relevance
        const confidence = this.calculateInsertionConfidence(context, item, match[0]);

        if (confidence > 0.3) {
          // Minimum confidence threshold
          insertionPoints.push({
            position,
            context,
            confidence,
            linkText: this.generateLinkText(item, match[0]),
          });
        }
      }
    });

    return insertionPoints;
  }

  /**
   * Calculate confidence score for inserting a link at a specific position
   */
  private calculateInsertionConfidence(
    context: string,
    item: CatalogItem & { similarity: number },
    matchedText: string,
  ): number {
    let confidence = item.similarity; // Start with vector similarity

    // Boost confidence for exact name matches
    if (matchedText.toLowerCase() === item.name.toLowerCase()) {
      confidence += 0.2;
    }

    // Boost for brand matches
    if (item.brand && context.toLowerCase().includes(item.brand.toLowerCase())) {
      confidence += 0.1;
    }

    // Boost for category context
    const categoryContext = (item.categories || []).some((category) =>
      context.toLowerCase().includes(category.toLowerCase()),
    );
    if (categoryContext) {
      confidence += 0.1;
    }

    // Penalize if already many links nearby
    const linkDensity = (context.match(/\[.*?\]\(.*?\)/g) || []).length;
    if (linkDensity > 2) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate appropriate link text for a catalog item
   */
  private generateLinkText(
    item: CatalogItem & { similarity: number },
    originalText: string,
  ): string {
    // Use original text if it's close to item name
    if (originalText.toLowerCase().includes(item.name.toLowerCase().slice(0, 5))) {
      return originalText;
    }

    // Generate contextual link text
    if (item.brand && item.model) {
      return `${item.brand} ${item.model}`;
    }

    return item.name;
  }

  /**
   * Generate contextual phrases for better matching
   */
  private generateContextualPhrases(item: CatalogItem & { similarity: number }): string[] {
    const phrases = [item.name];

    if (item.brand) {
      phrases.push(item.brand);
      if (item.model) {
        phrases.push(`${item.brand} ${item.model}`);
      }
    }

    if (item.categories) {
      phrases.push(...item.categories);
    }

    return [...new Set(phrases)];
  }

  /**
   * Insert contextual links into the content
   */
  private async insertContextualLinks(
    content: string,
    linkMatches: CatalogLinkMatch[],
  ): Promise<string> {
    // Take only the best matches up to the limit
    const selectedMatches = linkMatches.slice(0, this.options.maxLinksPerArticle);

    // Sort by position (descending) so we can insert from end to beginning
    // This prevents position shifts from affecting later insertions
    const sortedInsertions = selectedMatches
      .filter((match) => match.insertionPoints.length > 0)
      .map((match) => ({
        position: match.insertionPoints[0].position,
        originalText: match.contextualPhrases[0] || match.item.name,
        linkText: match.insertionPoints[0].linkText,
        item: match.item,
      }))
      .sort((a, b) => b.position - a.position);

    let enhancedContent = content;

    for (const insertion of sortedInsertions) {
      // Find the exact text to replace at the position
      const afterText = enhancedContent.slice(insertion.position);

      // Find the text to replace
      const textToReplace = insertion.linkText;
      const textIndex = afterText.toLowerCase().indexOf(textToReplace.toLowerCase());

      if (textIndex === -1) continue; // Skip if text not found

      const actualPosition = insertion.position + textIndex;
      const actualText = enhancedContent.slice(
        actualPosition,
        actualPosition + textToReplace.length,
      );

      // Create the markdown link
      const link = `[${actualText}](${insertion.item.productUrl || '#'})`;

      // Insert the link
      enhancedContent =
        enhancedContent.slice(0, actualPosition) +
        link +
        enhancedContent.slice(actualPosition + textToReplace.length);
    }

    return enhancedContent;
  }
}

/**
 * Utility function to create a catalog API client for the blender
 */
export function createCatalogAPI(apiBaseUrl: string, apiKey?: string): CatalogSearchAPI {
  return {
    async vectorSearch(query: string, limit = 10) {
      const url = new URL('/api/catalog/vector-search', apiBaseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', limit.toString());

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return await response.json();
    },
  };
}

/**
 * Factory function to create a configured catalog link blender
 */
export function createCatalogLinkBlender(
  apiBaseUrl: string,
  apiKey?: string,
  options?: BlendingOptions,
): CatalogLinkBlender {
  const catalogAPI = createCatalogAPI(apiBaseUrl, apiKey);
  return new CatalogLinkBlender(catalogAPI, options);
}
