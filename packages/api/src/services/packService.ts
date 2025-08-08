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

const itemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  weight: z.number(),
  weightUnit: z.string(),
  description: z.string().optional(),
  categories: z.array(z.string()).optional(),
  size: z.string().optional(),
  price: z.number().optional(),
  material: z.string().optional(),
  condition: z.string().optional(),
  variants: z
    .array(
      z.object({
        attribute: z.string(),
        values: z.array(z.string()),
      }),
    )
    .optional(),
  techs: z.record(z.string()).optional(),
  qas: z
    .array(
      z.object({
        question: z.string(),
        user: z.string().nullable().optional(),
        date: z.string(),
        answers: z.array(
          z.object({
            a: z.string(),
            date: z.string(),
            user: z.string().nullable().optional(),
            upvotes: z.number().nullable().optional(),
          }),
        ),
      }),
    )
    .optional(),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .optional(),
});

type PackConcept = z.infer<typeof packConceptSchema>;

type SemanticSearchResult = (CatalogItem & { similarity: number })[][];

type PackConceptWithRealItemMatches = Omit<PackConcept, 'items'> & {
  items: {
    requestedItem: string;
    candidateItems: (Omit<CatalogItem, 'reviews' | 'embedding'> & { similarity: number })[];
  }[];
};

type FinalGeneratedPack = Omit<PackConcept, 'items'> & {
  items: Omit<Partial<CatalogItem>, 'reviews' | 'embedding'> &
    { id: number; name: string; weight: number; weightUnit: string }[];
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

    // 2. Search catalog for candidate items
    const packConceptsWithRealItemMatches = await Promise.all(
      concepts.map(async (concept) => {
        const searchResults = await this.searchCatalog(concept.items);
        return {
          ...concept,
          items: concept.items.map((item, idx) => ({
            requestedItem: item,
            candidateItems: searchResults[idx].map((item) => {
              // biome-ignore lint/correctness/noUnusedVariables: removing those fields
              const { reviews, embedding, ...rest } = item;
              return rest;
            }),
          })),
        };
      }),
    );

    // 3. Select best items for each concept
    const finalPacks = await this.constructPacks(packConceptsWithRealItemMatches);

    return finalPacks;
  }

  private async generatePackConcepts(count: number): Promise<PackConcept[]> {
    const openai = createOpenAI({
      apiKey: env(this.c).OPENAI_API_KEY,
    });

    const { object } = await generateObject({
      model: openai(DEFAULT_MODELS.CHAT),
      output: 'array',
      schema: packConceptSchema,
      system: `You are an expert Adventure Planner. Given a count, you generate unique and compelling concepts for those number of packs based on varied scenarios. Each concept should include a name, a description, category, tags and a list of rich descriptive strings for the logical items needed. These descriptions should be optimized for a vector search against an items catalog to find the most suitable real-world item.`,
      prompt: `Generate concepts for ${count} pack${count > 1 ? 's' : ''}.`,
    });

    return object;
  }

  private async searchCatalog(items: string[]): Promise<SemanticSearchResult> {
    const catalogService = new CatalogService(this.c);
    const searchResults = await catalogService.batchSemanticSearch(items);
    return searchResults.items;
  }

  private async constructPacks(
    packConceptsWithRealItemMatches: PackConceptWithRealItemMatches[],
  ): Promise<FinalGeneratedPack[]> {
    const openai = createOpenAI({
      apiKey: env(this.c).OPENAI_API_KEY,
    });

    const { object } = await generateObject({
      model: openai(DEFAULT_MODELS.CHAT),
      output: 'array',
      schema: z.object({
        name: z.string(),
        description: z.string(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        items: z.array(itemSchema),
      }),
      system: `You are an expert Adventure Planner. Your task is to turn a rough concept for a pack into a finalize pack with real items.
              I'll provide you with pack concepts where each includes:
              A pack name and a description.
              A list of items, where each has a requestedItem description.
              A list of candidateItems for each request, with details like price, weight, rating, tech specs, etc.
              Your job is to select the best candidate items for each requested item, ensuring the final pack meets the concept.`,
      prompt: JSON.stringify(packConceptsWithRealItemMatches),
    });

    return object;
  }
}
