import { describe, expect, it } from 'vitest';
import app from '../src/index';

const api = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost/api/auth${path}`, init));

describe('auth routes', () => {
  it('login requires body', async () => {
    const res = await api('/login', { method: 'POST', body: JSON.stringify({}) });
    expect(res.status).toBe(400);
  });

  it('register requires body', async () => {
    const res = await api('/register', { method: 'POST', body: JSON.stringify({}) });
    expect(res.status).toBe(400);
  });

  it('me requires auth', async () => {
    const res = await api('/me');
    expect(res.status).toBe(401);
  });
});
