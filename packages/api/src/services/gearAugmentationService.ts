import { openai } from '@ai-sdk/openai';
import { createDb, createDbClient } from '@packrat/api/db';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateObject } from 'ai';
import type { Context } from 'hono';
import { z } from 'zod';
import { CatalogService } from './catalogService';

// Types based on our schemas
interface GearMention {
  item: string;
  category?: string;
  context?: string;
}

interface ProductLink {
  id: number;
  name: string;
  productUrl: string;
  price?: number | null;
  brand?: string | null;
  similarity: number;
  weight?: number;
  weightUnit?: string;
  categories?: string[] | null;
}

interface GearWithLinks {
  gear: GearMention;
  products: ProductLink[];
}

interface AugmentationResult {
  extractedGears: GearWithLinks[];
  augmentedContent: string;
  totalProductsAdded: number;
}

const isContext = (contextOrEnv: Context | Env, isContext: boolean): contextOrEnv is Context =>
  isContext;

export class GearAugmentationService {
  private db;
  private env: Env;
  private catalogService: CatalogService;

  constructor(contextOrEnv: Context | Env, isHonoContext: boolean = true) {
    if (isContext(contextOrEnv, isHonoContext)) {
      this.db = createDb(contextOrEnv);
      this.env = getEnv(contextOrEnv);
      this.catalogService = new CatalogService(contextOrEnv);
    } else {
      this.db = createDbClient(contextOrEnv);
      this.env = contextOrEnv;
      this.catalogService = new CatalogService(contextOrEnv, false);
    }
  }

  /**
   * Step 1: Extract gear mentions from content using AI
   */
  async extractGearMentions(content: string): Promise<GearMention[]> {
    if (!content || content.trim() === '') {
      return [];
    }

    try {
      const model = openai('gpt-4o');

      const schema = z.object({
        gears: z.array(
          z.object({
            item: z.string().describe('Name or description of the gear item mentioned'),
            category: z
              .string()
              .optional()
              .describe('Category of the gear item (e.g., shelter, clothing, cooking)'),
            context: z
              .string()
              .optional()
              .describe('Additional context about how the item is used'),
          }),
        ),
      });

      const system = `You are an expert outdoor gear specialist. Your task is to analyze outdoor adventure content and identify all mentions of specific outdoor gear and equipment.

Focus on:
- Specific gear items (tents, backpacks, sleeping bags, boots, etc.)
- Equipment brands and models when mentioned
- Outdoor clothing and accessories
- Cooking and water treatment gear
- Navigation and safety equipment
- Camping and hiking essentials

Ignore:
- General concepts without specific gear (e.g., "being prepared")
- Natural features (mountains, trails, etc.)
- Non-gear items (food, permits, etc.)

For each item, provide:
1. The item name or description as mentioned
2. The category it belongs to
3. Any additional context about its use

Be precise and avoid duplicates. Focus on actionable gear that someone could purchase.`;

      const prompt = `Please analyze this outdoor adventure guide and extract all the outdoor gear and equipment mentioned:\n\n${content}`;

      const { object } = await generateObject({
        model,
        schema,
        system,
        prompt,
        temperature: 0.3, // Lower temperature for more consistent results
      });

      return object.gears;
    } catch (error) {
      console.error('Error extracting gear mentions:', error);
      throw new Error(
        `Failed to extract gear mentions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 2: Retrieve relevant products from catalog using vector search
   */
  async findProductsForGears(
    gears: GearMention[],
    maxProductsPerGear: number = 3,
    similarityThreshold: number = 0.3,
  ): Promise<GearWithLinks[]> {
    if (!gears || gears.length === 0) {
      return [];
    }

    try {
      // Prepare search queries - combine item name with category and context for better matching
      const searchQueries = gears.map((gear) => {
        let query = gear.item;
        if (gear.category) {
          query += ` ${gear.category}`;
        }
        if (gear.context) {
          query += ` ${gear.context}`;
        }
        return query.trim();
      });

      console.log('Searching for products with queries:', searchQueries);

      // Use batch vector search for efficiency
      const searchResults = await this.catalogService.batchVectorSearch(
        searchQueries,
        maxProductsPerGear,
      );

      // Combine gears with their matching products
      const gearsWithLinks: GearWithLinks[] = gears.map((gear, index) => {
        const products = searchResults.items[index] || [];

        // Filter by similarity threshold and format products
        const filteredProducts: ProductLink[] = products
          .filter((product) => product.similarity >= similarityThreshold)
          .map((product) => ({
            id: product.id,
            name: product.name,
            productUrl: product.productUrl,
            price: product.price,
            brand: product.brand,
            similarity: product.similarity,
            weight: product.weight,
            weightUnit: product.weightUnit,
            categories: product.categories,
          }));

        return {
          gear,
          products: filteredProducts,
        };
      });

      console.log(
        `Found products for ${gearsWithLinks.filter((g) => g.products.length > 0).length}/${gears.length} gear items`,
      );

      return gearsWithLinks;
    } catch (error) {
      console.error('Error finding products for gears:', error);
      throw new Error(
        `Failed to find products: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 3: Augment content with product links
   */
  augmentContentWithProductLinks(
    content: string,
    gearsWithLinks: GearWithLinks[],
  ): { augmentedContent: string; totalProductsAdded: number } {
    let augmentedContent = content;
    let totalProductsAdded = 0;

    for (const gearWithLinks of gearsWithLinks) {
      if (gearWithLinks.products.length === 0) {
        continue;
      }

      const gear = gearWithLinks.gear;
      const products = gearWithLinks.products;

      // Create product links section
      const productLinksHtml = this.createProductLinksHtml(products);

      // Find mentions of this gear item in the content and add links
      const gearItemPattern = new RegExp(
        `\\b${gear.item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'gi',
      );

      // Check if this gear item is mentioned in the content
      if (gearItemPattern.test(content)) {
        // Find a good place to insert product recommendations
        // Try to insert after the paragraph that mentions the gear
        const sentences = augmentedContent.split(/(?<=[.!?])\s+/);
        let insertionPoint = -1;

        for (let i = 0; i < sentences.length; i++) {
          if (gearItemPattern.test(sentences[i])) {
            insertionPoint = i + 1;
            break;
          }
        }

        if (insertionPoint !== -1 && insertionPoint < sentences.length) {
          // Insert product recommendations after the sentence that mentions the gear
          sentences.splice(
            insertionPoint,
            0,
            `\n\n**Recommended ${gear.item}:**\n${productLinksHtml}\n`,
          );
          augmentedContent = sentences.join(' ');
          totalProductsAdded += products.length;
        } else {
          // If we can't find a good insertion point, add to the end of the content
          augmentedContent += `\n\n**Recommended ${gear.item}:**\n${productLinksHtml}\n`;
          totalProductsAdded += products.length;
        }
      }
    }

    return {
      augmentedContent,
      totalProductsAdded,
    };
  }

  /**
   * Create HTML for product links
   */
  private createProductLinksHtml(products: ProductLink[]): string {
    return products
      .map((product) => {
        let linkText = `- **[${product.name}](${product.productUrl})**`;

        if (product.brand) {
          linkText += ` by ${product.brand}`;
        }

        if (product.price) {
          linkText += ` - $${product.price}`;
        }

        if (product.weight && product.weightUnit) {
          linkText += ` (${product.weight}${product.weightUnit})`;
        }

        linkText += ` - Similarity: ${(product.similarity * 100).toFixed(1)}%`;

        return linkText;
      })
      .join('\n');
  }

  /**
   * Main method: Complete augmentation pipeline
   */
  async augmentGuide(
    content: string,
    maxProductsPerGear: number = 3,
    similarityThreshold: number = 0.3,
  ): Promise<AugmentationResult> {
    try {
      console.log('Starting guide augmentation process...');

      // Step 1: Extract gear mentions
      console.log('Step 1: Extracting gear mentions...');
      const gears = await this.extractGearMentions(content);
      console.log(
        `Extracted ${gears.length} gear items:`,
        gears.map((g) => g.item),
      );

      if (gears.length === 0) {
        return {
          extractedGears: [],
          augmentedContent: content,
          totalProductsAdded: 0,
        };
      }

      // Step 2: Find products for each gear item
      console.log('Step 2: Finding relevant products...');
      const gearsWithLinks = await this.findProductsForGears(
        gears,
        maxProductsPerGear,
        similarityThreshold,
      );

      // Step 3: Augment content with product links
      console.log('Step 3: Augmenting content...');
      const { augmentedContent, totalProductsAdded } = this.augmentContentWithProductLinks(
        content,
        gearsWithLinks,
      );

      console.log(`Augmentation complete. Added ${totalProductsAdded} product links.`);

      return {
        extractedGears: gearsWithLinks,
        augmentedContent,
        totalProductsAdded,
      };
    } catch (error) {
      console.error('Error in guide augmentation:', error);
      throw new Error(
        `Guide augmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
