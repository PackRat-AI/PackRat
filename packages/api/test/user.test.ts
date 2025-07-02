import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe('user items route', () => {
  it('requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/user/items', { method: 'GET' }));
    expect(res.status).toBe(401);
  });
});
