import { createOpenAI } from '@ai-sdk/openai';
import { createDb } from '@packrat/api/db';
import {
  type NewPack,
  type NewPackItem,
  type PackWithItems,
  packItems,
  packs,
} from '@packrat/api/db/schema';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateObject } from 'ai';
import { and, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { computePackWeights } from '../utils/compute-pack';
import { CatalogService } from './catalogService';

const PACK_CONCEPTS_SYSTEM_PROMPT = `You are an expert Adventure Planner specializing in real-world outdoor and travel experiences. When given a specific count, generate that exact number of unique, practical adventure concepts that people can actually undertake. Each concept should include a name, a description, category, tags and a list of the logical items needed. Items should be rich descriptions optimized for a vector search against an items catalog to find the most suitable real-world item.`;

const packItemConceptSchema = z.object({
  item: z.string(),
  quantity: z.number().int().positive().default(1),
  category: z.string(),
  consumable: z.boolean().default(false).describe('Whether the item is consumable'),
  worn: z.boolean().default(false).describe('Whether the item is worn'),
  notes: z.string().nullable().optional(),
});

const packConceptSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()).optional(),
  items: z.array(packItemConceptSchema),
});

type PackConcept = z.infer<typeof packConceptSchema>;
type PackItemConceptSchema = z.infer<typeof packItemConceptSchema>;

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
    if (count < 1) {
      throw new Error('Count must be a positive integer');
    }

    // 1. Generate pack concepts
    const concepts = await this.generatePackConcepts(count);

    // 2. Search catalog for items
    const packsResult = await Promise.allSettled(
      concepts.map(async (concept) => {
        const packItems = await this.getItems(concept.items);
        return {
          ...concept,
          items: packItems,
        };
      }),
    );

    // 3. Save the packs to db
    const createdPacks = await this.db.transaction(async (tx) => {
      const packsToInsert: NewPack[] = [];
      const itemsToInsert: NewPackItem[] = [];
      for (const packResult of packsResult) {
        if (packResult.status === 'rejected') {
          continue;
        }
        const pack = packResult.value;
        const packId = crypto.randomUUID();
        packsToInsert.push({
          id: packId,
          userId: this.userId,
          name: pack.name,
          description: pack.description,
          category: pack.category,
          tags: pack.tags,
          isPublic: true,
          isAIGenerated: true,
          localCreatedAt: new Date(),
          localUpdatedAt: new Date(),
        });

        itemsToInsert.push(
          ...pack.items.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
            packId,
            isAIGenerated: true,
            userId: this.userId,
          })),
        );
      }

      const createdPacks = await tx.insert(packs).values(packsToInsert).returning();

      await tx.insert(packItems).values(itemsToInsert);

      return createdPacks;
    });

    return createdPacks;
  }

  private async generatePackConcepts(count: number): Promise<PackConcept[]> {
    const { OPENAI_API_KEY } = getEnv(this.c);
    const openai = createOpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const { object } = await generateObject({
      model: openai(DEFAULT_MODELS.OPENAI_CHAT),
      output: 'array',
      schema: packConceptSchema,
      system: PACK_CONCEPTS_SYSTEM_PROMPT,
      prompt: `${count}`,
      temperature: 0.8,
    });

    return object;
  }

  private async getItems(
    packItemConcepts: PackItemConceptSchema[],
  ): Promise<Omit<NewPackItem, 'id' | 'userId' | 'packId'>[]> {
    const catalogService = new CatalogService(this.c);
    const searchResults = await catalogService.batchVectorSearch(
      packItemConcepts.map((item) => item.item),
      1,
    );

    return packItemConcepts
      .map((item, idx) => {
        const catalogItem = searchResults.items[idx]?.[0];
        if (!catalogItem) {
          return null;
        }

        return {
          ...item,
          catalogItemId: catalogItem.id,
          name: catalogItem.name,
          description: catalogItem.description,
          weight: catalogItem.weight,
          weightUnit: catalogItem.weightUnit,
          image: catalogItem.images?.[0],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }
}
