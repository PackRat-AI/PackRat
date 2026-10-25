import { createServer, type ServerResponse } from 'node:http';
import { safeJsonStringify } from '@packrat/utils';

export const CHAT_FIXTURE_PORT = 18793;
export const CHAT_FIXTURE_ID = 'packrat-chat-acceptance-v1';

type Scenario = 'error' | 'hold' | 'success';

// No fetch, proxy, provider SDK, filesystem or credentials: all responses are
// scripted here. Bind only IPv4 loopback, never an environment-supplied host.
export async function startChatAcceptanceServer(port = CHAT_FIXTURE_PORT) {
  let scenario: Scenario = 'success';
  let active: ServerResponse | undefined;
  let cancelled = 0;
  let chats = 0;
  let generation = 0;
  const sockets = new Set<import('node:net').Socket>();
  const event = (response: ServerResponse) => (value: object) =>
    response.write(`data: ${safeJsonStringify(value)}\n\n`);
  const server = createServer((request, response) => {
    const reply = ({ status, value }: { status: number; value: object }) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(safeJsonStringify(value));
    };
    if (request.method === 'GET' && request.url === '/fixture/health') {
      reply({ status: 200, value: { fixture: CHAT_FIXTURE_ID } });
      return;
    }
    if (request.method === 'POST' && request.url?.startsWith('/fixture/reset/')) {
      const selected = request.url.slice('/fixture/reset/'.length);
      if (selected !== 'error' && selected !== 'hold' && selected !== 'success') {
        reply({ status: 400, value: { error: 'Unknown fixture' } });
        return;
      }
      generation += 1;
      active?.destroy();
      active = undefined;
      scenario = selected;
      cancelled = 0;
      chats = 0;
      reply({ status: 200, value: { fixture: CHAT_FIXTURE_ID } });
      return;
    }
    if (request.method === 'POST' && request.url === '/fixture/release') {
      if (!active || active.destroyed) {
        reply({ status: 409, value: { error: 'No active answer' } });
        return;
      }
      event(active)({ type: 'text-delta', id: 'answer', delta: ' complete.' });
      event(active)({ type: 'text-end', id: 'answer' });
      active.end('data: [DONE]\n\n');
      active = undefined;
      reply({ status: 200, value: { fixture: CHAT_FIXTURE_ID } });
      return;
    }
    if (request.method === 'GET' && request.url === '/fixture/cancelled') {
      reply({ status: cancelled === 1 && chats === 2 ? 200 : 409, value: { cancelled, chats } });
      return;
    }
    if (request.method !== 'POST' || request.url !== '/api/chat') {
      reply({ status: 404, value: { error: 'Fixture has no upstream fallback' } });
      return;
    }
    // Existing local synthetic seed token only; never accept a deployed token.
    if (request.headers.authorization !== 'Bearer packrat-e2e-session') {
      reply({ status: 401, value: { error: 'Synthetic fixture identity required' } });
      return;
    }
    request.resume();
    chats += 1;
    const selected = scenario;
    const streamGeneration = generation;
    scenario = 'success';
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    response.flushHeaders();
    if (selected === 'error') {
      event(response)({ type: 'error', errorText: 'Fixture chat failed. Please try again.' });
      response.end('data: [DONE]\n\n');
      return;
    }
    active = response;
    event(response)({ type: 'text-start', id: 'answer' });
    event(response)({
      type: 'text-delta',
      id: 'answer',
      delta: selected === 'hold' ? 'First partial' : 'Fixture answer',
    });
    response.once('close', () => {
      if (generation === streamGeneration && !response.writableEnded && selected === 'hold')
        cancelled += 1;
      if (active === response) active = undefined;
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    server,
    stop: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
