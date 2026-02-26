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

describe('POST /api/agent/providers/validate — Ollama', () => {
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
    vi.mocked(validateProviderCredentials).mockResolvedValue(undefined)
    vi.mocked(validateProviderCredentials).mockClear()
  })

  it('validates Ollama without an API key and returns live mode', async () => {
    const handle = makeApp()
    const res = await post(handle, { providerId: 'ollama', modelId: 'llama3.2:latest' })
    expect(res.status).toBe(200)
    const json = await res.json() as { ok: boolean, mode: string }
    expect(json.mode).toBe('live')
    expect(validateProviderCredentials).toHaveBeenCalledWith('ollama', 'llama3.2:latest')
  })

  it('rejects Ollama with an empty modelId', async () => {
    const handle = makeApp()
    const res = await post(handle, { providerId: 'ollama', modelId: '' })
    expect(res.status).toBe(400)
    expect(validateProviderCredentials).not.toHaveBeenCalled()
  })

  it('propagates 400 when the model is not installed in Ollama', async () => {
    const { createError } = await import('h3')
    vi.mocked(validateProviderCredentials).mockRejectedValue(
      createError({ statusCode: 400, statusMessage: 'Model "missing:latest" is not installed in Ollama. Run: ollama pull missing:latest' })
    )

    const handle = makeApp()
    const res = await post(handle, { providerId: 'ollama', modelId: 'missing:latest' })
    expect(res.status).toBe(400)
  })

  it('propagates 502 when Ollama daemon is unreachable', async () => {
    const { createError } = await import('h3')
    vi.mocked(validateProviderCredentials).mockRejectedValue(
      createError({ statusCode: 502, statusMessage: 'Ollama is not reachable. Is it running? Try: ollama serve' })
    )

    const handle = makeApp()
    const res = await post(handle, { providerId: 'ollama', modelId: 'llama3.2:latest' })
    expect(res.status).toBe(502)
  })
})
