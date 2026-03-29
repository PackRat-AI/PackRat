import type { UIMessage } from '@ai-sdk/react';
import {
  type ChatRequestOptions,
  type ChatTransport,
  convertToModelMessages,
  type LanguageModel,
  streamText,
  type UIMessageChunk,
} from 'ai';

export class CustomChatTransport implements ChatTransport<UIMessage> {
  private model: LanguageModel | undefined;

  constructor(model?: LanguageModel) {
    this.model = model;
  }

  setModel(model: LanguageModel) {
    this.model = model;
  }

  async sendMessages(
    options: {
      chatId: string;
      messages: UIMessage[];
      abortSignal: AbortSignal | undefined;
    } & {
      trigger: 'submit-message' | 'regenerate-message';
      messageId: string | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    if (!this.model) {
      throw new Error('No model set. Call setModel() before sending messages.');
    }

    const result = streamText({
      model: this.model,
      messages: convertToModelMessages(options.messages),
      abortSignal: options.abortSignal,
      toolChoice: 'auto',
    });

    return result.toUIMessageStream({
      onError: (error) => {
        if (error == null) {
          return 'Unknown error';
        }
        if (typeof error === 'string') {
          return error;
        }
        if (error instanceof Error) {
          return error.message;
        }
        return JSON.stringify(error);
      },
    });
  }

  async reconnectToStream(
    _options: {
      chatId: string;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
