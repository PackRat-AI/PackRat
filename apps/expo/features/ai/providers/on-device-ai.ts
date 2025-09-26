import { apple } from '@react-native-ai/apple';
import { mlc } from '@react-native-ai/mlc';
import type { CoreMessage } from 'ai';
import { Platform } from 'react-native';

export type OnDeviceProvider = 'apple' | 'mlc';

export interface OnDeviceAIConfig {
  // Apple Intelligence configuration
  appleOptions?: {
    availableTools?: Record<string, any>;
  };

  // MLC configuration
  mlcOptions?: {
    modelId?: string;
    downloadProgressCallback?: (progress: { progress: number; modelId: string }) => void;
  };

  // Fallback configuration
  fallbackToCloud?: boolean;
}

export interface DeviceCapabilities {
  supportsAppleIntelligence: boolean;
  supportsMLC: boolean;
  recommendedProvider: OnDeviceProvider | null;
}

/**
 * Detects device capabilities for on-device AI
 */
export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  let supportsAppleIntelligence = false;
  let supportsMLC = false;

  // Check Apple Intelligence availability
  if (Platform.OS === 'ios') {
    try {
      supportsAppleIntelligence = await apple.isAvailable();
    } catch (error) {
      console.warn('Failed to check Apple Intelligence availability:', error);
      supportsAppleIntelligence = false;
    }
  }

  // MLC is available on both iOS and Android
  supportsMLC = true; // MLC can work on most devices but may be slow

  const recommendedProvider: OnDeviceProvider | null = supportsAppleIntelligence
    ? 'apple'
    : supportsMLC
      ? 'mlc'
      : null;

  return {
    supportsAppleIntelligence,
    supportsMLC,
    recommendedProvider,
  };
}

/**
 * On-device AI provider that automatically selects the best available provider
 */
export class OnDeviceAIProvider {
  private capabilities: DeviceCapabilities | null = null;
  private config: OnDeviceAIConfig;
  private mlcModel: ReturnType<typeof mlc.languageModel> | null = null;

  constructor(config: OnDeviceAIConfig = {}) {
    this.config = {
      fallbackToCloud: true,
      mlcOptions: {
        modelId: 'Llama-3.2-3B-Instruct',
        ...config.mlcOptions,
      },
      ...config,
    };
  }

  async initialize(): Promise<void> {
    this.capabilities = await detectDeviceCapabilities();

    // Initialize MLC model if it's the recommended provider
    if (this.capabilities.recommendedProvider === 'mlc') {
      await this.initializeMLC();
    }
  }

  private async initializeMLC(): Promise<void> {
    try {
      const modelId = this.config.mlcOptions?.modelId ?? 'Llama-3.2-3B-Instruct';
      this.mlcModel = mlc.languageModel(modelId);

      // Prepare the model (download if needed)
      if (this.config.mlcOptions?.downloadProgressCallback) {
        await this.mlcModel.download(this.config.mlcOptions.downloadProgressCallback);
      }

      await this.mlcModel.prepare();
    } catch (error) {
      console.error('Failed to initialize MLC:', error);
      throw error;
    }
  }

  async generateText(
    messages: CoreMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {},
  ): Promise<string> {
    if (!this.capabilities) {
      throw new Error('OnDeviceAIProvider not initialized. Call initialize() first.');
    }

    const { recommendedProvider } = this.capabilities;

    if (recommendedProvider === 'apple') {
      return this.generateWithApple(messages, options);
    } else if (recommendedProvider === 'mlc') {
      return this.generateWithMLC(messages, options);
    } else if (this.config.fallbackToCloud) {
      // Fallback to cloud-based AI
      throw new Error('NO_ON_DEVICE_PROVIDER_AVAILABLE');
    } else {
      throw new Error('No on-device AI provider available');
    }
  }

  private async generateWithApple(
    messages: CoreMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<string> {
    try {
      const appleProvider = apple();

      // Convert CoreMessage format to Apple's format
      const appleMessages = messages.map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
              : String(msg.content),
      }));

      const result = await appleProvider.doGenerate({
        prompt: appleMessages,
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      });

      return result.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');
    } catch (error) {
      console.error('Apple AI generation failed:', error);
      throw error;
    }
  }

  private async generateWithMLC(
    messages: CoreMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<string> {
    if (!this.mlcModel) {
      throw new Error('MLC model not initialized');
    }

    try {
      // Convert CoreMessage format to MLC's format
      const mlcMessages = messages.map((msg) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content:
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
              : String(msg.content),
      }));

      const result = await this.mlcModel.doGenerate({
        prompt: mlcMessages,
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      });

      return result.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');
    } catch (error) {
      console.error('MLC AI generation failed:', error);
      throw error;
    }
  }

  async generateStream(
    messages: CoreMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {},
  ): Promise<ReadableStream> {
    if (!this.capabilities) {
      throw new Error('OnDeviceAIProvider not initialized. Call initialize() first.');
    }

    const { recommendedProvider } = this.capabilities;

    if (recommendedProvider === 'apple') {
      return this.generateStreamWithApple(messages, options);
    } else if (recommendedProvider === 'mlc') {
      return this.generateStreamWithMLC(messages, options);
    } else {
      throw new Error('No on-device AI provider available for streaming');
    }
  }

  private async generateStreamWithApple(
    messages: CoreMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<ReadableStream> {
    const appleProvider = apple();

    const appleMessages = messages.map((msg) => ({
      role: msg.role,
      content:
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
            : String(msg.content),
    }));

    const result = await appleProvider.doStream({
      prompt: appleMessages,
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
    });

    return result.stream;
  }

  private async generateStreamWithMLC(
    messages: CoreMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<ReadableStream> {
    if (!this.mlcModel) {
      throw new Error('MLC model not initialized');
    }

    const mlcMessages = messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content:
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
            : String(msg.content),
    }));

    const result = await this.mlcModel.doStream({
      prompt: mlcMessages,
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
    });

    return result.stream;
  }

  getCapabilities(): DeviceCapabilities | null {
    return this.capabilities;
  }

  getConfig(): OnDeviceAIConfig {
    return this.config;
  }

  async cleanup(): Promise<void> {
    if (this.mlcModel) {
      try {
        this.mlcModel.unload();
        this.mlcModel = null;
      } catch (error) {
        console.warn('Error during MLC cleanup:', error);
      }
    }
  }
}
