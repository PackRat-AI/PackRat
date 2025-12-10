/**
 * Custom hook for on-device AI inference using CactusLM
 * This provides a wrapper around cactus-react-native for easy integration
 */
import { useEffect, useState, useCallback, useRef } from 'react';

// TODO: Uncomment when cactus-react-native is fully installed and tested on physical devices
// This will activate real on-device AI inference instead of simulation
// import { CactusLM, type Message, type CompletionParams } from 'cactus-react-native';

// Type definitions (matching cactus-react-native API)
export interface CactusMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CactusCompletionParams {
  messages: CactusMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onStreamChunk?: (chunk: string) => void;
}

export interface CactusCompletionResult {
  response: string;
  tokens?: number;
  finishReason?: string;
}

export interface UseCactusAIOptions {
  /**
   * Whether to auto-download the model on mount if not already downloaded
   */
  autoDownload?: boolean;
  
  /**
   * Model identifier to use (defaults to the default model)
   */
  modelId?: string;
  
  /**
   * Called when download progress updates
   */
  onDownloadProgress?: (progress: number) => void;
  
  /**
   * Called when model is ready to use
   */
  onReady?: () => void;
  
  /**
   * Called on errors
   */
  onError?: (error: Error) => void;
}

// Simulation constants - only used until real implementation is activated
const SIMULATION_DOWNLOAD_INTERVAL_MS = 100;
const SIMULATION_DOWNLOAD_INCREMENT = 0.1; // 10%
const SIMULATION_STREAM_DELAY_MS = 50;
const SIMULATION_USER_QUERY_MAX_LENGTH = 100; // Max length for sanitized user query display

export interface UseCactusAIReturn {
  /**
   * Whether the model is currently being downloaded
   */
  isDownloading: boolean;
  
  /**
   * Download progress (0-1)
   */
  downloadProgress: number;
  
  /**
   * Whether the model is downloaded and ready
   */
  isReady: boolean;
  
  /**
   * Whether inference is currently in progress
   */
  isGenerating: boolean;
  
  /**
   * The current completion response
   */
  completion: string;
  
  /**
   * Start downloading the model
   */
  download: () => Promise<void>;
  
  /**
   * Generate a completion
   */
  complete: (params: CactusCompletionParams) => Promise<CactusCompletionResult>;
  
  /**
   * Clean up resources
   */
  destroy: () => Promise<void>;
  
  /**
   * Last error if any
   */
  error: Error | null;
}

/**
 * Hook for using on-device AI with CactusLM
 * 
 * @example
 * ```tsx
 * const { isReady, isDownloading, downloadProgress, complete, download } = useCactusAI({
 *   autoDownload: true,
 *   onReady: () => console.log('Model ready!'),
 * });
 * 
 * if (isDownloading) {
 *   return <Text>Downloading model: {Math.round(downloadProgress * 100)}%</Text>;
 * }
 * 
 * const handleChat = async () => {
 *   const result = await complete({
 *     messages: [{ role: 'user', content: 'What should I pack for a day hike?' }],
 *   });
 *   console.log(result.response);
 * };
 * ```
 */
export function useCactusAI(options: UseCactusAIOptions = {}): UseCactusAIReturn {
  const {
    autoDownload = false,
    onDownloadProgress,
    onReady,
    onError,
  } = options;

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [completion, setCompletion] = useState('');
  const [error, setError] = useState<Error | null>(null);
  
  // Type for CactusLM instance - matches the actual API
  type CactusLMInstance = {
    download: (options: { onProgress: (progress: number) => void }) => Promise<void>;
    complete: (params: {
      messages: CactusMessage[];
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      onStreamChunk?: (chunk: string) => void;
    }) => Promise<CactusCompletionResult>;
    destroy: () => Promise<void>;
  } | null;
  
  // Ref to hold the CactusLM instance
  // TODO: Replace with actual CactusLM type when package is installed
  // import type { CactusLM } from 'cactus-react-native';
  // const cactusRef = useRef<CactusLM | null>(null);
  const cactusRef = useRef<CactusLMInstance>(null);

  // Initialize CactusLM instance
  useEffect(() => {
    let mounted = true;

    const initCactus = async () => {
      try {
        // Note: This will be uncommented when cactus-react-native is properly installed
        // cactusRef.current = new CactusLM();
        
        // For PoC purposes, we'll simulate the behavior
        console.log('[useCactusAI] Initializing CactusLM instance');
        
        if (autoDownload && mounted) {
          await download();
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    };

    initCactus();

    return () => {
      mounted = false;
      // Cleanup will be handled by the destroy function
    };
  }, []);

  const download = useCallback(async () => {
    if (isDownloading || isReady) return;
    
    setIsDownloading(true);
    setError(null);

    try {
      // Note: This will be uncommented when cactus-react-native is properly installed
      // await cactusRef.current?.download({
      //   onProgress: (progress) => {
      //     setDownloadProgress(progress);
      //     onDownloadProgress?.(progress);
      //   },
      // });

      // For PoC purposes, simulate download
      console.log('[useCactusAI] Starting model download');
      
      // Simulate download progress
      const totalSteps = 1 / SIMULATION_DOWNLOAD_INCREMENT;
      for (let i = 0; i <= totalSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, SIMULATION_DOWNLOAD_INTERVAL_MS));
        // Ensure progress doesn't exceed 1.0 due to floating-point precision
        const progress = Math.min(i * SIMULATION_DOWNLOAD_INCREMENT, 1.0);
        setDownloadProgress(progress);
        onDownloadProgress?.(progress);
      }

      setIsReady(true);
      setIsDownloading(false);
      onReady?.();
      
      console.log('[useCactusAI] Model download complete');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsDownloading(false);
      onError?.(error);
    }
  }, [isDownloading, isReady, onDownloadProgress, onReady, onError]);

  const complete = useCallback(async (
    params: CactusCompletionParams
  ): Promise<CactusCompletionResult> => {
    if (!isReady) {
      throw new Error('Model not ready. Call download() first.');
    }

    setIsGenerating(true);
    setCompletion('');
    setError(null);

    try {
      // Note: This will be uncommented when cactus-react-native is properly installed
      // const result = await cactusRef.current?.complete({
      //   messages: params.messages,
      //   temperature: params.temperature,
      //   maxTokens: params.maxTokens,
      //   stream: params.stream,
      //   onStreamChunk: (chunk) => {
      //     setCompletion(prev => prev + chunk);
      //     params.onStreamChunk?.(chunk);
      //   },
      // });

      // For PoC purposes, simulate inference
      console.log('[useCactusAI] Generating completion for messages:', params.messages);
      
      // Sanitize last message content for safe display
      const lastMessage = params.messages[params.messages.length - 1];
      const userQuery = lastMessage?.content 
        ? lastMessage.content.slice(0, SIMULATION_USER_QUERY_MAX_LENGTH) // Limit length
        : 'unknown query';
      
      const simulatedResponse = `This is a simulated on-device AI response. When cactus-react-native is properly installed, this will generate real responses using on-device inference. User asked: "${userQuery}"`;
      
      // Simulate streaming if enabled
      if (params.stream) {
        const words = simulatedResponse.split(' ');
        let accumulatedText = '';
        
        for (const word of words) {
          await new Promise(resolve => setTimeout(resolve, SIMULATION_STREAM_DELAY_MS));
          accumulatedText += word + ' ';
          setCompletion(accumulatedText.trim());
          params.onStreamChunk?.(word + ' ');
        }
      } else {
        setCompletion(simulatedResponse);
      }

      setIsGenerating(false);

      return {
        response: simulatedResponse,
        tokens: simulatedResponse.split(' ').length,
        finishReason: 'stop',
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsGenerating(false);
      onError?.(error);
      throw error;
    }
  }, [isReady, onError]);

  const destroy = useCallback(async () => {
    try {
      // Note: This will be uncommented when cactus-react-native is properly installed
      // await cactusRef.current?.destroy();
      
      console.log('[useCactusAI] Destroying CactusLM instance');
      cactusRef.current = null;
      setIsReady(false);
      setIsDownloading(false);
      setDownloadProgress(0);
      setCompletion('');
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [onError]);

  return {
    isDownloading,
    downloadProgress,
    isReady,
    isGenerating,
    completion,
    download,
    complete,
    destroy,
    error,
  };
}
