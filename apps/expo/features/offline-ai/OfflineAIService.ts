import type { LLMProvider, TrailContext } from './types';

export class OfflineAIService {
  constructor(private readonly provider: LLMProvider) {}

  async getTrailInfo(context: TrailContext, prompt: string): Promise<string> {
    return this.provider.generate(context, prompt);
  }
}
