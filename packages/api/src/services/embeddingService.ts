import { type AIProvider, createAIProvider } from '@packrat/api/utils/ai/provider';
import { embed, embedMany } from 'ai';

type GenerateEmbeddingBaseParams = {
  openAiApiKey: string;
  provider: AIProvider;
  cloudflareAccountId: string;
  cloudflareGatewayId: string;
};

type GenerateEmbeddingParams = GenerateEmbeddingBaseParams & {
  value: string;
};

export const generateEmbedding = async (params: GenerateEmbeddingParams): Promise<number[]> => {
  const { value, ...providerConfig } = params;
  const aiProvider = createAIProvider(providerConfig);

  // OpenAI recommends replacing newlines with spaces for best results
  const input = value.replace(/\n/g, ' ');

  const { embedding } = await embed({
    model: aiProvider.embedding('text-embedding-3-small'),
    value: input,
  });

  return embedding;
};

type GenerateManyEmbeddingsParams = GenerateEmbeddingBaseParams & {
  values: string[];
};

export const generateManyEmbeddings = async (
  params: GenerateManyEmbeddingsParams,
): Promise<number[][]> => {
  const { values, ...providerConfig } = params;
  const aiProvider = createAIProvider(providerConfig);

  const { embeddings } = await embedMany({
    model: aiProvider.embedding('text-embedding-3-small'),
    values,
  });

  return embeddings;
};
