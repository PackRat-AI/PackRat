import { CatalogService } from '@packrat/api/services/catalogService';
import type { Env } from '@packrat/api/utils/env-validation';

/**
 * Interface for catalog item results returned to guide generator
 */
export interface CatalogItemLink {
  id: number;
  name: string;
  productUrl: string;
  brand?: string | null;
  categories?: string[] | null;
  price?: number | null;
  ratingValue?: number | null;
}

/**
 * Search result for guides with relevance score
 */
export interface GuideCatalogSearchResult {
  items: CatalogItemLink[];
  query: string;
  total: number;
}

/**
 * Utility class for searching catalog items specifically for guide generation
 * This provides a simplified interface optimized for generating guide content
 */
export class GuideCatalogSearchTool {
  private catalogService: CatalogService;

  constructor(env: Env) {
    this.catalogService = new CatalogService(env, false);
  }

  /**
   * Search catalog items by keyword, optimized for guide generation
   * Returns items with links that can be inserted into guide content
   */
  async searchCatalogForGuides(
    query: string,
    options: {
      limit?: number;
      category?: string;
      minRating?: number;
    } = {},
  ): Promise<GuideCatalogSearchResult> {
    const { limit = 10, category, minRating } = options;

    try {
      // Use semantic search for better results
      const searchResult = await this.catalogService.semanticSearch(query, limit, 0);

      // Filter and transform results for guide generation
      let filteredItems = searchResult.items
        .filter(item => {
          // Filter by category if specified
          if (category && item.categories && !item.categories.includes(category)) {
            return false;
          }
          // Filter by minimum rating if specified
          if (minRating && (!item.ratingValue || item.ratingValue < minRating)) {
            return false;
          }
          // Ensure we have a valid product URL
          if (!item.productUrl) {
            return false;
          }
          return true;
        })
        .map(item => ({
          id: item.id,
          name: item.name,
          productUrl: item.productUrl,
          brand: item.brand,
          categories: item.categories,
          price: item.price,
          ratingValue: item.ratingValue,
        }));

      return {
        items: filteredItems,
        query,
        total: filteredItems.length,
      };
    } catch (error) {
      console.error('Error searching catalog for guides:', error);
      return {
        items: [],
        query,
        total: 0,
      };
    }
  }

  /**
   * Search for multiple terms at once, useful for batch processing guide content
   */
  async batchSearchCatalogForGuides(
    queries: string[],
    options: {
      limit?: number;
      category?: string;
      minRating?: number;
    } = {},
  ): Promise<Record<string, GuideCatalogSearchResult>> {
    const results: Record<string, GuideCatalogSearchResult> = {};
    
    for (const query of queries) {
      results[query] = await this.searchCatalogForGuides(query, options);
    }
    
    return results;
  }

  /**
   * Extract potential gear mentions from guide content for automatic linking
   * This identifies common gear terms that might have catalog matches
   */
  extractGearTerms(content: string): string[] {
    const gearKeywords = [
      // Shelter
      'tent', 'tarp', 'bivy', 'sleeping bag', 'sleeping pad', 'pillow',
      // Cooking
      'stove', 'pot', 'pan', 'mug', 'spork', 'knife', 'water filter', 'water bottle',
      // Clothing
      'jacket', 'pants', 'shirt', 'base layer', 'rain gear', 'boots', 'socks', 'gloves', 'hat',
      // Navigation & Safety
      'compass', 'map', 'gps', 'headlamp', 'flashlight', 'first aid', 'whistle',
      // Tools
      'multi-tool', 'axe', 'saw', 'rope', 'carabiner', 'quickdraw',
      // Electronics
      'phone', 'charger', 'power bank', 'camera', 'watch',
      // Personal Care
      'toothbrush', 'soap', 'sunscreen', 'toilet paper',
    ];

    const foundTerms = new Set<string>();
    const contentLower = content.toLowerCase();

    for (const keyword of gearKeywords) {
      if (contentLower.includes(keyword)) {
        foundTerms.add(keyword);
      }
    }

    return Array.from(foundTerms);
  }

  /**
   * Generate markdown links for catalog items
   */
  formatCatalogLink(item: CatalogItemLink, linkText?: string): string {
    const displayText = linkText || item.name;
    const brandInfo = item.brand ? ` by ${item.brand}` : '';
    const title = `${item.name}${brandInfo}`;
    
    return `[${displayText}](${item.productUrl} "${title}")`;
  }

  /**
   * Create a formatted list of recommended items for guide content
   */
  formatRecommendationsList(items: CatalogItemLink[], title: string = 'Recommended Gear'): string {
    if (items.length === 0) {
      return '';
    }

    let markdown = `\n## ${title}\n\n`;
    
    for (const item of items) {
      const brandInfo = item.brand ? ` (${item.brand})` : '';
      const priceInfo = item.price ? ` - $${item.price.toFixed(2)}` : '';
      const ratingInfo = item.ratingValue ? ` ⭐ ${item.ratingValue.toFixed(1)}` : '';
      
      markdown += `- [${item.name}](${item.productUrl})${brandInfo}${priceInfo}${ratingInfo}\n`;
    }
    
    return markdown;
  }
}