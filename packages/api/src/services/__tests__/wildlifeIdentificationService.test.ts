import { generateObject } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WildlifeIdentificationService } from '../wildlifeIdentificationService';

const { mockCreateAIProvider, mockModel } = vi.hoisted(() => {
  const mockModel = vi.fn((modelName: string) => ({ name: modelName }));
  return {
    mockCreateAIProvider: vi.fn(() => mockModel),
    mockModel,
  };
});

vi.mock('@packrat/api/utils/ai/provider', () => ({
  createAIProvider: mockCreateAIProvider,
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    OPENAI_API_KEY: undefined,
    AI_PROVIDER: 'openai',
    CLOUDFLARE_ACCOUNT_ID: 'test-account',
    CLOUDFLARE_AI_GATEWAY_ID: 'test-gateway',
    CLOUDFLARE_API_TOKEN: 'cf-token',
    AI: {},
  })),
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

describe('WildlifeIdentificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('identifies species through the shared AI provider without a direct OpenAI key', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        results: [
          {
            commonName: 'Douglas Fir',
            scientificName: 'Pseudotsuga menziesii',
            category: 'tree',
            description: 'Conifer with flat needles and distinctive cones',
            habitat: ['forest'],
            regions: ['western North America'],
            dangerLevel: 'safe',
            characteristics: ['flat needles'],
            confidence: 0.86,
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await new WildlifeIdentificationService().identifySpecies(
      'https://example.com/tree.jpg',
    );

    expect(result.results).toHaveLength(1);
    expect(mockCreateAIProvider).toHaveBeenCalledWith({
      openAiApiKey: undefined,
      provider: 'openai',
      cloudflareAccountId: 'test-account',
      cloudflareGatewayId: 'test-gateway',
      cloudflareApiToken: 'cf-token',
      cloudflareAiBinding: {},
    });
    expect(mockModel).toHaveBeenCalledWith('gpt-4o');
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { name: 'gpt-4o' },
      }),
    );
  });
});
