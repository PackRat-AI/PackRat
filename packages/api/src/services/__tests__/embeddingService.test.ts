import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateEmbedding, generateManyEmbeddings } from '../embeddingService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('ai', () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
}));

vi.mock('@packrat/api/utils/ai/provider', () => ({
  createAIProvider: vi.fn(() => ({
    embedding: vi.fn((model: string) => model),
  })),
}));

vi.mock('@packrat/api/utils/ai/models', () => ({
  DEFAULT_MODELS: {
    OPENAI_EMBEDDING: 'text-embedding-3-small',
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseParams = {
  openAiApiKey: 'test-key',
  provider: 'openai' as const,
  cloudflareAccountId: 'test-account',
  cloudflareGatewayId: 'test-gateway',
  cloudflareAiBinding: {} as any,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('embeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('generates embedding for valid text', async () => {
      const { embed } = await import('ai');
      const mockEmbed = embed as ReturnType<typeof vi.fn>;
      mockEmbed.mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
      });

      const result = await generateEmbedding({
        ...baseParams,
        value: 'test text',
      });

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockEmbed).toHaveBeenCalledWith({
        model: expect.any(String),
        value: 'test text',
      });
    });

    it('replaces newlines with spaces', async () => {
      const { embed } = await import('ai');
      const mockEmbed = embed as ReturnType<typeof vi.fn>;
      mockEmbed.mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
      });

      await generateEmbedding({
        ...baseParams,
        value: 'line1\nline2\nline3',
      });

      expect(mockEmbed).toHaveBeenCalledWith({
        model: expect.any(String),
        value: 'line1 line2 line3',
      });
    });

    it('returns null for empty string', async () => {
      const result = await generateEmbedding({
        ...baseParams,
        value: '',
      });

      expect(result).toBeNull();
    });

    it('returns null for whitespace-only string', async () => {
      const result = await generateEmbedding({
        ...baseParams,
        value: '   \n\t  ',
      });

      expect(result).toBeNull();
    });

    it('calls createAIProvider with correct params', async () => {
      const { embed } = await import('ai');
      const mockEmbed = embed as ReturnType<typeof vi.fn>;
      mockEmbed.mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
      });

      const { createAIProvider } = await import('@packrat/api/utils/ai/provider');

      await generateEmbedding({
        ...baseParams,
        value: 'test',
      });

      expect(createAIProvider).toHaveBeenCalledWith({
        openAiApiKey: 'test-key',
        provider: 'openai',
        cloudflareAccountId: 'test-account',
        cloudflareGatewayId: 'test-gateway',
        cloudflareAiBinding: expect.anything(),
      });
    });
  });

  describe('generateManyEmbeddings', () => {
    it('generates embeddings for multiple values', async () => {
      const { embedMany } = await import('ai');
      const mockEmbedMany = embedMany as ReturnType<typeof vi.fn>;
      mockEmbedMany.mockResolvedValue({
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
          [0.5, 0.6],
        ],
      });

      const result = await generateManyEmbeddings({
        ...baseParams,
        values: ['text1', 'text2', 'text3'],
      });

      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
        [0.5, 0.6],
      ]);
    });

    it('filters out empty strings', async () => {
      const { embedMany } = await import('ai');
      const mockEmbedMany = embedMany as ReturnType<typeof vi.fn>;
      mockEmbedMany.mockResolvedValue({
        embeddings: [[0.1, 0.2]],
      });

      await generateManyEmbeddings({
        ...baseParams,
        values: ['valid text', '', '  ', null as any, undefined as any],
      });

      expect(mockEmbedMany).toHaveBeenCalledWith({
        model: expect.any(String),
        values: ['valid text'],
      });
    });

    it('replaces newlines with spaces in all values', async () => {
      const { embedMany } = await import('ai');
      const mockEmbedMany = embedMany as ReturnType<typeof vi.fn>;
      mockEmbedMany.mockResolvedValue({
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
      });

      await generateManyEmbeddings({
        ...baseParams,
        values: ['line1\nline2', 'line3\nline4'],
      });

      expect(mockEmbedMany).toHaveBeenCalledWith({
        model: expect.any(String),
        values: ['line1 line2', 'line3 line4'],
      });
    });

    it('returns empty array for empty input', async () => {
      const result = await generateManyEmbeddings({
        ...baseParams,
        values: [],
      });

      expect(result).toEqual([]);
    });

    it('returns empty array for all invalid values', async () => {
      const result = await generateManyEmbeddings({
        ...baseParams,
        values: ['', '  ', null as any, undefined as any],
      });

      expect(result).toEqual([]);
    });

    it('trims whitespace from values', async () => {
      const { embedMany } = await import('ai');
      const mockEmbedMany = embedMany as ReturnType<typeof vi.fn>;
      mockEmbedMany.mockResolvedValue({
        embeddings: [[0.1, 0.2]],
      });

      await generateManyEmbeddings({
        ...baseParams,
        values: ['  text with spaces  '],
      });

      expect(mockEmbedMany).toHaveBeenCalledWith({
        model: expect.any(String),
        values: ['text with spaces'],
      });
    });
  });
});
