import type { OpenAIProvider } from '@ai-sdk/openai';
import { createOpenAI } from '@ai-sdk/openai';
import { ai } from '@ax-llm/ax';
import { AxAIProvider } from '@ax-llm/ax-ai-sdk-provider';
import type { createWorkersAI } from 'workers-ai-provider';
import type { AxAIConfigOptions } from './ax-config';

export type AIProvider = 'openai' | 'cloudflare-workers-ai' | 'ax-openai';

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

interface AxOpenAIProviderConfig extends BaseProviderConfig, AxAIConfigOptions {
  provider: 'ax-openai';
}

export type AIProviderConfig =
  | OpenAIProviderConfig
  | WorkersAIProviderConfig
  | AxOpenAIProviderConfig;

// Define return type for Workers AI
type WorkersAIProvider = ReturnType<typeof createWorkersAI>;

// Function to create an AI provider based on the config
export function createAIProvider(
  config: AIProviderConfig,
): OpenAIProvider | WorkersAIProvider | AxAIProvider {
  const { openAiApiKey, provider, cloudflareAccountId, cloudflareGatewayId } = config;

  // All providers go through Cloudflare Gateway if configured
  if (!cloudflareAccountId || !cloudflareGatewayId) {
    throw new Error('Cloudflare account ID and gateway ID are required');
  }

  // Ax-powered OpenAI provider for enhanced performance
  if (provider === 'ax-openai') {
    const axConfig = config as AxOpenAIProviderConfig;

    // Create Ax AI instance with enhanced capabilities
    const axAI = ai({
      name: 'openai' as const,
      apiKey: openAiApiKey,
      config: {
        apiURL: `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/openai`,
        ...(axConfig.timeout && { timeout: axConfig.timeout }),
      },
      ...(axConfig.enableRetries && {
        options: {
          ...(axConfig.maxRetries && { retry: { maxRetries: axConfig.maxRetries } }),
        },
      }),
    });

    return new AxAIProvider(axAI);
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
