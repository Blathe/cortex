import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listOllamaModels } from '../../server/utils/ollamaRuntime'
import handler from '../../server/api/agent/providers/ollama-models.get'

vi.mock('../../server/utils/ollamaRuntime', () => ({
  listOllamaModels: vi.fn()
}))

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.get('/api/agent/providers/ollama-models', handler)
  app.use(router)
  return toWebHandler(app)
}

const get = (h: ReturnType<typeof toWebHandler>) =>
  h(new Request('http://localhost/api/agent/providers/ollama-models'))

describe('GET /api/agent/providers/ollama-models', () => {
  beforeEach(() => {
    vi.mocked(listOllamaModels).mockClear()
  })

  it('returns the list of installed models', async () => {
    vi.mocked(listOllamaModels).mockResolvedValue([
      { id: 'llama3.2:latest', label: 'llama3.2:latest' },
      { id: 'mistral:latest', label: 'mistral:latest' }
    ])

    const handle = makeApp()
    const res = await get(handle)
    expect(res.status).toBe(200)
    const json = await res.json() as { models: { id: string, label: string }[] }
    expect(json.models).toHaveLength(2)
    expect(json.models[0]?.id).toBe('llama3.2:latest')
  })

  it('propagates 502 when Ollama is unreachable', async () => {
    const { createError } = await import('h3')
    vi.mocked(listOllamaModels).mockRejectedValue(
      createError({ statusCode: 502, statusMessage: 'Ollama is not reachable. Is it running? Try: ollama serve' })
    )

    const handle = makeApp()
    const res = await get(handle)
    expect(res.status).toBe(502)
  })
})
