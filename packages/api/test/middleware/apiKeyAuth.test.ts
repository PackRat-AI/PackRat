import { apiKeyAuthPlugin } from '@packrat/api/middleware/auth';
import { getEnv } from '@packrat/api/utils/env-validation';
import { Elysia } from 'elysia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// getEnv is mocked globally by test/setup.ts. Override here to control PACKRAT_API_KEY.
const REAL_API_KEY = 'the-real-server-key-value';

beforeEach(() => {
  vi.mocked(getEnv).mockReturnValue({
    ...vi.mocked(getEnv)(),
    PACKRAT_API_KEY: REAL_API_KEY,
  } as never);
});

function buildCronApp() {
  return new Elysia()
    .use(apiKeyAuthPlugin)
    .post('/cron', () => ({ ok: true }), { isValidApiKey: true });
}

describe('apiKeyAuthPlugin / isValidApiKey', () => {
  it('returns 401 when the X-API-Key header is absent', async () => {
    const app = buildCronApp();
    const res = await app.handle(new Request('http://localhost/cron', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 on a wrong API key', async () => {
    const app = buildCronApp();
    const res = await app.handle(
      new Request('http://localhost/cron', {
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
      new Request('http://localhost/cron', {
        method: 'POST',
        headers: { 'x-api-key': attempt },
      }),
    );
    const body = await res.text();
    expect(body).not.toContain(attempt);
    expect(body).not.toContain(REAL_API_KEY);
  });

  it('accepts the configured PACKRAT_API_KEY', async () => {
    const app = buildCronApp();
    const res = await app.handle(
      new Request('http://localhost/cron', {
        method: 'POST',
        headers: { 'x-api-key': REAL_API_KEY },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('fails closed when PACKRAT_API_KEY env is unset', async () => {
    vi.mocked(getEnv).mockReturnValue({
      ...vi.mocked(getEnv)(),
      PACKRAT_API_KEY: '',
    } as never);
    const app = buildCronApp();
    const res = await app.handle(
      new Request('http://localhost/cron', {
        method: 'POST',
        headers: { 'x-api-key': 'anything' },
      }),
    );
    expect(res.status).toBe(401);
  });
});
