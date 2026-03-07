/**
 * Mock LLM Provider
 *
 * A mock implementation of the LLMProvider interface for development and testing.
 * Simulates on-device LLM inference without requiring actual llama.cpp setup.
 *
 * This can be replaced with a real implementation using:
 * - llama.cpp via react-native-llama
 * - Transformers.js
 * - Or other on-device inference solutions
 */

import type { LLMConfig, LLMProvider, TrailInfo, TrailQAContext } from '../types';

interface MockModelInfo {
  name: string;
  size: string;
}

/**
 * Trail information database for mock responses
 */
const TRAIL_DATABASE: Record<string, TrailInfo> = {
  yosemite: {
    id: 'yosemite',
    name: 'Yosemite Valley',
    location: 'California',
    difficulty: 'moderate',
    length: 'varies',
    elevation: '4,000 ft',
    description: 'Iconic valley with famous granite cliffs and waterfalls',
    highlights: ['Half Dome', 'El Capitan', 'Yosemite Falls', 'Mirror Lake'],
    permits: ['Wilderness permit required for backcountry'],
    hazards: ['Rockfall', 'Altitude sickness', 'Wildlife'],
    bestSeasons: ['Spring', 'Fall'],
  },
  'angels-landing': {
    id: 'angels-landing',
    name: 'Angels Landing',
    location: 'Zion National Park, Utah',
    difficulty: 'hard',
    length: '5.4 miles',
    elevation: '1,488 ft',
    description: 'Famous chain-assisted climb with panoramic views',
    highlights: ['Chain route', 'Panoramic views', 'Scenic overlooks'],
    permits: ['Permit required (lottery system)'],
    hazards: ['Exposure', 'Crowds', 'Heat'],
    bestSeasons: ['Spring', 'Fall'],
  },
};

/**
 * Generate a mock response based on context
 */
function generateMockResponse(prompt: string, context?: TrailQAContext): string {
  const lowerPrompt = prompt.toLowerCase();

  // Trail-specific responses
  if (context?.trail) {
    const trail = context.trail;

    if (lowerPrompt.includes('conditions') || lowerPrompt.includes('weather')) {
      if (context.weather) {
        return (
          `Based on current conditions at ${trail.name}:\n\n` +
          `🌡️ Temperature: ${context.weather.temperature}°F\n` +
          `☁️ Condition: ${context.weather.condition}\n` +
          `💨 Wind: ${context.weather.windSpeed} mph\n\n` +
          `Trail difficulty: ${trail.difficulty}\n` +
          `Elevation gain: ${trail.elevation}\n\n` +
          `Current hazards to be aware of: ${trail.hazards.join(', ')}\n\n` +
          `Always check with local rangers for the most up-to-date trail conditions.`
        );
      }
      return (
        `For ${trail.name} (${trail.location}):\n\n` +
        `Difficulty: ${trail.difficulty}\n` +
        `Length: ${trail.length}\n` +
        `Elevation: ${trail.elevation}\n\n` +
        `Description: ${trail.description}\n\n` +
        `Highlights: ${trail.highlights.join(', ')}\n\n` +
        `Permits required: ${trail.permits.join(', ')}\n\n` +
        `Best seasons: ${trail.bestSeasons.join(', ')}`
      );
    }

    if (
      lowerPrompt.includes('gear') ||
      lowerPrompt.includes('pack') ||
      lowerPrompt.includes('bring')
    ) {
      const items = context.packItems || [];
      const baseGear = 'Essential gear for this trail:';
      const specific =
        trail.difficulty === 'hard' || trail.difficulty === 'expert'
          ? '\n\n⚠️ This is a challenging trail - consider additional gear:\n' +
            '- Extra water capacity (3L minimum)\n' +
            '- Navigation (GPS + map + compass)\n' +
            '- Emergency shelter\n' +
            '- First aid kit\n' +
            '- Headlamp with extra batteries'
          : '\n\nStandard gear recommendations:\n' +
            '- 2L water minimum\n' +
            '- Basic first aid\n' +
            '- Map or GPS\n' +
            '- Sun protection';

      if (items.length > 0) {
        return `${baseGear}\n\nYour current pack includes: ${items.join(', ')}${specific}`;
      }
      return `${baseGear}${specific}`;
    }

    if (
      lowerPrompt.includes('safe') ||
      lowerPrompt.includes('danger') ||
      lowerPrompt.includes('hazard')
    ) {
      return (
        `Safety information for ${trail.name}:\n\n` +
        `⚠️ Hazards: ${trail.hazards.join(', ')}\n\n` +
        `📍 Location: ${trail.location}\n\n` +
        `Recommended precautions:\n` +
        `- Start early to avoid afternoon weather\n` +
        `- Bring the 10 essentials\n` +
        `- Tell someone your plans\n` +
        `- Check weather forecast before departing\n` +
        `- Carry emergency contact information\n\n` +
        `For emergencies, call 911 or local park authorities.`
      );
    }

    // General trail info fallback when trail context is provided
    return (
      `Here's information about ${trail.name} (${trail.location}):\n\n` +
      `Difficulty: ${trail.difficulty}\n` +
      `Length: ${trail.length}\n` +
      `Elevation: ${trail.elevation}\n\n` +
      `${trail.description}\n\n` +
      `Highlights: ${trail.highlights.join(', ')}\n\n` +
      `Best seasons: ${trail.bestSeasons.join(', ')}`
    );
  }

  // Generic outdoor responses
  if (lowerPrompt.includes('water') || lowerPrompt.includes('drink')) {
    return (
      `Hydration is critical for outdoor safety:\n\n` +
      `💧 General rule: Drink 500ml-1L per hour of activity\n` +
      `💧 In hot weather: Increase to 1-1.5L per hour\n` +
      `💧 Signs of dehydration: Thirst, dark urine, headache, fatigue\n` +
      `💧 Always carry extra water (minimum 2L for day hikes)\n` +
      `💧 Consider a water filter for longer trips`
    );
  }

  if (lowerPrompt.includes('first aid') || lowerPrompt.includes('injury')) {
    return (
      `Basic first aid kit essentials:\n\n` +
      `🩹 Bandages and tape\n` +
      `🩹 Antiseptic wipes\n` +
      `🩹 Pain relievers\n` +
      `🩹 Blister treatment (moleskin)\n` +
      `🩹 Tweezers\n` +
      `🩹 Emergency numbers\n\n` +
      `For serious injuries, stabilize and seek professional medical help immediately.`
    );
  }

  if (
    lowerPrompt.includes('wildlife') ||
    lowerPrompt.includes('animal') ||
    lowerPrompt.includes('bear')
  ) {
    return (
      `Wildlife safety tips:\n\n` +
      `🐻 Bears:\n` +
      `- Make noise to avoid surprise encounters\n` +
      `- Store food properly (bear canister)\n` +
      `- Never approach wildlife\n` +
      `- Know how to use bear spray\n\n` +
      `🐍 Snakes:\n` +
      `- Stay on trails\n` +
      `- Watch where you step\n` +
      `- Do not handle snakes\n\n` +
      `🦌 General:\n` +
      `- Observe from distance\n` +
      `- Do not feed animals`
    );
  }

  // Default response
  return (
    `I'm here to help with your outdoor questions! You can ask me about:\n\n` +
    `🏔️ Trail conditions and recommendations\n` +
    `🎒 Gear suggestions for your trip\n` +
    `⚠️ Safety information and hazards\n` +
    `📋 Trip planning and permits\n` +
    `💧 Hydration and nutrition\n\n` +
    `What would you like to know?`
  );
}

/**
 * Mock LLM Provider class
 * Simulates on-device LLM inference for development
 */
export class MockLLMProvider implements LLMProvider {
  private initialized = false;
  private config: LLMConfig | null = null;
  private modelInfo: MockModelInfo = {
    name: 'Llama 3.2 1B (Mock)',
    size: '~1.3GB',
  };

  async initialize(config: LLMConfig): Promise<void> {
    // Simulate model loading delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    this.config = config;
    this.initialized = true;

    console.log('[MockLLM] Initialized with config:', config);
  }

  async generate(prompt: string, context?: TrailQAContext): Promise<string> {
    if (!this.initialized) {
      throw new Error('LLM not initialized. Call initialize() first.');
    }

    // Simulate generation delay (longer for more complex prompts)
    const delay = Math.min(3000, 500 + prompt.length * 10);
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Check for trail context in prompt
    let enhancedContext = context;

    // Auto-detect trail from prompt
    if (!enhancedContext?.trail) {
      const lowerPrompt = prompt.toLowerCase();
      for (const [key, trail] of Object.entries(TRAIL_DATABASE)) {
        if (lowerPrompt.includes(key) || lowerPrompt.includes(trail.name.toLowerCase())) {
          enhancedContext = {
            ...context,
            trail,
          };
          break;
        }
      }
    }

    return generateMockResponse(prompt, enhancedContext);
  }

  isReady(): boolean {
    return this.initialized;
  }

  getModelInfo(): MockModelInfo | null {
    if (!this.initialized) {
      return null;
    }
    return this.modelInfo;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
    this.config = null;
    console.log('[MockLLM] Disposed');
  }
}

/**
 * Factory function to create LLM provider
 * Replace with real implementation in production
 */
export function createLLMProvider(type: 'mock' | 'real' = 'mock'): LLMProvider {
  if (type === 'mock') {
    return new MockLLMProvider();
  }

  // For future real implementation:
  // import { LlamaCppProvider } from './llama-cpp-provider';
  // return new LlamaCppProvider();

  console.warn('[OfflineAI] Using mock provider. Set type to "real" for actual LLM.');
  return new MockLLMProvider();
}

// Export default provider instance
export const defaultLLMProvider = createLLMProvider();
