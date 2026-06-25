import type { UIMessage } from '@ai-sdk/react';
import { isString } from '@packrat/guards';
import { safeJsonStringify } from '@packrat/utils';
import {
  type ChatRequestOptions,
  type ChatTransport,
  convertToModelMessages,
  type LanguageModel,
  stepCountIs,
  streamText,
  type ToolSet,
  type UIMessageChunk,
} from 'ai';

export class CustomChatTransport implements ChatTransport<UIMessage> {
  private model: LanguageModel | undefined;
  private tools: ToolSet | undefined;
  private systemPrompt: string | undefined;

  constructor({
    model,
    tools,
    systemPrompt,
  }: { model?: LanguageModel; tools?: ToolSet; systemPrompt?: string } = {}) {
    this.model = model;
    this.tools = tools;
    this.systemPrompt = systemPrompt;
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
      messages: await convertToModelMessages(options.messages),
      abortSignal: options.abortSignal,
      stopWhen: stepCountIs(5),
      ...(this.systemPrompt ? { system: this.systemPrompt } : {}),
      ...(this.tools ? { tools: this.tools, toolChoice: 'auto' } : {}),
    });

    return result.toUIMessageStream({
      onError: (error) => {
        if (error == null) {
          return 'Unknown error';
        }
        if (isString(error)) {
          return error;
        }
        if (error instanceof Error) {
          return error.message;
        }
        return safeJsonStringify(error);
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
