// Client-side utility for calling the catalog search API optimized for guides

export interface CatalogItemLink {
  id: number;
  name: string;
  productUrl: string;
  brand?: string | null;
  categories?: string[] | null;
  price?: number | null;
  ratingValue?: number | null;
}

export interface GuideCatalogSearchResult {
  items: CatalogItemLink[];
  query: string;
  total: number;
}

export interface CatalogSearchOptions {
  limit?: number;
  category?: string;
  minRating?: number;
}

/**
 * Search catalog items via API for guide generation
 */
export async function searchCatalogForGuides(
  query: string,
  options: CatalogSearchOptions = {},
): Promise<GuideCatalogSearchResult> {
  // Build query parameters
  const params = new URLSearchParams();
  params.append('q', query);
  
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options.category) {
    params.append('category', options.category);
  }
  if (options.minRating) {
    params.append('minRating', options.minRating.toString());
  }

  // Get API base URL from environment or default to local
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787';
  const url = `${apiBaseUrl}/api/catalog/guides/search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Note: In development, authentication might not be available
        // For production, proper auth headers would be required
      },
    });

    if (!response.ok) {
      // If API is not available, return empty results gracefully
      if (response.status === 404 || response.status >= 500) {
        console.warn('Catalog API not available, returning empty results');
        return {
          items: [],
          query,
          total: 0,
        };
      }
      
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result: GuideCatalogSearchResult = await response.json();
    return result;
  } catch (error) {
    console.warn('Error calling catalog search API:', error);
    
    // Return empty results gracefully if API is unavailable
    // This allows development to continue even without the API running
    return {
      items: [],
      query,
      total: 0,
    };
  }
}

/**
 * Search for multiple terms at once via API
 */
export async function batchSearchCatalogForGuides(
  queries: string[],
  options: CatalogSearchOptions = {},
): Promise<Record<string, GuideCatalogSearchResult>> {
  const results: Record<string, GuideCatalogSearchResult> = {};
  
  // Execute searches in parallel for better performance
  const searchPromises = queries.map(async (query) => {
    const result = await searchCatalogForGuides(query, options);
    return { query, result };
  });
  
  const searchResults = await Promise.allSettled(searchPromises);
  
  searchResults.forEach((promiseResult) => {
    if (promiseResult.status === 'fulfilled') {
      const { query, result } = promiseResult.value;
      results[query] = result;
    } else {
      console.warn('Batch search failed for a query:', promiseResult.reason);
    }
  });
  
  return results;
}

/**
 * Extract potential gear mentions from guide content for automatic linking
 */
export function extractGearTerms(content: string): string[] {
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
export function formatCatalogLink(item: CatalogItemLink, linkText?: string): string {
  const displayText = linkText || item.name;
  const brandInfo = item.brand ? ` by ${item.brand}` : '';
  const title = `${item.name}${brandInfo}`;
  
  return `[${displayText}](${item.productUrl} "${title}")`;
}

/**
 * Create a formatted list of recommended items for guide content
 */
export function formatRecommendationsList(
  items: CatalogItemLink[], 
  title: string = 'Recommended Gear'
): string {
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