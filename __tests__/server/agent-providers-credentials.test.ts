import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readProviders, writeProviders } from '../../server/utils/providerConfig'
import handler from '../../server/api/agent/providers/credentials.post'

vi.mock('../../server/utils/providerConfig', () => ({
  readProviders: vi.fn(),
  writeProviders: vi.fn()
}))

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/api/agent/providers/credentials', handler)
  app.use(router)
  return toWebHandler(app)
}

const post = (h: ReturnType<typeof toWebHandler>, body: unknown) =>
  h(new Request('http://localhost/api/agent/providers/credentials', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }))

describe('POST /api/agent/providers/credentials', () => {
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

  it('rejects api keys containing newline characters', async () => {
    const handle = makeApp()
    const res = await post(handle, { providerId: 'openai', apiKey: 'abc\ndef' })
    expect(res.status).toBe(400)
  })

  it('stores a valid api key and reports configured=true with masked preview', async () => {
    const handle = makeApp()
    const res = await post(handle, { providerId: 'openai', apiKey: '  sk-test  ' })
    expect(res.status).toBe(200)

    const payload = vi.mocked(writeProviders).mock.calls[0]?.[0]
    expect(payload.credentials.openai.apiKey).toBe('sk-test')

    const json = await res.json() as { configured: boolean, tokenPreview: string | null }
    expect(json.configured).toBe(true)
    expect(json.tokenPreview).toBe('sk-te...')
  })

  it('allows clearing an existing key and reports configured=false', async () => {
    vi.mocked(readProviders).mockResolvedValue({
      version: 2,
      credentials: {
        openai: { apiKey: 'sk-existing' },
        anthropic: { apiKey: '' },
        groq: { apiKey: '' },
        ollama: { apiKey: '' }
      },
      active: null,
      migrationWarnings: []
    })

    const handle = makeApp()
    const res = await post(handle, { providerId: 'openai', apiKey: '' })
    expect(res.status).toBe(200)

    const payload = vi.mocked(writeProviders).mock.calls[0]?.[0]
    expect(payload.credentials.openai.apiKey).toBe('')

    const json = await res.json() as { configured: boolean, tokenPreview: string | null }
    expect(json.configured).toBe(false)
    expect(json.tokenPreview).toBeNull()
  })
})
