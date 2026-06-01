import { beforeEach, describe, expect, it } from 'vitest';
import { type LLMContext, MockLLMProvider } from '../lib/MockLLMProvider';

describe('OfflineAI - MockLLMProvider', () => {
  let provider: MockLLMProvider;

  beforeEach(() => {
    provider = new MockLLMProvider();
  });

  describe('generate()', () => {
    it('should return a basic response for simple prompts', async () => {
      const response = await provider.generate({ _prompt: 'Hello' });
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    it('should include trail name in response when trail context is provided', async () => {
      const context: LLMContext = {
        trail: {
          name: 'Test Trail',
          difficulty: 'moderate',
          length: 5.2,
        },
        activity: 'hiking',
      };

      const response = await provider.generate({
        _prompt: 'What gear do I need for this trail?',
        options: { context },
      });

      expect(response).toContain('Test Trail');
    });

    it('should incorporate weather context into response', async () => {
      const context: LLMContext = {
        trail: {
          name: 'Mountain Loop',
          difficulty: 'hard',
        },
        weather: {
          temperature: 45,
          conditions: 'rainy',
        },
        activity: 'backpacking',
      };

      const response = await provider.generate({
        _prompt: 'What should I pack?',
        options: { context },
      });

      expect(response).toBeDefined();
      // Should mention weather-relevant items
      expect(response.toLowerCase()).toMatch(/rain|wet|precipitation|rainy|coat|jacket|umbrella/);
    });

    it('should handle empty context gracefully', async () => {
      const response = await provider.generate({
        _prompt: 'Hello',
        options: { context: undefined },
      });
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });

    it('should accept system prompt without error (not applied in mock)', async () => {
      // systemPrompt is part of the GenerateOptions interface for real providers;
      // the MockLLMProvider accepts it but does not use it in response generation.
      const response = await provider.generate({
        _prompt: 'Hello',
        options: {
          systemPrompt: 'You are a helpful hiking assistant.',
        },
      });

      expect(response).toBeDefined();
    });

    it('should incorporate activity context into recommendations', async () => {
      const context: LLMContext = {
        activity: 'camping',
        trail: {
          name: 'Lakeside Camp',
        },
      };

      const response = await provider.generate({
        _prompt: 'What do I need?',
        options: { context },
      });

      expect(response).toContain('Lakeside Camp');
    });
  });

  describe('context processing', () => {
    it('should process trail in context', async () => {
      const context: LLMContext = {
        trail: {
          name: 'Test Trail',
        },
      };

      const response = await provider.generate({ _prompt: 'Compare trails', options: { context } });

      expect(response).toContain('Test Trail');
    });

    it('should handle context with missing optional fields', async () => {
      const context: LLMContext = {
        trail: {
          name: 'Simple Trail',
          // difficulty and length are optional
        },
        // activity is optional
        // weather is optional
      };

      const response = await provider.generate({ _prompt: 'Hello', options: { context } });

      expect(response).toContain('Simple Trail');
    });
  });
});
