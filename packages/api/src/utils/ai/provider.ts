import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { createOpenAI } from '@ai-sdk/openai';
import { createPerplexity, type PerplexityProvider } from '@ai-sdk/perplexity';
import type { Env } from '@packrat/api/utils/env-validation';

export type AIProvider = 'openai' | 'cloudflare-workers-ai';

interface BaseProviderConfig {
  openAiApiKey?: string;
  googleApiKey?: string;
  perplexityApiKey?: string;
  cloudflareAccountId?: string;
  cloudflareGatewayId?: string;
  cloudflareApiToken?: string;
  cloudflareAiBinding: Env['AI'];
}

interface OpenAIProviderConfig extends BaseProviderConfig {
  provider: 'openai';
}

interface WorkersAIProviderConfig extends BaseProviderConfig {
  provider: 'cloudflare-workers-ai';
}

export type AIProviderConfig = OpenAIProviderConfig | WorkersAIProviderConfig;

type CreateAIProviderReturn = OpenAIProvider;

export type ProviderBillingPath =
  | 'cloudflare-unified'
  | 'cloudflare-gateway-byok'
  | 'direct-provider';
export type AIBillingPath = Extract<ProviderBillingPath, 'cloudflare-unified' | 'direct-provider'>;
export type GoogleBillingPath = AIBillingPath;

export function getAIBillingPath(config: BaseProviderConfig): AIBillingPath {
  if (config.cloudflareAccountId && config.cloudflareGatewayId && config.cloudflareApiToken) {
    return 'cloudflare-unified';
  }

  return 'direct-provider';
}

export function getGoogleBillingPath(config: BaseProviderConfig): GoogleBillingPath {
  if (config.cloudflareAccountId && config.cloudflareGatewayId && config.cloudflareApiToken) {
    return 'cloudflare-unified';
  }

  return 'direct-provider';
}

const providerSelectionLogKeys = new Set<string>();

function logProviderSelectionOnce({
  provider,
  billingPath,
  cloudflareGatewayId,
  configuredProvider,
}: {
  provider: string;
  billingPath: string;
  cloudflareGatewayId?: string;
  configuredProvider?: string;
}): void {
  const logKey = `${provider}:${configuredProvider ?? provider}:${billingPath}:${cloudflareGatewayId ?? ''}`;
  if (providerSelectionLogKeys.has(logKey)) return;
  providerSelectionLogKeys.add(logKey);

  console.info('ai.provider.selected', {
    provider,
    configuredProvider,
    billingPath,
    cloudflareGatewayId,
  });
}

// Function to create an AI provider based on the config
export function createAIProvider(config: AIProviderConfig): CreateAIProviderReturn {
  const { openAiApiKey, provider, cloudflareAccountId, cloudflareGatewayId, cloudflareApiToken } =
    config;
  const billingPath = getAIBillingPath(config);

  if (provider !== 'openai') {
    console.warn('ai.provider.unsupported_openai_path', {
      configuredProvider: provider,
      billingPath,
    });
    throw new Error(`Unsupported AI_PROVIDER "${provider}" for OpenAI-backed provider path`);
  }

  logProviderSelectionOnce({
    provider: 'openai',
    billingPath,
    cloudflareGatewayId: billingPath === 'cloudflare-unified' ? cloudflareGatewayId : undefined,
    configuredProvider: provider,
  });

  if (billingPath === 'cloudflare-unified') {
    return createOpenAI({
      apiKey: cloudflareApiToken,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/openai`,
    });
  }

  if (!openAiApiKey) {
    throw new Error(
      'OpenAI API key is required when Cloudflare AI Gateway unified billing is not configured',
    );
  }

  // Direct OpenAI fallback for local development and emergency rollback.
  return createOpenAI({
    apiKey: openAiApiKey,
  });
}

export function createGoogleAIProvider(config: BaseProviderConfig): GoogleGenerativeAIProvider {
  const { googleApiKey, cloudflareAccountId, cloudflareGatewayId, cloudflareApiToken } = config;
  const billingPath = getGoogleBillingPath(config);

  logProviderSelectionOnce({
    provider: 'google-ai-studio',
    billingPath,
    cloudflareGatewayId: billingPath === 'cloudflare-unified' ? cloudflareGatewayId : undefined,
  });

  if (billingPath === 'cloudflare-unified') {
    return createGoogleGenerativeAI({
      apiKey: cloudflareApiToken,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/google-ai-studio`,
    });
  }

  if (!googleApiKey) {
    throw new Error(
      'Google Generative AI API key is required when Cloudflare AI Gateway unified billing is not configured',
    );
  }

  return createGoogleGenerativeAI({ apiKey: googleApiKey });
}

export type PerplexityBillingPath = Extract<
  ProviderBillingPath,
  'cloudflare-gateway-byok' | 'direct-provider'
>;

export function getPerplexityBillingPath(config: BaseProviderConfig): PerplexityBillingPath {
  if (config.cloudflareAccountId && config.cloudflareGatewayId && config.cloudflareApiToken) {
    return 'cloudflare-gateway-byok';
  }

  return 'direct-provider';
}

export function createPerplexityAIProvider(config: BaseProviderConfig): PerplexityProvider {
  const { perplexityApiKey, cloudflareAccountId, cloudflareGatewayId, cloudflareApiToken } = config;
  const billingPath = getPerplexityBillingPath(config);

  if (!perplexityApiKey) {
    throw new Error('PERPLEXITY_API_KEY is required for Perplexity search');
  }

  logProviderSelectionOnce({
    provider: 'perplexity',
    billingPath,
    cloudflareGatewayId:
      billingPath === 'cloudflare-gateway-byok' ? cloudflareGatewayId : undefined,
  });

  if (billingPath === 'cloudflare-gateway-byok') {
    return createPerplexity({
      apiKey: perplexityApiKey,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/perplexity-ai`,
      headers: {
        'cf-aig-authorization': `Bearer ${cloudflareApiToken}`,
      },
    });
  }

  return createPerplexity({ apiKey: perplexityApiKey });
}

export function extractCloudflareLogId(headers: Headers): string | null {
  return headers.get('cf-aig-log-id');
}
