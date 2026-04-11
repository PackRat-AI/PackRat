import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { ImageDetectionService } from '../src/services/imageDetectionService';

// Mock the dependencies
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({})),
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('../src/services/catalogService', () => ({
  CatalogService: vi.fn(() => ({
    vectorSearch: vi.fn(),
  })),
}));

vi.mock('../src/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    OPENAI_API_KEY: 'test-key',
  })),
}));

describe('ImageDetectionService', () => {
  const mockContext = {} as Context;

  describe('Constructor', () => {
    it('creates service instance with context', () => {
      const service = new ImageDetectionService(mockContext);
      expect(service).toBeInstanceOf(ImageDetectionService);
    });
  });
});
