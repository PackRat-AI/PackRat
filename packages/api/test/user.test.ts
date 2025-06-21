import app from '../src/index'
import { describe, it, expect } from 'vitest'

describe('user items route', () => {
  it('requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/user/items', { method: 'GET' }))
    expect(res.status).toBe(401)
  })
})
