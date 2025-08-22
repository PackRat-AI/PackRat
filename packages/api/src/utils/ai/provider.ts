import type { OpenAIProvider } from '@ai-sdk/openai';
import { createOpenAI } from '@ai-sdk/openai';
// import type { createWorkersAI } from 'workers-ai-provider';

export type AIProvider = 'openai' | 'cloudflare-workers-ai';

interface BaseProviderConfig {
  openAiApiKey: string;
  cloudflareAccountId: string;
  cloudflareGatewayId: string;
}

interface OpenAIProviderConfig extends BaseProviderConfig {
  provider: 'openai';
}

interface WorkersAIProviderConfig extends BaseProviderConfig {
  provider: 'cloudflare-workers-ai';
}

export type AIProviderConfig = OpenAIProviderConfig | WorkersAIProviderConfig;

// Define return type for Workers AI
// type WorkersAIProvider = ReturnType<typeof createWorkersAI>;

type CreateAIProviderReturn = OpenAIProvider;

// Function to create an AI provider based on the config
export function createAIProvider(config: AIProviderConfig): CreateAIProviderReturn {
  const { openAiApiKey, provider, cloudflareAccountId, cloudflareGatewayId } = config;

  // All providers go through Cloudflare Gateway if configured
  if (!cloudflareAccountId || !cloudflareGatewayId) {
    throw new Error('Cloudflare account ID and gateway ID are required');
  }

  // Route through Cloudflare AI Gateway based on provider
  if (provider === 'cloudflare-workers-ai') {
    // Future: When adding Cloudflare Workers AI support
    // return createWorkersAI({
    //   baseURL: `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/workers-ai`,
    // });

    // For now, continue using OpenAI through gateway
    return createOpenAI({
      apiKey: openAiApiKey,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/openai`,
    });
  }

  // OpenAI through Cloudflare Gateway
  if (!openAiApiKey) {
    throw new Error('OpenAI API key is required for OpenAI provider');
  }

  return createOpenAI({
    apiKey: openAiApiKey,
    baseURL: `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/openai`,
  });
}

export function extractCloudflareLogId(headers: Headers): string | null {
  return headers.get('cf-aig-log-id');
}
