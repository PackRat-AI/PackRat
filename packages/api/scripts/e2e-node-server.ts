import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import worker from '../src/e2e-worker';

const port = Number(process.env.PORT ?? 8787);
const kvPersist =
  process.env.E2E_KV_PERSIST_DIR ??
  join(import.meta.dir, '..', '.wrangler', 'state', 'e2e-auth-kv');

const noop = async () => {};

const miniflare = new Miniflare({
  script: 'export default { fetch() { return new Response("ok") } }',
  modules: true,
  kvNamespaces: ['AUTH_KV'],
  kvPersist,
  logRequests: false,
});
const authKv = await miniflare.getKVNamespace('AUTH_KV');

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
  AUTH_KV: authKv,
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
console.log(`AUTH_KV backed by Miniflare local persistence at ${kvPersist}`);

process.on('SIGINT', async () => {
  await miniflare.dispose();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await miniflare.dispose();
  process.exit(0);
});
