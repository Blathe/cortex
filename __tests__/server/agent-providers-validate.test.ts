import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readProviders } from '../../server/utils/providerConfig'
import { validateProviderCredentials } from '../../server/utils/providerRuntime'
import handler from '../../server/api/agent/providers/validate.post'

vi.mock('../../server/utils/providerConfig', () => ({
  readProviders: vi.fn()
}))

vi.mock('../../server/utils/providerRuntime', () => ({
  validateProviderCredentials: vi.fn()
}))

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/api/agent/providers/validate', handler)
  app.use(router)
  return toWebHandler(app)
}

const post = (h: ReturnType<typeof toWebHandler>, body: unknown) =>
  h(new Request('http://localhost/api/agent/providers/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }))

describe('POST /api/agent/providers/validate', () => {
  beforeEach(() => {
    vi.mocked(readProviders).mockResolvedValue({
      version: 2,
      credentials: {
        openai: { apiKey: 'stored-key' },
        anthropic: { apiKey: '' },
        groq: { apiKey: '' }
      },
      active: null,
      migrationWarnings: []
    })
    vi.mocked(validateProviderCredentials).mockResolvedValue(undefined)
    vi.mocked(validateProviderCredentials).mockClear()
  })

  it('rejects invalid provider/model combinations', async () => {
    const handle = makeApp()
    const res = await post(handle, { providerId: 'anthropic', modelId: 'gpt-4o' })
    expect(res.status).toBe(400)
  })

  it('returns mock mode when no key is available', async () => {
    const handle = makeApp()
    const res = await post(handle, { providerId: 'anthropic', modelId: 'claude-3-5-sonnet-latest' })
    expect(res.status).toBe(200)
    const json = await res.json() as { mode: string }
    expect(json.mode).toBe('mock')
    expect(validateProviderCredentials).not.toHaveBeenCalled()
  })

  it('validates using the provided key when apiKey is supplied', async () => {
    const handle = makeApp()
    const res = await post(handle, {
      providerId: 'openai',
      modelId: 'gpt-4o',
      apiKey: 'sk-manual'
    })
    expect(res.status).toBe(200)
    expect(validateProviderCredentials).toHaveBeenCalledWith('openai', 'gpt-4o', 'sk-manual')
  })
})
