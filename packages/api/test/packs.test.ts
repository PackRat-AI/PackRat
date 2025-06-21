import app from '../src/index'
import { describe, it, expect } from 'vitest'

describe('packs routes', () => {
  it('list requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/packs', { method: 'GET' }))
    expect(res.status).toBe(401)
  })

  it('pack requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/packs/1', { method: 'GET' }))
    expect(res.status).toBe(401)
  })
})
