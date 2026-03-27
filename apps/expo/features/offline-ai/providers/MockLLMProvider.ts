import type { LLMProvider, TrailContext } from '../types';

/**
 * MockLLMProvider is used in tests to simulate an LLM that generates
 * context-aware responses based on trail information.
 */
export class MockLLMProvider implements LLMProvider {
  async generate(context: TrailContext, prompt: string): Promise<string> {
    const parts: string[] = [`Here is information about ${context.trailName}.`];

    if (context.difficulty) {
      parts.push(`Difficulty: ${context.difficulty}.`);
    }

    if (context.lengthMiles !== undefined) {
      parts.push(`Length: ${context.lengthMiles} miles.`);
    }

    if (context.elevationGainFt !== undefined) {
      parts.push(`Elevation gain: ${context.elevationGainFt} ft.`);
    }

    if (context.conditions) {
      parts.push(`Current conditions: ${context.conditions}.`);
    }

    if (context.location) {
      parts.push(`Location: ${context.location}.`);
    }

    parts.push(`Prompt: ${prompt}`);

    return parts.join(' ');
  }
}
