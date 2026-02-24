import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readProviders } from '../../server/utils/providerConfig'
import handler from '../../server/api/agent/providers/index.get'

vi.mock('../../server/utils/providerConfig', () => ({
  readProviders: vi.fn()
}))

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.get('/api/agent/providers', handler)
  app.use(router)
  return toWebHandler(app)
}

const get = (h: ReturnType<typeof toWebHandler>) =>
  h(new Request('http://localhost/api/agent/providers'))

describe('GET /api/agent/providers', () => {
  beforeEach(() => {
    vi.mocked(readProviders).mockResolvedValue({
      version: 2,
      credentials: {
        openai: { apiKey: 'sk-abcdefghijklmnopqrstuvwxyz' },
        anthropic: { apiKey: '' },
        groq: { apiKey: '' }
      },
      active: { providerId: 'openai', modelId: 'gpt-4o-mini' },
      migrationWarnings: []
    })
  })

  it('returns credential status with masked token preview only', async () => {
    const handle = makeApp()
    const res = await get(handle)

    expect(res.status).toBe(200)
    const json = await res.json() as {
      credentials: Record<'openai' | 'anthropic', { configured: boolean, tokenPreview: string | null }>
    }

    expect(json.credentials.openai.configured).toBe(true)
    expect(json.credentials.openai.tokenPreview).toBe('sk-ab...')
    expect(json.credentials.openai.tokenPreview).not.toContain('abcdefghijklmnopqrstuvwxyz')

    expect(json.credentials.anthropic.configured).toBe(false)
    expect(json.credentials.anthropic.tokenPreview).toBeNull()
  })
})
