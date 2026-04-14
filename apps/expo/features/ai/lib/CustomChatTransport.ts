import type { UIMessage } from '@ai-sdk/react';
import {
  type ChatRequestOptions,
  type ChatTransport,
  convertToModelMessages,
  type LanguageModel,
  streamText,
  type ToolSet,
  type UIDataTypes,
  type UIMessageChunk,
} from 'ai';

type TypedChunk = UIMessageChunk<unknown, UIDataTypes>;

export class CustomChatTransport implements ChatTransport<UIMessage> {
  private model: LanguageModel | undefined;
  private tools: ToolSet | undefined;

  constructor(model?: LanguageModel, tools?: ToolSet) {
    this.model = model;
    this.tools = tools;
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
  ): Promise<ReadableStream<TypedChunk>> {
    if (!this.model) {
      throw new Error('No model set. Call setModel() before sending messages.');
    }

    const result = streamText({
      model: this.model,
      messages: await convertToModelMessages(options.messages),
      abortSignal: options.abortSignal,
      ...(this.tools ? { tools: this.tools, toolChoice: 'auto' } : {}),
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
  ): Promise<ReadableStream<TypedChunk> | null> {
    return null;
  }
}
