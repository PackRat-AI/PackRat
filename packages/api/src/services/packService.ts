import { createOpenAI } from '@ai-sdk/openai';
import { createDb } from '@packrat/api/db';
import {
  type CatalogItem,
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
import { env } from 'hono/adapter';
import { z } from 'zod';
import { computePackWeights } from '../utils/compute-pack';
import { CatalogService } from './catalogService';

const PACK_CONCEPTS_SYSTEM_PROMPT = `You are an expert Adventure Planner specializing in real-world outdoor and travel experiences. When given a specific count, generate that exact number of unique, practical adventure concepts that people can actually undertake. Each concept should include a name, a description, category, tags and a list of rich descriptive strings for the logical items needed. These descriptions should be optimized for a vector search against an items catalog to find the most suitable real-world item.`;

const PACKS_CONSTRUCTION_SYSTEM_PROMPT = `You are an expert Adventure Planner. Your task is to turn a rough concept for a pack into a finalize pack with real items.
              I'll provide you with pack concepts where each includes:
              - A pack name and a description.
              - A list of items, where each has a requestedItem description.
              - A list of candidate items for each request, with details like price, weight, rating, tech specs, etc.
              Your job is to select the best candidate items for each requested item, ensuring the final pack meets the concept.`;

const packConceptSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()).optional(),
  items: z.array(z.string()),
});

type PackConcept = z.infer<typeof packConceptSchema>;

type PackConceptWithCandidateItems = Omit<PackConcept, 'items'> & {
  items: {
    requestedItem: string;
    candidateItems: (Omit<CatalogItem, 'reviews' | 'embedding'> & { similarity: number })[];
  }[];
};

const itemSchema = z.object({
  catalogItemId: z.number().int(),
  name: z.string(),
  description: z.string().nullable().optional(),
  weight: z.number().nonnegative(),
  weightUnit: z.enum(['g', 'oz', 'kg', 'lb']),
  quantity: z.number().int().positive().default(1),
  category: z.string(),
  consumable: z.boolean().default(false).describe('Whether the item is consumable'),
  worn: z.boolean().default(false).describe('Whether the item is worn'),
  notes: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

const finalPackSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()).optional(),
  items: z.array(itemSchema),
});

type FinalPack = z.infer<typeof finalPackSchema>;

type SemanticSearchResult = (CatalogItem & { similarity: number })[][];

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

    // 2. Search catalog for candidate items
    const packConceptsWithCandidateItems = await Promise.all(
      concepts.map(async (concept) => {
        const searchResults = await this.searchCatalog(concept.items);
        return {
          ...concept,
          items: concept.items.map((item, idx) => ({
            requestedItem: item,
            candidateItems:
              searchResults[idx]?.map((item) => {
                const { reviews: _reviews, ...rest } = item; // remove unhelpful fields to manage context
                return rest;
              }) ?? [],
          })),
        };
      }),
    );

    // 3. Select best items for each concept
    const finalPacks = await this.constructPacks(packConceptsWithCandidateItems);

    // 4. Save the packs to db
    const createdPacks = await this.db.transaction(async (tx) => {
      const packsToInsert: NewPack[] = [];
      const itemsToInsert: NewPackItem[] = [];
      for (const pack of finalPacks) {
        const packId = crypto.randomUUID();
        packsToInsert.push({
          id: packId,
          userId: this.userId,
          name: pack.name,
          description: pack.description,
          category: pack.category,
          tags: pack.tags,
          isPublic: true,
          localCreatedAt: new Date(),
          localUpdatedAt: new Date(),
        });

        itemsToInsert.push(
          ...pack.items.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
            packId,
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
    });

    return object;
  }

  private async searchCatalog(items: string[]): Promise<SemanticSearchResult> {
    const catalogService = new CatalogService(this.c);
    const searchResults = await catalogService.batchSemanticSearch(items);
    // Map each group to add the missing fields back
    return searchResults.items.map((group) =>
      group.map((item) => ({
        id: item.id,
        name: item.name,
        productUrl: item.productUrl,
        sku: item.sku,
        weight: item.weight,
        weightUnit: item.weightUnit,
        description: item.description,
        categories: item.categories,
        images: item.images,
        brand: item.brand,
        model: item.model,
        ratingValue: item.ratingValue,
        color: item.color,
        size: item.size,
        price: item.price,
        availability: item.availability,
        seller: item.seller,
        productSku: item.productSku,
        material: item.material,
        currency: item.currency,
        condition: item.condition,
        reviewCount: item.reviewCount,
        variants: item.variants,
        techs: item.techs,
        links: item.links,
        reviews: item.reviews,
        qas: item.qas,
        faqs: item.faqs,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        embedding: null,
        similarity: item.similarity,
      })),
    );
  }

  private async constructPacks(
    packConceptsWithCandidateItems: PackConceptWithCandidateItems[],
  ): Promise<FinalPack[]> {
    const openai = createOpenAI({
      apiKey: env(this.c).OPENAI_API_KEY,
    });

    const { object } = await generateObject({
      model: openai(DEFAULT_MODELS.OPENAI_CHAT),
      output: 'array',
      schema: finalPackSchema,
      system: PACKS_CONSTRUCTION_SYSTEM_PROMPT,
      prompt: JSON.stringify(packConceptsWithCandidateItems),
    });

    return object;
  }
}
