import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import { type AIProvider, createAIProvider } from '@packrat/api/utils/ai/provider';
import type { Env } from '@packrat/api/utils/env-validation';
import { embed, embedMany } from 'ai';

type GenerateEmbeddingBaseParams = {
  openAiApiKey: string;
  provider: AIProvider;
  cloudflareAccountId: string;
  cloudflareGatewayId: string;
  cloudflareAiBinding: Env['AI'];
};

type GenerateEmbeddingParams = GenerateEmbeddingBaseParams & {
  value: string;
};

export const generateEmbedding = async (
  params: GenerateEmbeddingParams,
): Promise<number[] | null> => {
  const { value, ...providerConfig } = params;

  // Guard: skip if no text or only whitespace
  if (!value || !value.trim()) {
    return null;
  }

  const aiProvider = createAIProvider(providerConfig);

  // OpenAI recommends replacing newlines with spaces for best results
  const input = value.replace(/\n/g, ' ');

  const { embedding } = await embed({
    model: aiProvider.embedding(DEFAULT_MODELS.OPENAI_EMBEDDING),
    value: input,
  });

  return embedding;
};

type GenerateManyEmbeddingsParams = GenerateEmbeddingBaseParams & {
  values: string[];
};

export const generateManyEmbeddings = async (
  params: GenerateManyEmbeddingsParams,
): Promise<(number[] | null)[]> => {
  const { values, ...providerConfig } = params;

  // Filter out empty/whitespace-only strings
  const cleanValues = values.map((v) => v?.replace(/\n/g, ' ').trim()).filter(Boolean);
  if (cleanValues.length === 0) {
    return [];
  }

  const aiProvider = createAIProvider(providerConfig);

  const { embeddings } = await embedMany({
    model: aiProvider.embedding(DEFAULT_MODELS.OPENAI_EMBEDDING),
    values: cleanValues,
  });

  return embeddings;
};
