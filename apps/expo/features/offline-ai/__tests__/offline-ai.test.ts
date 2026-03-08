/**
 * Offline AI Feature Unit Tests
 *
 * Tests for the offline AI functionality including:
 * - Mock LLM Provider
 * - Trail Q&A functionality
 * - Message handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLLMProvider, defaultLLMProvider, MockLLMProvider } from '../lib/mock-llm-provider';
import type { LLMConfig, TrailInfo, TrailQAContext } from '../types';

// Test configuration
const TEST_CONFIG: LLMConfig = {
  modelId: 'test-model',
  modelPath: './test-model.gguf',
  maxTokens: 256,
  temperature: 0.7,
  contextWindow: 1024,
  gpuLayers: 0,
};

// Sample trail for testing
const SAMPLE_TRAIL: TrailInfo = {
  id: 'test-trail',
  name: 'Test Trail',
  location: 'Test Location',
  difficulty: 'moderate',
  length: '5 miles',
  elevation: '1000 ft',
  description: 'A test trail for unit testing',
  highlights: ['View', 'Creek'],
  permits: ['None'],
  hazards: ['None'],
  bestSeasons: ['Spring', 'Fall'],
};

describe('MockLLMProvider', () => {
  let provider: MockLLMProvider;

  beforeEach(() => {
    provider = new MockLLMProvider();
  });

  afterEach(async () => {
    await provider.dispose();
  });

  describe('initialization', () => {
    it('should not be ready before initialization', () => {
      expect(provider.isReady()).toBe(false);
    });

    it('should become ready after initialization', async () => {
      await provider.initialize(TEST_CONFIG);
      expect(provider.isReady()).toBe(true);
    });

    it('should return null model info before initialization', () => {
      expect(provider.getModelInfo()).toBeNull();
    });

    it('should return model info after initialization', async () => {
      await provider.initialize(TEST_CONFIG);
      const info = provider.getModelInfo();
      expect(info).not.toBeNull();
      expect(info?.name).toBeDefined();
      expect(info?.size).toBeDefined();
    });
  });

  describe('generation', () => {
    it('should throw if generate is called before initialization', async () => {
      await expect(provider.generate('test prompt')).rejects.toThrow('LLM not initialized');
    });

    it('should generate a response after initialization', async () => {
      await provider.initialize(TEST_CONFIG);
      const response = await provider.generate('Hello');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    it('should accept trail context', async () => {
      await provider.initialize(TEST_CONFIG);
      const context: TrailQAContext = { trail: SAMPLE_TRAIL };
      const response = await provider.generate('What are the trail conditions?', context);
      expect(response).toContain('Test Trail');
    });

    it('should include weather in response when provided', async () => {
      await provider.initialize(TEST_CONFIG);
      const context: TrailQAContext = {
        trail: SAMPLE_TRAIL,
        weather: {
          temperature: 75,
          condition: 'Sunny',
          windSpeed: 10,
        },
      };
      const response = await provider.generate('What is the weather?', context);
      expect(response).toContain('75');
    });

    it('should include pack items in response when provided', async () => {
      await provider.initialize(TEST_CONFIG);
      const context: TrailQAContext = {
        trail: SAMPLE_TRAIL,
        packItems: ['Water', 'Snacks', 'Map'],
      };
      const response = await provider.generate('What gear do I need?', context);
      expect(response).toContain('Water');
    });
  });

  describe('dispose', () => {
    it('should not be ready after disposal', async () => {
      await provider.initialize(TEST_CONFIG);
      expect(provider.isReady()).toBe(true);
      await provider.dispose();
      expect(provider.isReady()).toBe(false);
    });
  });
});

describe('createLLMProvider', () => {
  it('should create a mock provider by default', () => {
    const provider = createLLMProvider();
    expect(provider).toBeInstanceOf(MockLLMProvider);
  });

  it('should create a mock provider when explicitly specified', () => {
    const provider = createLLMProvider('mock');
    expect(provider).toBeInstanceOf(MockLLMProvider);
  });
});

describe('Trail Q&A Functionality', () => {
  let provider: MockLLMProvider;

  beforeEach(async () => {
    provider = new MockLLMProvider();
    await provider.initialize(TEST_CONFIG);
  });

  afterEach(async () => {
    await provider.dispose();
  });

  it('should respond to gear questions', async () => {
    const response = await provider.generate('What gear do I need?');
    expect(response.toLowerCase()).toContain('gear');
  });

  it('should respond to water/hydration questions', async () => {
    const response = await provider.generate('How much water do I need?');
    expect(response.toLowerCase()).toContain('water');
  });

  it('should respond to first aid questions', async () => {
    const response = await provider.generate('What first aid supplies do I need?');
    expect(response.toLowerCase()).toContain('first aid');
  });

  it('should respond to wildlife questions', async () => {
    const response = await provider.generate('What about bears?');
    const responseLower = response.toLowerCase();
    const hasWildlife = responseLower.includes('wildlife');
    const hasBear = responseLower.includes('bear');
    expect(hasWildlife || hasBear).toBe(true);
  });

  it('should provide trail-specific information', async () => {
    const context: TrailQAContext = { trail: SAMPLE_TRAIL };
    const response = await provider.generate('Tell me about this trail', context);
    expect(response).toContain('Test Trail');
    expect(response).toContain('moderate');
  });

  it('should provide safety information', async () => {
    const context: TrailQAContext = { trail: SAMPLE_TRAIL };
    const response = await provider.generate('Is this safe?', context);
    expect(response.toLowerCase()).toContain('safety');
  });
});

describe('Default Export', () => {
  it('should have a default provider', () => {
    expect(defaultLLMProvider).toBeDefined();
    expect(defaultLLMProvider).toBeInstanceOf(MockLLMProvider);
  });
});
