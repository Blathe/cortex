import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readProviders, writeProviders } from '../../server/utils/providerConfig'
import handler from '../../server/api/agent/providers/active.post'

vi.mock('../../server/utils/providerConfig', () => ({
  readProviders: vi.fn(),
  writeProviders: vi.fn()
}))

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/api/agent/providers/active', handler)
  app.use(router)
  return toWebHandler(app)
}

const post = (h: ReturnType<typeof toWebHandler>, body: unknown) =>
  h(new Request('http://localhost/api/agent/providers/active', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }))

describe('POST /api/agent/providers/active', () => {
  beforeEach(() => {
    vi.mocked(readProviders).mockResolvedValue({
      version: 2,
      credentials: {
        openai: { apiKey: '' },
        anthropic: { apiKey: '' },
        groq: { apiKey: '' },
        ollama: { apiKey: '' }
      },
      active: null,
      migrationWarnings: []
    })
    vi.mocked(writeProviders).mockResolvedValue(undefined)
    vi.mocked(writeProviders).mockClear()
  })

  it('sets a valid provider/model as active', async () => {
    const handle = makeApp()
    const res = await post(handle, { providerId: 'openai', modelId: 'gpt-4o' })
    expect(res.status).toBe(200)
    expect(writeProviders).toHaveBeenCalledOnce()
    const payload = vi.mocked(writeProviders).mock.calls[0]?.[0]
    expect(payload.active).toEqual({ providerId: 'openai', modelId: 'gpt-4o' })
  })

  it('rejects unknown providers', async () => {
    const handle = makeApp()
    const res = await post(handle, { providerId: 'custom', modelId: 'x' })
    expect(res.status).toBe(400)
  })

  it('rejects models that are not valid for the provider', async () => {
    const handle = makeApp()
    const res = await post(handle, { providerId: 'anthropic', modelId: 'gpt-4o' })
    expect(res.status).toBe(400)
  })
})
