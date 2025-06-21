import app from '../src/index'
import { describe, it, expect } from 'vitest'

import { sign } from 'hono/jwt'
import { vi } from 'vitest'

describe('weather routes', () => {
  it('search requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/weather/search?q=test'))
    expect(res.status).toBe(401)
  })

  it('search returns data when authed', async () => {
    const token = await sign({ userId: 1 }, 'secret')
    const mockFetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([{ id: '1', name: 'Test' }]), { status: 200 }))
    )
    vi.stubGlobal('fetch', mockFetch)

    const res = await app.fetch(
      new Request('http://localhost/api/weather/search?q=test', {
        headers: { Authorization: `Bearer ${token}` },
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].name).toBe('Test')

    vi.unstubAllGlobals()
  })
})
