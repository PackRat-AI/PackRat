/**
 * Offline AI Feature Types
 *
 * Defines types for the offline AI assistant that works without internet connectivity.
 * Uses local LLM inference (llama.cpp or similar) for on-device AI capabilities.
 */

// Message types for the chat interface
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

// LLM Configuration
export interface LLMConfig {
  /** Model identifier (e.g., 'llama-3.2-1b', 'phi-3-mini') */
  modelId: string;
  /** Path to the model file */
  modelPath: string;
  /** Maximum tokens to generate */
  maxTokens: number;
  /** Temperature for sampling (0.0 - 2.0) */
  temperature: number;
  /** Number of context tokens */
  contextWindow: number;
  /** GPU layers to use (0 = CPU only) */
  gpuLayers: number;
}

// Trail-related types for Q&A functionality
export interface TrailInfo {
  id: string;
  name: string;
  location: string;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  length: string;
  elevation: string;
  description: string;
  highlights: string[];
  permits: string[];
  hazards: string[];
  bestSeasons: string[];
}

export interface TrailQAContext {
  /** Current trail information */
  trail?: TrailInfo;
  /** User's current pack items */
  packItems?: string[];
  /** User's location context */
  location?: {
    latitude: number;
    longitude: number;
    name: string;
  };
  /** Current weather conditions */
  weather?: {
    temperature: number;
    condition: string;
    windSpeed: number;
  };
}

// LLM Provider interface
export interface LLMProvider {
  /** Initialize the model */
  initialize(config: LLMConfig): Promise<void>;
  /** Generate a response */
  generate(prompt: string, context?: TrailQAContext): Promise<string>;
  /** Check if model is loaded and ready */
  isReady(): boolean;
  /** Get model info */
  getModelInfo(): { name: string; size: string } | null;
  /** Release resources */
  dispose(): Promise<void>;
}

// Chat state
export interface OfflineAIState {
  /** Current conversation messages */
  messages: ChatMessage[];
  /** Whether the AI is currently generating */
  isGenerating: boolean;
  /** Current error if any */
  error: string | null;
  /** Whether the feature is available (model loaded) */
  isAvailable: boolean;
  /** Model info */
  modelInfo: { name: string; size: string } | null;
}

// Prompt templates
export interface PromptTemplate {
  /** Template name */
  name: string;
  /** System prompt */
  system: string;
  /** Default user prompt */
  user?: string;
}

// Predefined trail Q&A prompts
export const TRAIL_QA_PROMPTS: Record<string, PromptTemplate> = {
  trailConditions: {
    name: 'Trail Conditions',
    system: `You are an expert hiking and outdoor enthusiast assistant. 
Provide accurate, helpful information about trail conditions based on the user's location and current conditions.
Always prioritize safety and recommend checking with local authorities for the most up-to-date information.`,
  },
  gearRecommendations: {
    name: 'Gear Recommendations',
    system: `You are an expert outdoor gear specialist. 
Provide recommendations for hiking and camping gear based on the user's current pack items and the trail conditions.
Consider weather, terrain, and trip duration when making suggestions.`,
  },
  safety: {
    name: 'Safety Assistant',
    system: `You are a wilderness safety expert. 
Provide safety information and emergency guidance for outdoor activities.
Always recommend proper precautions and local emergency numbers.`,
  },
  tripPlanning: {
    name: 'Trip Planning',
    system: `You are an expert trip planner for outdoor adventures.
Help users plan their trips including route selection, timing, permits, and contingencies.`,
  },
};
