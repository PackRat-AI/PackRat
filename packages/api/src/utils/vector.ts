import { createOpenAI } from '@ai-sdk/openai';
import { embed } from 'ai';

export const generateEmbedding = async (
  value: string,
  apiKey: string,
): Promise<number[] | null> => {
  try {
    const input = value.replace(/\n/g, ' ');

    const openai = createOpenAI({
      apiKey,
    });

    const model = openai.embedding('text-embedding-ada-002');

    const result = await embed({
      model,
      value: input,
    });

    // console.log("Embedding result:", result.embedding);

    return result.embedding;
  } catch (e) {
    console.error('Embedding error:', e);
    return null;
  }
};
