/**
 * Offline AI Hook
 *
 * Main hook for interacting with the offline AI assistant.
 * Manages the chat state, LLM provider, and message generation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createLLMProvider } from '../lib/mock-llm-provider';
import type { ChatMessage, LLMConfig, LLMProvider, OfflineAIState, TrailQAContext } from '../types';

// Default LLM configuration
const DEFAULT_LLM_CONFIG: LLMConfig = {
  modelId: 'llama-3.2-1b',
  modelPath: './models/llama-3.2-1b-q4_k_m.gguf',
  maxTokens: 512,
  temperature: 0.7,
  contextWindow: 2048,
  gpuLayers: 0,
};

interface UseOfflineAIOptions {
  /** Initial LLM configuration */
  config?: Partial<LLMConfig>;
  /** Trail context for Q&A */
  trailContext?: TrailQAContext;
  /** Callback when provider is ready */
  onReady?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

interface UseOfflineAIReturn extends OfflineAIState {
  /** Send a message to the AI */
  sendMessage: (content: string) => Promise<void>;
  /** Clear all messages */
  clearMessages: () => void;
  /** Set trail context */
  setTrailContext: (context: TrailQAContext) => void;
  /** Initialize the AI */
  initialize: () => Promise<void>;
}

/**
 * Hook for offline AI functionality
 */
export function useOfflineAI(options: UseOfflineAIOptions = {}): UseOfflineAIReturn {
  const { config, trailContext: initialTrailContext, onReady, onError } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [modelInfo, setModelInfo] = useState<{ name: string; size: string } | null>(null);

  const providerRef = useRef<LLMProvider | null>(null);
  const trailContextRef = useRef<TrailQAContext | undefined>(initialTrailContext);

  // Initialize the LLM provider
  const initialize = useCallback(async () => {
    try {
      setError(null);

      // Create provider
      const provider = createLLMProvider('mock');
      providerRef.current = provider;

      // Merge configs
      const fullConfig: LLMConfig = {
        ...DEFAULT_LLM_CONFIG,
        ...config,
      };

      // Initialize
      await provider.initialize(fullConfig);

      // Get model info
      const info = provider.getModelInfo();
      if (info) {
        setModelInfo(info);
      }

      setIsAvailable(true);
      onReady?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize AI';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [config, onReady, onError]);

  // Update trail context
  const setTrailContext = useCallback((context: TrailQAContext) => {
    trailContextRef.current = context;
  }, []);

  // Send a message and get AI response
  const sendMessage = useCallback(
    async (content: string) => {
      if (!providerRef.current || !providerRef.current.isReady()) {
        setError('AI not ready. Please wait for initialization.');
        return;
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);
      setError(null);

      try {
        // Build context from messages for conversation history
        const context = trailContextRef.current;

        // Generate response
        const response = await providerRef.current.generate(content, context);

        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate response';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsGenerating(false);
      }
    },
    [onError],
  );

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // Auto-initialize on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialize is intentionally omitted to run only on mount
  useEffect(() => {
    initialize();

    // Cleanup on unmount
    return () => {
      providerRef.current?.dispose();
    };
  }, []);

  return {
    messages,
    isGenerating,
    error,
    isAvailable,
    modelInfo,
    sendMessage,
    clearMessages,
    setTrailContext,
    initialize,
  };
}

/**
 * Generate a UUID (simple implementation)
 * In production, use a proper UUID library
 */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default useOfflineAI;
