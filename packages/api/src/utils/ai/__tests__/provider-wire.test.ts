import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
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

  it.each([
    ['cloudflareAccountId', undefined],
    ['cloudflareGatewayId', undefined],
    ['cloudflareApiToken', undefined],
    ['cloudflareAccountId', ''],
    ['cloudflareGatewayId', ''],
    ['cloudflareApiToken', ''],
  ] as const)('preserves direct fallback for incomplete %s=%s', async (key, value) => {
    const upstream = vi.fn<typeof fetch>(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', upstream);
    const provider = createAIProvider({ ...config, [key]: value });
    await expect(provider('gpt-4o').doStream({ prompt: [] })).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(upstream).toHaveBeenCalledTimes(1);
    const call = upstream.mock.calls[0];
    if (!call) throw new Error('Expected request');
    expect(String(call[0])).toBe('https://api.openai.com/v1/responses');
    expect(new Headers(call[1]?.headers).get('authorization')).toBe('Bearer sk-synthetic-direct');
    expect(new Headers(call[1]?.headers).has('cf-aig-authorization')).toBe(false);
  });

  it('rejects missing credentials locally without issuing any request', () => {
    const upstream = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', upstream);
    expect(() =>
      createAIProvider({ ...config, cloudflareApiToken: undefined, openAiApiKey: undefined }),
    ).toThrow('OpenAI API key is required');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('does not switch to direct-provider billing when gateway auth is rejected', async () => {
    const upstream = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Synthetic invalid token' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', upstream);
    await expect(
      generateText({
        model: createAIProvider({ ...config, cloudflareApiToken: 'invalid-synthetic-token' }).chat(
          'gpt-4o',
        ),
        prompt: 'Hello',
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(upstream).toHaveBeenCalledTimes(1);
    const call = upstream.mock.calls[0];
    if (!call) throw new Error('Expected request');
    expect(String(call[0])).toContain('gateway.ai.cloudflare.com/');
    expect(new Headers(call[1]?.headers).get('cf-aig-authorization')).toBe(
      'Bearer invalid-synthetic-token',
    );
    expect(new Headers(call[1]?.headers).has('authorization')).toBe(false);
  });

  it('uses complete gateway configuration even without the unused direct key', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const upstream = vi.fn<typeof fetch>(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', upstream);
    try {
      await expect(
        createAIProvider({
          ...config,
          openAiApiKey: undefined,
          cloudflareGatewayId: 'synthetic-logging-check',
        })('gpt-4o').doStream({ prompt: [] }),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(log).toHaveBeenCalledWith(
        'ai.provider.selected',
        expect.objectContaining({ billingPath: 'cloudflare-unified' }),
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(config.cloudflareApiToken);
      expect(JSON.stringify(log.mock.calls)).not.toContain(config.openAiApiKey);
    } finally {
      log.mockRestore();
    }
  });

  it('does not forward the gateway token across an HTTP redirect', async () => {
    // Synthetic token and loopback only. The real Fetch implementation decides
    // whether a redirect forwards custom headers; SDK fetch is routed locally.
    const realFetch = globalThis.fetch;
    let destinationRequests = 0;
    let forwardedCredential: string | string[] | undefined;
    const destination = createServer((_request, response) => {
      destinationRequests += 1;
      forwardedCredential = _request.headers['cf-aig-authorization'];
      response.writeHead(401).end('{}');
    });
    await new Promise<void>((resolve) => destination.listen(0, '127.0.0.1', resolve));
    const destinationPort = (destination.address() as AddressInfo).port;
    const gateway = createServer((_request, response) => {
      response.writeHead(302, { location: `http://127.0.0.1:${destinationPort}/unexpected` }).end();
    });
    await new Promise<void>((resolve) => gateway.listen(0, '127.0.0.1', resolve));
    const gatewayPort = (gateway.address() as AddressInfo).port;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((_url, init) =>
        realFetch(`http://127.0.0.1:${gatewayPort}/responses`, init),
      ),
    );
    try {
      await expect(createAIProvider(config)('gpt-4o').doStream({ prompt: [] })).rejects.toThrow();
      expect(destinationRequests).toBe(0);
      expect(forwardedCredential).toBeUndefined();
    } finally {
      gateway.closeAllConnections();
      destination.closeAllConnections();
      await Promise.all([
        new Promise<void>((resolve, reject) =>
          gateway.close((error) => (error ? reject(error) : resolve())),
        ),
        new Promise<void>((resolve, reject) =>
          destination.close((error) => (error ? reject(error) : resolve())),
        ),
      ]);
    }
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
