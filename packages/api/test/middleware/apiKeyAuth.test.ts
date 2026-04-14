import { apiKeyAuthPlugin } from '@packrat/api/middleware/auth';
import { Elysia } from 'elysia';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  vi.stubEnv('JWT_SECRET', 'test-secret-at-least-32-chars-long-xx');
  vi.stubEnv('PACKRAT_API_KEY', 'the-real-server-key-value');
});

function buildCronApp() {
  return new Elysia()
    .use(apiKeyAuthPlugin)
    .post('/cron', () => ({ ok: true }), { isValidApiKey: true });
}

describe('apiKeyAuthPlugin / isValidApiKey', () => {
  it('returns 401 when the X-API-Key header is absent', async () => {
    const app = buildCronApp();
    const res = await app.handle(new Request('http://x/cron', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 on a wrong API key', async () => {
    const app = buildCronApp();
    const res = await app.handle(
      new Request('http://x/cron', {
        method: 'POST',
        headers: { 'x-api-key': 'obviously-wrong-value' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('response body echoes no bytes of the expected or provided key', async () => {
    const app = buildCronApp();
    const attempt = 'attacker-guess-0123456789';
    const res = await app.handle(
      new Request('http://x/cron', {
        method: 'POST',
        headers: { 'x-api-key': attempt },
      }),
    );
    const body = await res.text();
    expect(body).not.toContain(attempt);
    expect(body).not.toContain('the-real-server-key-value');
  });

  it('accepts the configured PACKRAT_API_KEY', async () => {
    const app = buildCronApp();
    const res = await app.handle(
      new Request('http://x/cron', {
        method: 'POST',
        headers: { 'x-api-key': 'the-real-server-key-value' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('fails closed when PACKRAT_API_KEY env is unset', async () => {
    vi.stubEnv('PACKRAT_API_KEY', '');
    const app = buildCronApp();
    const res = await app.handle(
      new Request('http://x/cron', {
        method: 'POST',
        headers: { 'x-api-key': 'anything' },
      }),
    );
    expect(res.status).toBe(401);
    vi.stubEnv('PACKRAT_API_KEY', 'the-real-server-key-value');
  });
});
