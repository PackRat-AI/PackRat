import worker from '../src/e2e-worker';

const port = Number(process.env.PORT ?? 8787);

const noop = async () => {};
const kvStore = new Map<string, { value: string; expiresAt?: number }>();

const kv = {
  get: async (key: string) => {
    const item = kvStore.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      kvStore.delete(key);
      return null;
    }
    return item.value;
  },
  // biome-ignore lint/complexity/useMaxParams: KVNamespace.put receives key, value, and options.
  put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
    kvStore.set(key, {
      value,
      expiresAt: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined,
    });
  },
  delete: async (key: string) => {
    kvStore.delete(key);
  },
  list: async () => ({
    keys: Array.from(kvStore.keys()).map((name) => ({ name })),
    list_complete: true,
    cursor: undefined,
  }),
};

const bucket = {
  get: async () => null,
  put: noop,
  delete: noop,
  list: async () => ({ objects: [], truncated: false }),
};

const queue = {
  send: noop,
  sendBatch: noop,
};

const env = {
  ...process.env,
  CF_VERSION_METADATA: { id: 'e2e-local' },
  AUTH_KV: kv,
  AI: undefined,
  PACKRAT_BUCKET: bucket,
  PACKRAT_SCRAPY_BUCKET: bucket,
  PACKRAT_GUIDES_BUCKET: bucket,
  ETL_QUEUE: queue,
  LOGS_QUEUE: queue,
  EMBEDDINGS_QUEUE: queue,
  ETL_WORKFLOW: { create: async () => ({ id: crypto.randomUUID() }) },
  APP_CONTAINER: {},
};

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
};

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(request) {
    const url = new URL(request.url);
    const startedAt = Date.now();
    const response = await worker.fetch(request, env as never, ctx as never);
    console.log(
      `${request.method} ${url.pathname} -> ${response.status} ${Date.now() - startedAt}ms`,
    );
    return response;
  },
});

console.log(`PackRat e2e API listening on http://0.0.0.0:${port}`);
