import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe('upload route', () => {
  it('requires auth', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/upload/presigned', { method: 'GET' })
    );
    expect(res.status).toBe(401);
  });
});
