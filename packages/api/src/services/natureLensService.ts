import { createOpenAI } from '@ai-sdk/openai';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { generateObject } from 'ai';
import { z } from 'zod';

const NATURE_IDENTIFICATION_SYSTEM_PROMPT = `You are an expert naturalist specializing in plant and wildlife identification. 

When analyzing images of plants, animals, birds, insects, or other natural subjects:
- Identify the species as precisely as possible (scientific name preferred when confident)
- Provide the common name
- Categorize as: 'plant', 'animal', 'bird', 'insect', 'fungus', or 'other'
- Include a detailed description of identifying features
- Mention the typical habitat
- Indicate if the species is edible (for plants/fungi) or dangerous/poisonous
- Provide a confidence score (0-1) based on image clarity and distinguishing features

Be thorough but honest about uncertainty. If you cannot identify with reasonable confidence, say so.

For plants: note leaf shape, flower characteristics, growth habit
For animals: note size, coloration, distinctive markings, behavior if visible
For birds: note plumage, beak shape, size, habitat clues
For insects: note body segments, wings, color patterns

Always prioritize safety: clearly mark dangerous/poisonous species.`;

const identificationSchema = z.object({
  speciesName: z.string().describe('Scientific name of the identified species'),
  commonName: z.string().describe('Common name of the species'),
  category: z
    .enum(['plant', 'animal', 'bird', 'insect', 'fungus', 'other'])
    .describe('Category of the species'),
  confidence: z.number().min(0).max(1).describe('Confidence level in the identification (0-1)'),
  description: z.string().describe('Detailed description of identifying features'),
  habitat: z.string().describe('Typical habitat where this species is found'),
  isEdible: z
    .boolean()
    .nullable()
    .describe('Whether the species is edible (null if unknown or not applicable)'),
  isDangerous: z.boolean().describe('Whether the species is dangerous or poisonous'),
  warnings: z.string().nullable().describe('Any warnings about handling or consumption'),
  similarSpecies: z
    .array(z.string())
    .describe('Similar species that might be confused with this one'),
});

export type NatureIdentificationResult = z.infer<typeof identificationSchema>;

export interface IdentifyImageOptions {
  includeDescription?: boolean;
  includeHabitat?: boolean;
  includeEdibleInfo?: boolean;
  includeDangerInfo?: boolean;
  apiKey: string;
}

export async function identifyImage(
  imageUrlOrBase64: string,
  options: IdentifyImageOptions,
): Promise<NatureIdentificationResult> {
  const { apiKey } = options;
  const openai = createOpenAI({ apiKey });

  const { object } = await generateObject({
    model: openai(DEFAULT_MODELS.OPENAI_CHAT),
    schema: identificationSchema,
    system: NATURE_IDENTIFICATION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please identify the plant or wildlife in this image.',
          },
          {
            type: 'image',
            image: imageUrlOrBase64,
          },
        ],
      },
    ],
    temperature: 0.2,
  });

  return object;
}
