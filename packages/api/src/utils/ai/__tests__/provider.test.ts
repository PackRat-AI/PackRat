import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createPerplexity } from '@ai-sdk/perplexity';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAIProvider,
  createGoogleAIProvider,
  createPerplexityAIProvider,
  getAIBillingPath,
  getGoogleBillingPath,
  getPerplexityBillingPath,
} from '../provider';

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => ({ provider: 'google-ai-studio' })),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({ provider: 'openai' })),
}));

vi.mock('@ai-sdk/perplexity', () => ({
  createPerplexity: vi.fn(() => ({ provider: 'perplexity' })),
}));

const baseConfig = {
  provider: 'openai' as const,
  openAiApiKey: 'sk-test',
  googleApiKey: 'google-test',
  perplexityApiKey: 'pplx-test',
  cloudflareAccountId: 'test-account',
  cloudflareGatewayId: 'test-gateway',
  cloudflareApiToken: 'cf-token',
  cloudflareAiBinding: {} as never,
};

const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('createAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('uses Cloudflare AI Gateway unified billing when Cloudflare config is complete', () => {
    createAIProvider(baseConfig);

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'cf-token',
      baseURL: 'https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/openai',
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith('ai.provider.selected', {
      provider: 'openai',
      configuredProvider: 'openai',
      billingPath: 'cloudflare-unified',
      cloudflareGatewayId: 'test-gateway',
    });
  });

  it('falls back to direct OpenAI when Cloudflare API token is absent', () => {
    createAIProvider({ ...baseConfig, cloudflareApiToken: undefined });

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'sk-test',
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith('ai.provider.selected', {
      provider: 'openai',
      configuredProvider: 'openai',
      billingPath: 'direct-provider',
      cloudflareGatewayId: undefined,
    });
  });

  it('throws a direct OpenAI configuration error when neither path is configured', () => {
    expect(() =>
      createAIProvider({ ...baseConfig, cloudflareApiToken: undefined, openAiApiKey: undefined }),
    ).toThrow('OpenAI API key is required');
  });

  it('throws when a non-OpenAI provider is configured for an OpenAI-backed path', () => {
    expect(() => createAIProvider({ ...baseConfig, provider: 'cloudflare-workers-ai' })).toThrow(
      'Unsupported AI_PROVIDER "cloudflare-workers-ai"',
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith('ai.provider.unsupported_openai_path', {
      configuredProvider: 'cloudflare-workers-ai',
      billingPath: 'cloudflare-unified',
    });
  });
});

describe('createPerplexityAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('uses Cloudflare AI Gateway BYOK routing when Cloudflare gateway config is present', () => {
    createPerplexityAIProvider(baseConfig);

    expect(createPerplexity).toHaveBeenCalledWith({
      apiKey: 'pplx-test',
      baseURL: 'https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/perplexity-ai',
      headers: {
        'cf-aig-authorization': 'Bearer cf-token',
      },
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith('ai.provider.selected', {
      provider: 'perplexity',
      billingPath: 'cloudflare-gateway-byok',
      cloudflareGatewayId: 'test-gateway',
    });
  });

  it('falls back to direct Perplexity when Cloudflare gateway config is absent', () => {
    createPerplexityAIProvider({
      ...baseConfig,
      cloudflareAccountId: undefined,
      cloudflareGatewayId: undefined,
    });

    expect(createPerplexity).toHaveBeenCalledWith({
      apiKey: 'pplx-test',
    });
  });

  it('falls back to direct Perplexity when Cloudflare API token is absent', () => {
    createPerplexityAIProvider({
      ...baseConfig,
      cloudflareApiToken: undefined,
    });

    expect(createPerplexity).toHaveBeenCalledWith({
      apiKey: 'pplx-test',
    });
  });

  it('throws when the Perplexity key is absent', () => {
    expect(() =>
      createPerplexityAIProvider({
        ...baseConfig,
        perplexityApiKey: undefined,
      }),
    ).toThrow('PERPLEXITY_API_KEY is required');
  });
});

describe('createGoogleAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('uses Cloudflare AI Gateway unified billing when Cloudflare config is complete', () => {
    createGoogleAIProvider(baseConfig);

    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'cf-token',
      baseURL: 'https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/google-ai-studio',
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith('ai.provider.selected', {
      provider: 'google-ai-studio',
      billingPath: 'cloudflare-unified',
      cloudflareGatewayId: 'test-gateway',
    });
  });

  it('falls back to direct Google AI Studio when Cloudflare API token is absent', () => {
    createGoogleAIProvider({ ...baseConfig, cloudflareApiToken: undefined });

    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'google-test',
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith('ai.provider.selected', {
      provider: 'google-ai-studio',
      configuredProvider: undefined,
      billingPath: 'direct-provider',
      cloudflareGatewayId: undefined,
    });
  });

  it('throws a Google configuration error when neither path is configured', () => {
    expect(() =>
      createGoogleAIProvider({
        ...baseConfig,
        cloudflareApiToken: undefined,
        googleApiKey: undefined,
      }),
    ).toThrow('Google Generative AI API key is required');
  });
});

describe('getAIBillingPath', () => {
  it('returns cloudflare-unified when Cloudflare account, gateway, and token are present', () => {
    expect(getAIBillingPath(baseConfig)).toBe('cloudflare-unified');
  });

  it('returns direct-provider when Cloudflare config is incomplete', () => {
    expect(getAIBillingPath({ ...baseConfig, cloudflareGatewayId: '' })).toBe('direct-provider');
  });
});

describe('getPerplexityBillingPath', () => {
  it('returns cloudflare-gateway-byok when Cloudflare gateway config is present', () => {
    expect(getPerplexityBillingPath(baseConfig)).toBe('cloudflare-gateway-byok');
  });

  it('returns direct-provider when Cloudflare gateway config is incomplete', () => {
    expect(getPerplexityBillingPath({ ...baseConfig, cloudflareAccountId: undefined })).toBe(
      'direct-provider',
    );
  });

  it('returns direct-provider when Cloudflare API token is absent', () => {
    expect(getPerplexityBillingPath({ ...baseConfig, cloudflareApiToken: undefined })).toBe(
      'direct-provider',
    );
  });
});

describe('getGoogleBillingPath', () => {
  it('returns cloudflare-unified when Cloudflare account, gateway, and token are present', () => {
    expect(getGoogleBillingPath(baseConfig)).toBe('cloudflare-unified');
  });

  it('returns direct-provider when Cloudflare config is incomplete', () => {
    expect(getGoogleBillingPath({ ...baseConfig, cloudflareApiToken: undefined })).toBe(
      'direct-provider',
    );
  });
});
