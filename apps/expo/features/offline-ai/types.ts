export interface TrailContext {
  trailName: string;
  difficulty?: 'easy' | 'moderate' | 'hard' | 'expert';
  lengthMiles?: number;
  elevationGainFt?: number;
  conditions?: string;
  location?: string;
}

export interface LLMProvider {
  generate(context: TrailContext, prompt: string): Promise<string>;
}
