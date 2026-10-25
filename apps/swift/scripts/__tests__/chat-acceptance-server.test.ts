import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isString } from '@packrat/guards';
import { afterEach, describe, expect, it } from 'vitest';
import { CHAT_FIXTURE_ID, startChatAcceptanceServer } from '../lib/chat-acceptance-server';

let fixture: Awaited<ReturnType<typeof startChatAcceptanceServer>> | undefined;
afterEach(async () => {
  await fixture?.stop();
});
async function start() {
  fixture = await startChatAcceptanceServer(0);
  const address = fixture.server.address();
  if (!address || isString(address)) throw new Error('Expected TCP listener');
  expect(address.address).toBe('127.0.0.1');
  return `http://127.0.0.1:${address.port}`;
}
async function readThrough(reader: ReadableStreamDefaultReader<Uint8Array>, text: string) {
  let received = '';
  while (!received.includes(text)) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error('Stream ended before expected text');
    received += new TextDecoder().decode(chunk.value);
  }
  return received;
}
const auth = { authorization: 'Bearer packrat-e2e-session' };

describe('isolated chat acceptance server', () => {
  it('binds only loopback, identifies itself and rejects unknown routes/config/auth', async () => {
    const base = await start();
    expect(await (await fetch(`${base}/fixture/health`)).json()).toEqual({
      fixture: CHAT_FIXTURE_ID,
    });
    expect((await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST' })).status).toBe(404);
    expect((await fetch(`${base}/fixture/reset/unknown`, { method: 'POST' })).status).toBe(400);
    expect((await fetch(`${base}/fixture/release`, { method: 'POST' })).status).toBe(409);
    for (const authorization of ['', 'Bearer synthetic-wrong']) {
      expect(
        (await fetch(`${base}/api/chat`, { method: 'POST', headers: { authorization } })).status,
      ).toBe(401);
    }
    // The fixture has no outbound API: lock this architectural constraint down.
    const source = await readFile(
      new URL('../lib/chat-acceptance-server.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/\b(?:fetch|connect|request)\s*\(/);
  });

  it('emits HTTP200 SSE error, then a controlled multi-delta answer and DONE', async () => {
    const base = await start();
    await fetch(`${base}/fixture/reset/error`, { method: 'POST' });
    const failed = await fetch(`${base}/api/chat`, { method: 'POST', headers: auth });
    expect(failed.status).toBe(200);
    expect(await failed.text()).toContain(
      '"type":"error","errorText":"Fixture chat failed. Please try again."',
    );
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: auth });
    if (!response.body) throw new Error('Missing stream body');
    const reader = response.body.getReader();
    const first = await readThrough(reader, 'Fixture answer');
    expect(first).toContain('Fixture answer');
    expect(first).not.toContain('[DONE]');
    expect((await fetch(`${base}/fixture/release`, { method: 'POST' })).status).toBe(200);
    let rest = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += new TextDecoder().decode(chunk.value);
    }
    expect(rest).toContain(' complete.');
    expect(rest).toContain('data: [DONE]');
  });

  it('observes disconnected partial stream and permits immediate second request', async () => {
    const base = await start();
    await fetch(`${base}/fixture/reset/hold`, { method: 'POST' });
    const abort = new AbortController();
    const first = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: auth,
      signal: abort.signal,
    });
    if (!first.body) throw new Error('Missing stream body');
    const reader = first.body.getReader();
    expect(await readThrough(reader, 'First partial')).toContain('First partial');
    abort.abort();
    await reader.cancel().catch(() => undefined);
    const second = await fetch(`${base}/api/chat`, { method: 'POST', headers: auth });
    expect(second.status).toBe(200);
    await expect.poll(async () => (await fetch(`${base}/fixture/cancelled`)).status).toBe(200);
    await fetch(`${base}/fixture/release`, { method: 'POST' });
    const text = await second.text();
    expect(text).toContain('Fixture answer');
    expect(text).not.toContain('First partial');
    expect(text).toContain('[DONE]');
  });
});

it('fails closed when absent and never replaces an occupied fixture port', async () => {
  const base = await start();
  const port = Number(new URL(base).port);
  await expect(startChatAcceptanceServer(port)).rejects.toMatchObject({ code: 'EADDRINUSE' });
  await fixture?.stop();
  fixture = undefined;
  await expect(fetch(`${base}/fixture/health`)).rejects.toThrow();
});

it('registers exactly the dedicated acceptance suite without adding it to live full runs', async () => {
  const root = new URL('../../', import.meta.url);
  const dedicated = JSON.parse(
    await readFile(new URL('TestPlans/iOS-ChatAcceptance.xctestplan', root), 'utf8'),
  );
  const full = JSON.parse(await readFile(new URL('TestPlans/iOS-Full.xctestplan', root), 'utf8'));
  const project = await readFile(new URL('project.yml', root), 'utf8');
  const suite = await readFile(
    new URL('Tests/PackRatUITests/ChatAcceptanceTests.swift', root),
    'utf8',
  );
  expect(dedicated.testTargets).toHaveLength(1);
  expect(dedicated.testTargets[0].selectedTests).toEqual(['ChatAcceptanceTests']);
  expect(dedicated.testTargets[0].parallelizable).toBe(false);
  expect(
    full.testTargets.find(
      (target: { target: { name: string } }) => target.target.name === 'PackRatUITests',
    ).skippedTests,
  ).toContain('ChatAcceptanceTests');
  expect(project).toContain('path: TestPlans/iOS-ChatAcceptance.xctestplan');
  expect(suite.match(/func test\w+\(/g)).toHaveLength(3);
  expect(suite).toContain('final class ChatAcceptanceTests: XCTestCase');
  expect(suite).toContain('throw FixtureError.invalidConfiguration');
  expect(suite).toContain('throw FixtureError.wrongServer');
});

it('owns the Bun CLI listener and exits cleanly on SIGTERM', async () => {
  const child = spawn(
    'bun',
    [fileURLToPath(new URL('../chat-acceptance-server.ts', import.meta.url))],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const exited = once(child, 'exit');
  const deadline = setTimeout(() => child.kill('SIGKILL'), 3000);
  try {
    const output = once(child.stdout, 'data');
    const ready = await Promise.race([
      output.then(([chunk]) => String(chunk)),
      exited.then(() => {
        throw new Error('Fixture CLI exited before binding');
      }),
    ]);
    expect(ready).toContain('Chat fixture listening only on http://127.0.0.1:18793');
    expect((await fetch('http://127.0.0.1:18793/fixture/health')).status).toBe(200);
    child.kill('SIGTERM');
    expect(await exited).toEqual([0, null]);
    await expect(fetch('http://127.0.0.1:18793/fixture/health')).rejects.toThrow();
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});
