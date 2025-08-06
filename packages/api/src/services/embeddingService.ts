import { createOpenAI } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { DEFAULT_MODELS } from '../utils/ai/models';

type GenerateEmbeddingBaseParams = {
  openAiApiKey: string;
};

type GenerateEmbeddingParams = GenerateEmbeddingBaseParams & {
  value: string;
};

export const generateEmbedding = async ({
  openAiApiKey,
  value,
}: GenerateEmbeddingParams): Promise<number[]> => {
  const openai = createOpenAI({
    apiKey: openAiApiKey,
  });

  // OpenAI recommends replacing newlines with spaces for best results
  const input = value.replace(/\n/g, ' ');

  const { embedding } = await embed({
    model: openai.embedding(DEFAULT_MODELS.EMBEDDING.NAME),
    value: input,
  });

  return embedding;
};

type GenerateManyEmbeddingsParams = GenerateEmbeddingBaseParams & {
  values: string[];
};

export const generateManyEmbeddings = async ({
  openAiApiKey,
  values,
}: GenerateManyEmbeddingsParams): Promise<number[][]> => {
  const openai = createOpenAI({
    apiKey: openAiApiKey,
  });

  const { embeddings } = await embedMany({
    model: openai.embedding(DEFAULT_MODELS.EMBEDDING.NAME),
    values,
  });

  return embeddings;
};
