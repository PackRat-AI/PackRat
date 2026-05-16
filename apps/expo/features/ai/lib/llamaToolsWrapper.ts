/**
 * Wraps LlamaLanguageModel to add proper tool calling support.
 *
 * @react-native-ai/llama v0.10.0 implements the AI SDK LanguageModelV2
 * interface but its doStream/doGenerate completely ignore options.tools —
 * they never reach llama.rn's context.completion(). This wrapper fixes
 * that by calling context.completion() directly with the tools and
 * message format that llama.rn actually expects.
 *
 * Note: we avoid importing from the root @ai-sdk/provider because there
 * are two installed versions (root + ai/node_modules) and they are not
 * assignable to each other in TypeScript even though they're identical at
 * runtime. We use inline structural types instead.
 */

import { generateId } from '@ai-sdk/provider-utils';
import type { LlamaLanguageModel } from '@react-native-ai/llama';

// Minimal structural slice of LanguageModelV2CallOptions we need
type Prompt = ReadonlyArray<{
  role: string;
  // biome-ignore lint/suspicious/noExplicitAny: mirrors AI SDK union
  content: any;
  providerOptions?: unknown;
}>;

type ToolDef = {
  type: 'function';
  name: string;
  description?: string;
  // biome-ignore lint/suspicious/noExplicitAny: JSON schema
  inputSchema: any;
};

type CallOptions = {
  prompt: Prompt;
  tools?: ToolDef[] | readonly ToolDef[];
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
};

// llama.rn OAI-compatible message extended with tool calling fields
// that the model's Jinja template understands.
type LlamaMessage = {
  role: string;
  content?: string;
  // biome-ignore lint/suspicious/noExplicitAny: passed through to Jinja template as-is
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

// biome-ignore lint/suspicious/noExplicitAny: mirrors AI SDK ToolResultOutput union
function toolResultOutputToString(output: any): string {
  if (!output) return '';
  if (typeof output === 'string') return output;
  switch (output.type) {
    case 'text':
    case 'error-text':
      return String(output.value ?? '');
    case 'json':
    case 'error-json':
      return JSON.stringify(output.value);
    case 'content':
      return (output.value ?? [])
        .map((p: { type: string; text?: string }) => (p.type === 'text' ? (p.text ?? '') : ''))
        .join('');
    default:
      return JSON.stringify(output);
  }
}

function convertPromptToLlamaMessages(prompt: Prompt): LlamaMessage[] {
  const out: LlamaMessage[] = [];

  for (const msg of prompt) {
    if (msg.role === 'system') {
      out.push({ role: 'system', content: String(msg.content ?? '') });
      continue;
    }

    if (msg.role === 'user') {
      const parts: { type: string; text?: string }[] = Array.isArray(msg.content)
        ? msg.content
        : [];
      const text = parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('');
      out.push({ role: 'user', content: text });
      continue;
    }

    if (msg.role === 'assistant') {
      const parts: {
        type: string;
        text?: string;
        toolCallId?: string;
        toolName?: string;
        input?: unknown;
      }[] = Array.isArray(msg.content) ? msg.content : [];
      const textParts = parts.filter((p) => p.type === 'text');
      const callParts = parts.filter((p) => p.type === 'tool-call');

      if (callParts.length > 0) {
        out.push({
          role: 'assistant',
          content: textParts.map((p) => p.text ?? '').join(''),
          tool_calls: callParts.map((p) => ({
            type: 'function',
            id: p.toolCallId,
            function: {
              name: p.toolName,
              arguments: typeof p.input === 'string' ? p.input : JSON.stringify(p.input),
            },
          })),
        });
      } else {
        out.push({ role: 'assistant', content: textParts.map((p) => p.text ?? '').join('') });
      }
      continue;
    }

    if (msg.role === 'tool') {
      const parts: { type: string; toolCallId: string; toolName: string; output: unknown }[] =
        Array.isArray(msg.content) ? msg.content : [];
      for (const part of parts) {
        if (part.type !== 'tool-result') continue;
        out.push({
          role: 'tool',
          tool_call_id: part.toolCallId,
          name: part.toolName,
          content: toolResultOutputToString(part.output),
        });
      }
    }
  }

  return out;
}

function convertTools(tools: CallOptions['tools']): object[] | undefined {
  if (!tools?.length) return undefined;
  const fns = (tools as ToolDef[]).filter((t) => t.type === 'function');
  if (!fns.length) return undefined;
  return fns.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

export class LlamaToolsWrapper {
  readonly specificationVersion = 'v2' as const;
  readonly supportedUrls = {};
  readonly provider = 'llama';

  constructor(private readonly inner: LlamaLanguageModel) {}

  get modelId() {
    return this.inner.modelId;
  }

  async doGenerate(_options: CallOptions): Promise<never> {
    throw new Error('LlamaToolsWrapper.doGenerate not implemented');
  }

  async doStream(options: CallOptions): Promise<{ stream: ReadableStream }> {
    const context = this.inner.getContext();
    if (!context) throw new Error('Llama model not prepared. Call prepare() first.');

    const messages = convertPromptToLlamaMessages(options.prompt);
    const llamaTools = convertTools(options.tools);

    const stream = new ReadableStream({
      start: async (controller) => {
        try {
          controller.enqueue({ type: 'stream-start', warnings: [] });

          const result = await context.completion({
            messages: messages as Parameters<typeof context.completion>[0]['messages'],
            tools: llamaTools,
            tool_choice: llamaTools ? 'auto' : undefined,
            temperature: options.temperature,
            n_predict: options.maxOutputTokens,
            top_p: options.topP,
            top_k: options.topK,
          });

          const usage = {
            inputTokens: result.timings?.prompt_n ?? 0,
            outputTokens: result.timings?.predicted_n ?? 0,
            totalTokens: (result.timings?.prompt_n ?? 0) + (result.timings?.predicted_n ?? 0),
          };

          if (result.tool_calls?.length) {
            for (const call of result.tool_calls) {
              controller.enqueue({
                type: 'tool-call',
                toolCallId: call.id ?? generateId(),
                toolName: call.function.name,
                input: call.function.arguments,
              });
            }
            controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage });
          } else {
            const textId = generateId();
            const text = result.content || result.text || '';
            controller.enqueue({ type: 'text-start', id: textId });
            controller.enqueue({ type: 'text-delta', id: textId, delta: text });
            controller.enqueue({ type: 'text-end', id: textId });
            controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
          }

          controller.close();
        } catch (error) {
          try {
            controller.enqueue({ type: 'error', error });
            controller.close();
          } catch {
            // controller already closed
          }
        }
      },
    });

    return { stream };
  }
}
