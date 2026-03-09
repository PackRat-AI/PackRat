import { createOpenAI } from '@ai-sdk/openai';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateObject } from 'ai';
import type { Context } from 'hono';
import { z } from 'zod';

const SPECIES_IDENTIFICATION_SYSTEM_PROMPT = `You are an expert naturalist and wildlife biologist specializing in plant and animal identification.

When analyzing images of plants, animals, fungi, or other natural specimens, identify any species you can see with the following guidelines:
- Provide the common name and scientific name for each species identified
- Specify the category (mammal, bird, reptile, amphibian, insect, plant, flower, tree, mushroom, fish, other)
- Describe key visual characteristics that led to the identification
- Rate the danger level: "safe" (harmless), "caution" (may bite/sting/irritate), "dangerous" (venomous, aggressive, or highly toxic)
- List the typical habitat and regions where this species is found
- Note if the species has any special conservation status
- Provide a confidence score 0-1 based on image clarity and distinguishing features visible
- Include 2-3 interesting facts about the species

Be accurate and safety-conscious - if a species could be dangerous, always mention it clearly.
If the image quality is poor or the subject is ambiguous, reflect this in the confidence score.
Return results ordered from highest to lowest confidence.`;

const speciesResultSchema = z.object({
  commonName: z.string().describe('Common name of the species'),
  scientificName: z.string().describe('Scientific name of the species'),
  category: z
    .enum([
      'mammal',
      'bird',
      'reptile',
      'amphibian',
      'insect',
      'plant',
      'flower',
      'tree',
      'mushroom',
      'fish',
      'other',
    ])
    .describe('Category of the species'),
  description: z.string().describe('Description of the species and key identification features'),
  habitat: z.array(z.string()).describe('Typical habitats'),
  regions: z.array(z.string()).describe('Geographic regions where found'),
  dangerLevel: z.enum(['safe', 'caution', 'dangerous']).describe('Danger level to humans'),
  characteristics: z.array(z.string()).describe('Key visual characteristics'),
  conservationStatus: z.string().optional().describe('IUCN conservation status if applicable'),
  interestingFacts: z.array(z.string()).optional().describe('Interesting facts about the species'),
  confidence: z.number().min(0).max(1).describe('Confidence score for this identification'),
});

const identificationResponseSchema = z.object({
  results: z.array(speciesResultSchema).describe('Identified species ordered by confidence'),
});

export type SpeciesResult = z.infer<typeof speciesResultSchema>;
export type IdentificationResponse = z.infer<typeof identificationResponseSchema>;

export class WildlifeIdentificationService {
  private readonly c: Context;

  constructor(c: Context) {
    this.c = c;
  }

  async identifySpecies(imageUrl: string): Promise<IdentificationResponse> {
    const { OPENAI_API_KEY } = getEnv(this.c);
    const openai = createOpenAI({ apiKey: OPENAI_API_KEY });

    try {
      const { object } = await generateObject({
        model: openai(DEFAULT_MODELS.OPENAI_CHAT),
        schema: identificationResponseSchema,
        system: SPECIES_IDENTIFICATION_SYSTEM_PROMPT,
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please identify all the plant and animal species visible in this image.',
              },
              {
                type: 'image',
                image: imageUrl,
              },
            ],
          },
        ],
        temperature: 0.2,
      });

      return object;
    } catch (error) {
      // Wrap AI SDK errors with context to help distinguish auth, model, and transient failures
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Wildlife identification failed: ${message}`, { cause: error });
    }
  }
}
