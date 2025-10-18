import type { ChatRequestOptions, ChatTransport, CoreMessage, UIMessage, UIMessageChunk } from 'ai';
import { DefaultChatTransport } from 'ai';
import { type DeviceCapabilities, type OnDeviceAIConfig, OnDeviceAIProvider } from './on-device-ai';

export interface OnDeviceChatTransportConfig {
  // On-device AI configuration
  onDeviceConfig?: OnDeviceAIConfig;

  // Cloud fallback configuration (existing DefaultChatTransport config)
  cloudConfig?: {
    api: string;
    headers?: Record<string, string>;
    body?: () => Record<string, any>;
    credentials?: RequestCredentials;
    fetch?: typeof globalThis.fetch;
  };

  // Transport behavior
  preferOnDevice?: boolean;
  fallbackToCloud?: boolean;
  onDeviceOnly?: boolean;
}

/**
 * Chat transport that uses on-device AI with optional cloud fallback
 */
export class OnDeviceChatTransport<UI_MESSAGE extends UIMessage>
  implements ChatTransport<UI_MESSAGE>
{
  private onDeviceProvider: OnDeviceAIProvider | null = null;
  private cloudTransport: DefaultChatTransport<UI_MESSAGE> | null = null;
  private config: OnDeviceChatTransportConfig;
  private isInitialized = false;

  constructor(config: OnDeviceChatTransportConfig = {}) {
    this.config = {
      preferOnDevice: true,
      fallbackToCloud: true,
      onDeviceOnly: false,
      ...config,
    };

    // Initialize cloud transport if fallback is enabled
    if (!this.config.onDeviceOnly && this.config.cloudConfig) {
      this.cloudTransport = new DefaultChatTransport<UI_MESSAGE>(this.config.cloudConfig);
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.onDeviceProvider = new OnDeviceAIProvider(this.config.onDeviceConfig);
      await this.onDeviceProvider.initialize();
      this.isInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize on-device AI provider:', error);

      if (this.config.onDeviceOnly) {
        throw new Error('On-device AI initialization failed and onDeviceOnly is enabled');
      }

      // Continue without on-device AI
      this.onDeviceProvider = null;
      this.isInitialized = true;
    }
  }

  async sendMessages(
    options: {
      trigger: 'submit-message' | 'regenerate-message';
      chatId: string;
      messageId: string | undefined;
      messages: UI_MESSAGE[];
      abortSignal: AbortSignal | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const shouldUseOnDevice = this.shouldUseOnDevice();

    if (shouldUseOnDevice && this.onDeviceProvider) {
      return this.handleOnDeviceGeneration(options);
    } else if (!this.config.onDeviceOnly && this.cloudTransport) {
      return this.cloudTransport.sendMessages(options);
    } else {
      throw new Error('No available AI provider');
    }
  }

  async reconnectToStream(
    options: {
      chatId: string;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    // For on-device AI, we don't support stream reconnection
    // Fall back to cloud transport if available
    if (!this.config.onDeviceOnly && this.cloudTransport) {
      return this.cloudTransport.reconnectToStream(options);
    } else {
      throw new Error('Stream reconnection not supported for on-device AI');
    }
  }

  private shouldUseOnDevice(): boolean {
    if (this.config.onDeviceOnly) {
      return true;
    }

    if (!this.onDeviceProvider) {
      return false;
    }

    const capabilities = this.onDeviceProvider.getCapabilities();
    if (!capabilities || !capabilities.recommendedProvider) {
      return false;
    }

    return this.config.preferOnDevice;
  }

  private async handleOnDeviceGeneration(options: {
    trigger: 'submit-message' | 'regenerate-message';
    chatId: string;
    messageId: string | undefined;
    messages: UI_MESSAGE[];
    abortSignal: AbortSignal | undefined;
  }): Promise<ReadableStream<UIMessageChunk>> {
    if (!this.onDeviceProvider) {
      throw new Error('On-device provider not available');
    }

    try {
      // Convert UI messages to CoreMessage format
      const coreMessages: CoreMessage[] = options.messages.map((msg) => ({
        role: msg.role as CoreMessage['role'],
        content:
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map((part) => (part.type === 'text' ? part.text : '')).join('')
              : msg.parts
                  ?.filter((p) => p.type === 'text')
                  .map((p) => p.text)
                  .join('') || '',
      }));

      // Get streaming response from on-device provider
      const stream = await this.onDeviceProvider.generateStream(coreMessages, {
        temperature: 0.7,
        maxTokens: 1000,
      });

      // Convert the provider stream to UIMessageChunk format
      return this.convertProviderStreamToUIMessageChunks(stream, options.chatId);
    } catch (error) {
      console.error('On-device generation failed:', error);

      // Check if this is a "no provider available" error and we should fall back
      if (
        error instanceof Error &&
        error.message === 'NO_ON_DEVICE_PROVIDER_AVAILABLE' &&
        !this.config.onDeviceOnly &&
        this.cloudTransport
      ) {
        console.log('Falling back to cloud AI...');
        return this.cloudTransport.sendMessages(options);
      }

      throw error;
    }
  }

  private convertProviderStreamToUIMessageChunks(
    providerStream: ReadableStream,
    chatId: string,
  ): ReadableStream<UIMessageChunk> {
    const messageId = `msg-${Date.now()}`;

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        const reader = providerStream.getReader();

        try {
          controller.enqueue({
            type: 'message-start',
            chatId,
            messageId,
          });

          let _fullContent = '';

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.enqueue({
                type: 'message-end',
                chatId,
                messageId,
              });
              controller.close();
              break;
            }

            // Handle different types of stream parts
            if (value.type === 'text-delta') {
              _fullContent += value.delta;
              controller.enqueue({
                type: 'text-delta',
                chatId,
                messageId,
                delta: value.delta,
              });
            } else if (value.type === 'finish') {
              controller.enqueue({
                type: 'finish',
                chatId,
                messageId,
                finishReason: value.finishReason || 'stop',
              });
            }
          }
        } catch (error) {
          controller.enqueue({
            type: 'error',
            chatId,
            messageId,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          controller.close();
        } finally {
          reader.releaseLock();
        }
      },
    });
  }

  getCapabilities(): DeviceCapabilities | null {
    return this.onDeviceProvider?.getCapabilities() || null;
  }

  async cleanup(): Promise<void> {
    if (this.onDeviceProvider) {
      await this.onDeviceProvider.cleanup();
    }
  }
}
