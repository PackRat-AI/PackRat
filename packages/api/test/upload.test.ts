import app from '../src/index'
import { describe, it, expect } from 'vitest'

describe('upload route', () => {
  it('requires auth', async () => {
    const res = await app.fetch(new Request('http://localhost/api/upload/presigned', { method: 'GET' }))
    expect(res.status).toBe(401)
  })
})
