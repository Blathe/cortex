import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readProviders } from '../../server/utils/providerConfig'
import { readSettings } from '../../server/utils/agentConfig'
import { requestProviderChatCompletion } from '../../server/utils/providerRuntime'
import handler from '../../server/api/chat.post'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => 'SYSTEM PROMPT')
}))

vi.mock('../../server/utils/providerConfig', () => ({
  readProviders: vi.fn()
}))

vi.mock('../../server/utils/agentConfig', () => ({
  readSettings: vi.fn()
}))

vi.mock('../../server/utils/providerRuntime', () => ({
  requestProviderChatCompletion: vi.fn()
}))

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/api/chat', handler)
  app.use(router)
  return toWebHandler(app)
}

const post = (h: ReturnType<typeof toWebHandler>, body: unknown) =>
  h(new Request('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }))

describe('POST /api/chat provider runtime resolution', () => {
  beforeEach(() => {
    vi.mocked(readSettings).mockResolvedValue({
      version: 1,
      persona: { name: 'Cortex', tone: 'professional', verbosity: 'medium' },
      reasoning: { temperature: 0.2, maxTokens: 512 },
      git: { autoPush: true, autoMerge: true },
      meta: { onboarded: true, updatedAt: new Date().toISOString(), updatedBy: 'user' }
    })
    vi.mocked(requestProviderChatCompletion).mockResolvedValue('hello from provider')
    vi.mocked(requestProviderChatCompletion).mockClear()
  })

  it('rejects when there is no active runtime', async () => {
    vi.mocked(readProviders).mockResolvedValue({
      version: 2,
      credentials: {
        openai: { apiKey: '' },
        anthropic: { apiKey: '' },
        groq: { apiKey: '' }
      },
      active: null,
      migrationWarnings: []
    })

    const handle = makeApp()
    const res = await post(handle, { prompt: 'hello' })
    expect(res.status).toBe(400)
  })

  it('rejects when active provider has no API key', async () => {
    vi.mocked(readProviders).mockResolvedValue({
      version: 2,
      credentials: {
        openai: { apiKey: '' },
        anthropic: { apiKey: '' },
        groq: { apiKey: '' }
      },
      active: { providerId: 'openai', modelId: 'gpt-4o' },
      migrationWarnings: []
    })

    const handle = makeApp()
    const res = await post(handle, { prompt: 'hello' })
    expect(res.status).toBe(400)
  })

  it('uses server-side active provider/model even when client sends extra fields', async () => {
    vi.mocked(readProviders).mockResolvedValue({
      version: 2,
      credentials: {
        openai: { apiKey: '' },
        anthropic: { apiKey: 'anthropic-key' },
        groq: { apiKey: '' }
      },
      active: { providerId: 'anthropic', modelId: 'claude-3-5-sonnet-latest' },
      migrationWarnings: []
    })

    const handle = makeApp()
    const res = await post(handle, {
      prompt: 'hello',
      provider: 'openai',
      model: 'gpt-4o'
    })
    expect(res.status).toBe(200)
    expect(requestProviderChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'anthropic',
      modelId: 'claude-3-5-sonnet-latest',
      apiKey: 'anthropic-key'
    }))
  })
})
