import app from '../src/index'
import { describe, it, expect } from 'vitest'

describe('health endpoint', () => {
  it('responds', async () => {
    const resp = await app.fetch(new Request('http://localhost/'))
    const text = await resp.text()
    expect(text).toBe('PackRat API is running!')
  })
})
