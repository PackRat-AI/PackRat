export enum CloudflareAIModels {
  // Text Generation Models
  LLAMA_2_7B_CHAT_INT8 = '@cf/meta/llama-2-7b-chat-int8',
  LLAMA_3_1_70B_INSTRUCT = '@cf/meta/llama-3.1-70b-instruct',

  // Embedding Models
  BGE_BASE_EN_V1_5 = '@cf/baai/bge-base-en-v1.5',
  BGE_LARGE_EN_V1_5 = '@cf/baai/bge-large-en-v1.5',
  BGE_SMALL_EN_V1_5 = '@cf/baai/bge-small-en-v1.5',
  BGE_M3 = '@cf/baai/bge-m3',
}

export enum OpenAIModels {
  // Chat Models
  GPT_4O = 'gpt-4o',
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_3_5_TURBO = 'gpt-3.5-turbo',

  // Embedding Models
  TEXT_EMBEDDING_3_SMALL = 'text-embedding-3-small',
  TEXT_EMBEDDING_3_LARGE = 'text-embedding-3-large',
  TEXT_EMBEDDING_ADA_002 = 'text-embedding-ada-002',
}

// Default models for each use case
export const DEFAULT_MODELS = {
  CHAT: OpenAIModels.GPT_4O,
  EMBEDDING: OpenAIModels.TEXT_EMBEDDING_3_SMALL,
} as const;
