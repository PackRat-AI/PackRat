import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';

const ragCmd = defineCommand({
  meta: { name: 'rag', description: 'Search the outdoor guides RAG corpus.' },
  args: {
    q: { type: 'positional', required: true, description: 'Question or topic' },
    limit: { type: 'string', default: '5' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi({
      promise: client.ai['rag-search'].get({
        query: { q: args.q, limit: Number.parseInt(args.limit, 10) },
      }),
      action: 'rag search',
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

const webCmd = defineCommand({
  meta: { name: 'web', description: 'Perplexity-powered web search.' },
  args: { q: { type: 'positional', required: true, description: 'Search query' } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi({
      promise: client.ai['web-search'].get({ query: { q: args.q } }),
      action: 'web search',
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

const sqlCmd = defineCommand({
  meta: { name: 'sql', description: 'Execute a read-only SQL SELECT against the API DB.' },
  args: {
    query: { type: 'positional', required: true, description: 'SQL statement' },
    limit: { type: 'string', default: '100' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi({
      promise: client.ai['execute-sql'].post({
        query: args.query,
        limit: Number.parseInt(args.limit, 10),
      }),
      action: 'execute sql',
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

const schemaCmd = defineCommand({
  meta: { name: 'schema', description: 'Print the API database schema.' },
  async run() {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi({ promise: client.ai['db-schema'].get(), action: 'fetch db schema' });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

export default defineCommand({
  meta: {
    name: 'ai',
    description: 'AI / RAG / SQL / web-search helpers (renamed from analytics SQL).',
  },
  subCommands: {
    rag: () => Promise.resolve(ragCmd),
    web: () => Promise.resolve(webCmd),
    sql: () => Promise.resolve(sqlCmd),
    schema: () => Promise.resolve(schemaCmd),
  },
});
