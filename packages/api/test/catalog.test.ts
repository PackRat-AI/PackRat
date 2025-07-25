import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe('catalog routes', () => {
  it('list requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/catalog/', { method: 'GET' }));
    expect(res.status).toBe(401);
  });

  it('item requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/catalog/1', { method: 'GET' }));
    expect(res.status).toBe(401);
  });
});
