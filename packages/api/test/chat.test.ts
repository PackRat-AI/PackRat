import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe('chat route', () => {
  it('requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/chat', { method: 'POST' }));
    expect(res.status).toBe(401);
  });
});
