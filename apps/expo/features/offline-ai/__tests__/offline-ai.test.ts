import { describe, expect, test } from 'bun:test';
import { OfflineAIService } from '../OfflineAIService';
import { MockLLMProvider } from '../providers/MockLLMProvider';
import type { TrailContext } from '../types';

describe('OfflineAIService', () => {
  test('MockLLMProvider.generate() returns context-aware response containing trail name', async () => {
    const provider = new MockLLMProvider();
    const context: TrailContext = {
      trailName: 'Test Trail',
      difficulty: 'moderate',
      lengthMiles: 5.2,
      elevationGainFt: 1200,
    };

    const response = await provider.generate(context, 'What should I pack?');

    expect(response).toContain('Test Trail');
  });

  test('OfflineAIService.getTrailInfo() returns response containing trail name', async () => {
    const provider = new MockLLMProvider();
    const service = new OfflineAIService(provider);
    const context: TrailContext = {
      trailName: 'Test Trail',
      difficulty: 'hard',
      lengthMiles: 10.5,
      elevationGainFt: 3000,
      conditions: 'snow expected above 8000 ft',
      location: 'Rocky Mountain National Park',
    };

    const response = await service.getTrailInfo(context, 'What gear do I need?');

    expect(response).toContain('Test Trail');
    expect(response).toContain('hard');
    expect(response).toContain('10.5');
    expect(response).toContain('3000');
    expect(response).toContain('snow expected above 8000 ft');
    expect(response).toContain('Rocky Mountain National Park');
  });

  test('OfflineAIService.getTrailInfo() includes the prompt in response', async () => {
    const provider = new MockLLMProvider();
    const service = new OfflineAIService(provider);
    const context: TrailContext = {
      trailName: 'Test Trail',
    };
    const prompt = 'What are the best seasons to visit?';

    const response = await service.getTrailInfo(context, prompt);

    expect(response).toContain('Test Trail');
    expect(response).toContain(prompt);
  });

  test('MockLLMProvider handles minimal TrailContext with only trailName', async () => {
    const provider = new MockLLMProvider();
    const context: TrailContext = {
      trailName: 'Test Trail',
    };

    const response = await provider.generate(context, 'Tell me about this trail');

    expect(response).toContain('Test Trail');
  });

  test('OfflineAIService works with different trail names', async () => {
    const provider = new MockLLMProvider();
    const service = new OfflineAIService(provider);

    const trails = ['Appalachian Trail', 'Pacific Crest Trail', 'Continental Divide Trail'];

    for (const trailName of trails) {
      const context: TrailContext = { trailName };
      const response = await service.getTrailInfo(context, 'Tell me about this trail');
      expect(response).toContain(trailName);
    }
  });
});
