import { generateText } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAIProvider } from '../provider';

// Exercise the real SDK adapter. Only fetch is replaced: no credentials or
// network are used. Gateway validation below models the documented native API
// contract; it is not evidence of the configuration of the deployed gateway.
const config = {
  provider: 'openai' as const,
  openAiApiKey: 'sk-synthetic-direct',
  cloudflareAccountId: 'synthetic-account',
  cloudflareGatewayId: 'synthetic-gateway',
  cloudflareApiToken: 'synthetic-cloudflare-token',
  cloudflareAiBinding: {} as never,
};

afterEach(() => vi.unstubAllGlobals());

describe('OpenAI provider wire authentication', () => {
  it('completes a chat against the documented authenticated native gateway contract', async () => {
    const upstream = vi.fn<typeof fetch>(async (_url, init) => {
      const headers = new Headers(init?.headers);
      if (
        headers.get('cf-aig-authorization') !== 'Bearer synthetic-cloudflare-token' ||
        headers.has('authorization')
      ) {
        return new Response(
          JSON.stringify({
            error: { message: 'Synthetic gateway auth rejected', type: 'authentication_error' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          id: 'synthetic-completion',
          object: 'chat.completion',
          created: 0,
          model: 'gpt-4o',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'Ready.' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', upstream);
    const result = await generateText({
      model: createAIProvider(config).chat('gpt-4o'),
      prompt: 'Hello',
      maxRetries: 0,
    });
    expect(result.text).toBe('Ready.');
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it.each([
    'responses',
    'chat',
    'embedding',
  ] as const)('authenticates the %s endpoint without provider credentials', async (kind) => {
    const upstream = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ error: { message: 'Synthetic denial', type: 'authentication_error' } }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', upstream);
    const provider = createAIProvider(config);
    const prompt = [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello' }] }];
    const operation =
      kind === 'embedding'
        ? provider.embedding('text-embedding-3-small').doEmbed({ values: ['Hello'] })
        : (kind === 'chat' ? provider.chat('gpt-4o') : provider('gpt-4o')).doStream({ prompt });
    await expect(operation).rejects.toMatchObject({ statusCode: 401 });
    expect(upstream).toHaveBeenCalledTimes(1);
    const call = upstream.mock.calls[0];
    if (!call) throw new Error('Expected SDK HTTP request');
    const [url, init] = call;
    expect(String(url)).toBe(
      `https://gateway.ai.cloudflare.com/v1/synthetic-account/synthetic-gateway/openai/${kind === 'embedding' ? 'embeddings' : kind === 'chat' ? 'chat/completions' : 'responses'}`,
    );
    const headers = new Headers(init?.headers);
    expect(headers.get('cf-aig-authorization')).toBe('Bearer synthetic-cloudflare-token');
    expect(headers.has('authorization')).toBe(false);
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('preserves cancellation through the gateway transport', async () => {
    let upstreamSignal: AbortSignal | null | undefined;
    const upstream = vi.fn<typeof fetch>(async (_url, init) => {
      upstreamSignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException('Synthetic cancellation', 'AbortError'));
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener('abort', abort, { once: true });
      });
    });
    vi.stubGlobal('fetch', upstream);
    const controller = new AbortController();
    const operation = createAIProvider(config)('gpt-4o').doStream({
      prompt: [],
      abortSignal: controller.signal,
    });
    const rejected = expect(operation).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1));
    controller.abort();
    await rejected;
    expect(upstreamSignal?.aborted).toBe(true);
  });

  it('keeps the direct-provider fallback credentials and URL unchanged', async () => {
    const upstream = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Synthetic denial' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', upstream);
    const provider = createAIProvider({ ...config, cloudflareApiToken: undefined });
    await expect(provider('gpt-4o').doStream({ prompt: [] })).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(upstream).toHaveBeenCalledTimes(1);
    const call = upstream.mock.calls[0];
    if (!call) throw new Error('Expected SDK HTTP request');
    const [url, init] = call;
    expect(String(url)).toBe('https://api.openai.com/v1/responses');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer sk-synthetic-direct');
    expect(headers.has('cf-aig-authorization')).toBe(false);
  });
});
