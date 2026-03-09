// Mock LLM Provider for offline AI functionality
// This provider simulates AI responses for testing and offline use

export interface TrailContext {
  name: string;
  difficulty?: string;
  length?: number;
}

export interface WeatherContext {
  temperature: number;
  conditions: string;
}

export interface LLMContext {
  trail?: TrailContext;
  activity?: string;
  weather?: WeatherContext;
}

export interface GenerateOptions {
  context?: LLMContext;
  /** Accepted by the interface for real LLM providers; not applied in this mock. */
  systemPrompt?: string;
}

export class MockLLMProvider {
  async generate(_prompt: string, options?: GenerateOptions): Promise<string> {
    const context = options?.context;
    // If no context provided, return default greeting
    if (!context) {
      return 'Hello! How can I help you with your outdoor adventure today?';
    }

    // Build response incorporating context
    const parts: string[] = [];

    // Add trail information if available
    if (context.trail) {
      const trail = context.trail;
      parts.push(`For ${trail.name}`);
      
      if (trail.difficulty) {
        parts.push(` (${trail.difficulty} difficulty)`);
      }
      if (trail.length !== undefined) {
        parts.push(` which is ${trail.length} miles long`);
      }
      parts.push(', ');
    }

    // Add activity context
    if (context.activity) {
      parts.push(`for your ${context.activity} trip`);
      
      // Add weather-specific recommendations
      if (context.weather) {
        const weather = context.weather;
        parts.push(' ');
        
        // Check for rainy/wet conditions
        if (weather.conditions.toLowerCase().includes('rain') || 
            weather.conditions.toLowerCase().includes('wet')) {
          parts.push('Make sure to bring rain gear and waterproof layers!');
        } else if (weather.temperature < 40) {
          parts.push('Dress warmly with insulated layers.');
        } else if (weather.temperature > 80) {
          parts.push('Stay hydrated and wear sun protection.');
        } else {
          parts.push('The weather looks great for outdoor activities.');
        }
      }
    } else if (context.weather) {
      // Weather info without activity
      const weather = context.weather;
      if (weather.conditions.toLowerCase().includes('rain')) {
        parts.push('Rain gear recommended!');
      }
    }

    // If we have context but no specific response content, add a default
    if (parts.length === 0) {
      return `Hello! How can I help you with your outdoor adventure today?`;
    }

    return parts.join('').trim();
  }
}

export const mockLLMProvider = new MockLLMProvider();
