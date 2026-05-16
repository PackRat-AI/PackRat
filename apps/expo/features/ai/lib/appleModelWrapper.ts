/**
 * Wraps the Apple Foundation Model to fix two defects in its doStream:
 *
 *  1. **"null" artifact** – Apple's native streaming layer emits `data.content = "null"`
 *     (the JSON-serialised tool result) on the first update after a tool call fires.
 *     The accumulative-delta code (`content.slice(previousContent.length)`) then
 *     enqueues "null" as a visible text-delta before the real response arrives.
 *
 *  2. **Missing tool parts** – doStream only emits text-* events; it never emits
 *     `tool-call` or `tool-result` stream parts, so GenUI components never render.
 *
 * Root cause: the Apple provider's `doStream` ignores tool execution in the stream
 * even though `doGenerate` correctly returns `tool-call` / `tool-result` content parts
 * (with `providerExecuted: true`).
 *
 * Fix: override `doStream` to call `doGenerate` and synthesise a proper
 * `ReadableStream<LanguageModelV2StreamPart>` from its result, including matched
 * tool-call / tool-result pairs so that streamText + toUIMessageStream can emit
 * ToolUIParts for GenUI rendering.
 *
 * Trade-off: the Apple model response arrives all-at-once instead of
 * character-by-character. On-device latency is low enough that this is acceptable
 * while the upstream provider bug is unresolved.
 */

import { isString } from '@packrat/guards';

// biome-ignore lint/suspicious/noExplicitAny: Apple model type is unknown at this layer
type AnyModel = any;

let _counter = 0;
function makeId(): string {
  _counter += 1;
  return `atc_${_counter}_${Math.random().toString(36).slice(2, 8)}`;
}

export class AppleModelWrapper {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: Record<string, AnyModel>;

  constructor(private readonly inner: AnyModel) {
    this.provider = inner.provider;
    this.modelId = inner.modelId;
    this.supportedUrls = inner.supportedUrls ?? {};
  }

  doGenerate(options: AnyModel): Promise<AnyModel> {
    return this.inner.doGenerate(options);
  }

  /**
   * Calls `doGenerate` and converts its result into a properly-shaped
   * `LanguageModelV2StreamPart` stream. This sidesteps both defects:
   *
   * - No more "null" delta: we never touch the native streaming path.
   * - Tool parts are emitted: doGenerate gives us the full content array
   *   including tool-call / tool-result pairs.
   */
  async doStream(options: AnyModel): Promise<AnyModel> {
    const result = await this.inner.doGenerate(options);

    // Apple's native bridge inserts a spurious text part with the literal string
    // "null" immediately before tool-call parts (a serialization artifact from the
    // native tool-execution layer). Strip it when tool calls are present.
    const hasToolCalls = result.content.some((p: AnyModel) => p.type === 'tool-call');
    const content: AnyModel[] = hasToolCalls
      ? result.content.filter((p: AnyModel) => !(p.type === 'text' && p.text?.trim() === 'null'))
      : result.content;

    // Pre-assign IDs so every tool-call/tool-result pair shares the same ID.
    // Apple returns them in order: [tool-call₁, tool-result₁, tool-call₂, …, text]
    const toolCallIds: string[] = [];
    for (const part of content) {
      if (part.type === 'tool-call') {
        toolCallIds.push(makeId());
      }
    }

    const stream = new ReadableStream({
      start(controller) {
        let callIdx = 0;
        let resultIdx = 0;

        for (const part of content) {
          if (part.type === 'text' && part.text) {
            const id = makeId();
            controller.enqueue({ type: 'text-start', id });
            controller.enqueue({ type: 'text-delta', id, delta: part.text });
            controller.enqueue({ type: 'text-end', id });
          } else if (part.type === 'tool-call') {
            const toolCallId = toolCallIds[callIdx++] ?? makeId();
            controller.enqueue({
              type: 'tool-call',
              toolCallId,
              toolName: part.toolName,
              // Apple may return input as an object; the spec requires a JSON string
              input: isString(part.input) ? part.input : JSON.stringify(part.input),
              providerExecuted: true,
            });
          } else if (part.type === 'tool-result') {
            const toolCallId = toolCallIds[resultIdx++] ?? makeId();
            controller.enqueue({
              type: 'tool-result',
              toolCallId,
              toolName: part.toolName,
              result: part.result,
              providerExecuted: true,
            });
          }
        }

        controller.enqueue({
          type: 'finish',
          finishReason: result.finishReason ?? 'stop',
          usage: result.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        });

        controller.close();
      },
    });

    return {
      stream,
      rawCall: { rawPrompt: options.prompt, rawSettings: {} },
    };
  }
}
