/**
 * Enhanced AI configuration using @ax-llm/ax features
 * This file provides optimized settings for different AI operations
 */

export interface AxAIConfigOptions {
  enableRetries?: boolean;
  maxRetries?: number;
  timeout?: number;
  enableCaching?: boolean;
}

/**
 * Configuration for chat streaming operations
 * Optimized for real-time user interaction
 */
export const AX_CHAT_CONFIG: AxAIConfigOptions = {
  enableRetries: true,
  maxRetries: 3,
  timeout: 30000, // 30 seconds for chat responses
};

/**
 * Configuration for pack generation operations
 * Optimized for complex AI generation tasks
 */
export const AX_PACK_GENERATION_CONFIG: AxAIConfigOptions = {
  enableRetries: true,
  maxRetries: 3,
  timeout: 60000, // 60 seconds for pack generation
};

/**
 * Configuration for search operations
 * Optimized for quick search responses
 */
export const AX_SEARCH_CONFIG: AxAIConfigOptions = {
  enableRetries: true,
  maxRetries: 2,
  timeout: 15000, // 15 seconds for search operations
};

/**
 * Configuration for embedding operations
 * Optimized for batch processing
 */
export const AX_EMBEDDING_CONFIG: AxAIConfigOptions = {
  enableRetries: true,
  maxRetries: 2,
  timeout: 30000, // 30 seconds for embeddings
};

/**
 * Get optimal Ax configuration based on operation type
 */
export function getAxConfig(
  operationType: 'chat' | 'pack-generation' | 'search' | 'embedding',
): AxAIConfigOptions {
  switch (operationType) {
    case 'chat':
      return AX_CHAT_CONFIG;
    case 'pack-generation':
      return AX_PACK_GENERATION_CONFIG;
    case 'search':
      return AX_SEARCH_CONFIG;
    case 'embedding':
      return AX_EMBEDDING_CONFIG;
    default:
      return AX_CHAT_CONFIG; // Default fallback
  }
}
