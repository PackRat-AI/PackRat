import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe.skipIf(!process.env.API_URL)('health endpoint', () => {
  it('responds', async () => {
    const resp = await app.fetch(new Request('http://localhost/'));
    const text = await resp.text();
    expect(text).toBe('PackRat API is running!');
  });
});
