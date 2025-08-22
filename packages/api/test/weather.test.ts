import { sign } from 'hono/jwt';
import { describe, expect, it, vi } from 'vitest';
import app from '../src/index';

describe('weather routes', () => {
  it('search requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/weather/search?q=test'));
    expect(res.status).toBe(401);
  });

  it('search returns data when authed', async () => {
    const token = await sign({ userId: 1 }, 'secret');
    const mockFetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: '1', name: 'Test' }]), {
          status: 200,
        }),
      ),
    );

    // Mock global fetch for this test
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    const res = await app.fetch(
      new Request('http://localhost/api/weather/search?q=test', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].name).toBe('Test');

    // Restore original fetch
    global.fetch = originalFetch;
  });
});
