import { createOpenAI } from '@ai-sdk/openai';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateObject } from 'ai';
import type { Context } from 'hono';
import { z } from 'zod';

const tiktokItemConceptSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  weight: z.number().min(0).default(0),
  weightUnit: z.enum(['g', 'kg', 'lb', 'oz']).default('g'),
  quantity: z.number().int().positive().default(1),
  category: z.string().nullable().optional(),
  consumable: z.boolean().default(false),
  worn: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

const tiktokPackConceptSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  tags: z.array(z.string()).optional(),
  items: z.array(tiktokItemConceptSchema),
});

export type TiktokPackConcept = z.infer<typeof tiktokPackConceptSchema>;
export type TiktokItemConcept = z.infer<typeof tiktokItemConceptSchema>;

const TIKTOK_EXTRACT_SYSTEM_PROMPT = `You are an expert at analyzing outdoor adventure content from social media. Given a TikTok URL, extract the pack/gear information described in the video. Identify the pack template name, description, category (e.g. hiking, backpacking, camping, climbing, cycling), relevant tags, and a list of gear items with their details. If you cannot determine a specific weight, default to 0. Be specific about item names so they can be matched against a gear catalog.`;

export class TiktokService {
  private readonly c: Context;

  constructor(c: Context) {
    this.c = c;
  }

  async extractPackConcept(url: string): Promise<TiktokPackConcept> {
    const { OPENAI_API_KEY } = getEnv(this.c);
    const openai = createOpenAI({ apiKey: OPENAI_API_KEY });

    const { object } = await generateObject({
      model: openai(DEFAULT_MODELS.OPENAI_CHAT),
      schema: tiktokPackConceptSchema,
      system: TIKTOK_EXTRACT_SYSTEM_PROMPT,
      prompt: `Extract the pack/gear information from this TikTok video URL: ${url}`,
      temperature: 0.3,
    });

    return object;
  }
}
