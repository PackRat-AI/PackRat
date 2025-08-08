import { createOpenAI } from '@ai-sdk/openai';

export type AIProvider = 'openai' | 'cloudflare-workers-ai';

export interface AIProviderConfig {
  openAiApiKey: string;
  provider?: AIProvider;
  cloudflareAccountId?: string;
  cloudflareGatewayId?: string;
}

export function createAIProvider(config: AIProviderConfig) {
  const { openAiApiKey, provider = 'openai', cloudflareAccountId, cloudflareGatewayId } = config;

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
  return createOpenAI({
    apiKey: openAiApiKey,
    baseURL: `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/openai`,
  });
}

export function extractCloudflareLogId(headers: Headers): string | null {
  return headers.get('cf-aig-log-id');
}
