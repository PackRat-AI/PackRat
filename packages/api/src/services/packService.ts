import { createOpenAI } from '@ai-sdk/openai';
import { createDb } from '@packrat/api/db';
import { type CatalogItem, type PackWithItems, packItems, packs } from '@packrat/api/db/schema';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { generateObject } from 'ai';
import { and, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { env } from 'hono/adapter';
import { z } from 'zod';
import { computePackWeights } from '../utils/compute-pack';
import { CatalogService } from './catalogService';

const packConceptSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  items: z.array(z.string()),
});

type PackConcept = z.infer<typeof packConceptSchema>;

type SemanticSearchResult = (CatalogItem & { similarity: number })[][];

type ConstructedPack = Omit<PackConcept, 'items'> & {
  items: CatalogItem[];
};

export class PackService {
  private db;
  private userId: number;
  private readonly c: Context;

  constructor(c: Context, userId: number) {
    this.db = createDb(c);
    this.userId = userId;
    this.c = c;
  }

  async getPackDetails(packId: string): Promise<PackWithItems | null> {
    const pack = await this.db.query.packs.findFirst({
      where: and(eq(packs.id, packId), eq(packs.userId, this.userId), eq(packs.deleted, false)),
      with: {
        items: {
          where: eq(packItems.deleted, false),
          with: {
            catalogItem: true,
          },
        },
      },
    });

    if (!pack) {
      return null;
    }

    return computePackWeights(pack);
  }

  async generatePacks(count: number) {
    if (count <= 0) {
      throw new Error('Count must be a positive integer');
    }
    // 1. Generate pack concepts
    const concepts = await this.generatePackConcepts(count);

    // 2. Search and Construct
    const constructedPacks = await Promise.all(
      concepts.map(async (concept) => {
        const searchResults = await this.searchCatalog(concept.items);
        return this.constructPack(concept, searchResults);
      }),
    );

    return constructedPacks;
  }

  private async generatePackConcepts(count: number): Promise<PackConcept[]> {
    const openai = createOpenAI({
      apiKey: env(this.c).OPENAI_API_KEY,
    });

    const { object } = await generateObject({
      model: openai(DEFAULT_MODELS.CHAT),
      schema: z.object({
        packs: z.array(packConceptSchema),
      }),
      prompt: `Generate ${count} creative concepts for a pack. Each concept should include a name, a description, category, tags and a list of complete logical items.`,
    });

    return object.packs;
  }

  private async searchCatalog(items: string[]): Promise<SemanticSearchResult> {
    const catalogService = new CatalogService(this.c, true);
    const searchResults = await catalogService.batchSemanticSearch(items);
    return searchResults.items;
  }

  private constructPack(
    concept: PackConcept,
    searchResults: SemanticSearchResult,
  ): ConstructedPack {
    return {
      ...concept,
      items: searchResults.flat(),
    };
  }
}
