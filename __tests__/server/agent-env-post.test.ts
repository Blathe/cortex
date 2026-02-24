import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeFile } from 'node:fs/promises'
import envHandler from '../../server/api/agent/env.post'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(undefined)
}))

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/api/agent/env', envHandler)
  app.use(router)
  return toWebHandler(app)
}

const post = (handler: ReturnType<typeof toWebHandler>, body: unknown) =>
  handler(new Request('http://localhost/api/agent/env', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }))

describe('POST /api/agent/env — allowlist enforcement', () => {
  const handle = makeApp()

  it('rejects an unknown key with 400', async () => {
    const res = await post(handle, { vars: [{ key: 'SECRET_KEY', value: 'x' }] })
    expect(res.status).toBe(400)
  })

  it('accepts GH_REPO', async () => {
    const res = await post(handle, { vars: [{ key: 'GH_REPO', value: 'owner/repo' }] })
    expect(res.status).toBe(200)
  })

  it('accepts GH_TOKEN', async () => {
    const res = await post(handle, { vars: [{ key: 'GH_TOKEN', value: 'ghp_abc' }] })
    expect(res.status).toBe(200)
  })

  it('rejects missing vars array with 400', async () => {
    const res = await post(handle, {})
    expect(res.status).toBe(400)
  })
})

describe('POST /api/agent/env — value validation', () => {
  const handle = makeApp()

  it('rejects values containing CR', async () => {
    const res = await post(handle, { vars: [{ key: 'GH_TOKEN', value: 'abc\rdef' }] })
    expect(res.status).toBe(400)
  })

  it('rejects values containing LF', async () => {
    const res = await post(handle, { vars: [{ key: 'GH_TOKEN', value: 'abc\ndef' }] })
    expect(res.status).toBe(400)
  })

  it('rejects values exceeding max length', async () => {
    const res = await post(handle, { vars: [{ key: 'GH_TOKEN', value: 'x'.repeat(1001) }] })
    expect(res.status).toBe(400)
  })

  it('accepts values at the max length boundary', async () => {
    const res = await post(handle, { vars: [{ key: 'GH_TOKEN', value: 'x'.repeat(1000) }] })
    expect(res.status).toBe(200)
  })

  it('rejects GH_REPO not in owner/repo format', async () => {
    const res = await post(handle, { vars: [{ key: 'GH_REPO', value: 'not-a-repo' }] })
    expect(res.status).toBe(400)
  })

  it('rejects GH_REPO with multiple slashes', async () => {
    const res = await post(handle, { vars: [{ key: 'GH_REPO', value: 'owner/repo/extra' }] })
    expect(res.status).toBe(400)
  })

  it('accepts valid GH_REPO with hyphens and dots', async () => {
    const res = await post(handle, { vars: [{ key: 'GH_REPO', value: 'my-org/my.repo' }] })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/agent/env — file write', () => {
  beforeEach(() => {
    vi.mocked(writeFile).mockClear()
  })

  it('writes the .env file on a valid request', async () => {
    const handle = makeApp()
    await post(handle, { vars: [{ key: 'GH_REPO', value: 'owner/repo' }] })
    expect(writeFile).toHaveBeenCalledOnce()
  })

  it('serializes the value safely in the written file', async () => {
    const handle = makeApp()
    await post(handle, { vars: [{ key: 'GH_TOKEN', value: 'ghp_abc123' }] })
    const written = vi.mocked(writeFile).mock.calls[0]?.[1] as string
    expect(written).toContain('GH_TOKEN=ghp_abc123')
  })
})
