import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readProviders, writeProviders } from '../../server/utils/providerConfig'
import providersPostHandler from '../../server/api/agent/providers/index.post'

vi.mock('../../server/utils/providerConfig', () => ({
  readProviders: vi.fn(),
  writeProviders: vi.fn()
}))

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/api/agent/providers', providersPostHandler)
  app.use(router)
  return toWebHandler(app)
}

const post = (handler: ReturnType<typeof toWebHandler>, body: unknown) =>
  handler(new Request('http://localhost/api/agent/providers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }))

describe('POST /api/agent/providers', () => {
  beforeEach(() => {
    vi.mocked(readProviders).mockResolvedValue({ providers: [], activeId: null })
    vi.mocked(writeProviders).mockResolvedValue(undefined)
    vi.mocked(writeProviders).mockClear()
  })

  it('rejects models that are not an array', async () => {
    const handle = makeApp()
    const res = await post(handle, {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: 'gpt-4o'
    })
    expect(res.status).toBe(400)
  })

  it('rejects empty model lists', async () => {
    const handle = makeApp()
    const res = await post(handle, {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: ['   ']
    })
    expect(res.status).toBe(400)
  })

  it('rejects invalid baseUrl values', async () => {
    const handle = makeApp()
    const res = await post(handle, {
      name: 'OpenAI',
      baseUrl: 'not-a-url',
      models: ['gpt-4o']
    })
    expect(res.status).toBe(400)
  })

  it('rejects non-boolean setActive values', async () => {
    const handle = makeApp()
    const res = await post(handle, {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4o'],
      setActive: 'yes'
    })
    expect(res.status).toBe(400)
  })

  it('accepts a valid payload and writes provider config', async () => {
    const handle = makeApp()
    const res = await post(handle, {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      models: ['gpt-4o'],
      setActive: true
    })

    expect(res.status).toBe(200)
    expect(writeProviders).toHaveBeenCalledOnce()

    const configArg = vi.mocked(writeProviders).mock.calls[0]?.[0]
    expect(configArg?.providers?.[0]?.name).toBe('OpenAI')
    expect(configArg?.providers?.[0]?.models).toEqual(['gpt-4o'])
    expect(configArg?.activeId).toBe(configArg?.providers?.[0]?.id)
  })

  it('keeps existing apiKey when update payload apiKey is empty', async () => {
    vi.mocked(readProviders).mockResolvedValue({
      providers: [{
        id: 'provider-1',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'existing-key',
        models: ['gpt-4o']
      }],
      activeId: 'provider-1'
    })

    const handle = makeApp()
    const res = await post(handle, {
      id: 'provider-1',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: ['gpt-4.1']
    })

    expect(res.status).toBe(200)
    const calls = vi.mocked(writeProviders).mock.calls
    const configArg = calls[calls.length - 1]?.[0]
    expect(configArg?.providers?.[0]?.apiKey).toBe('existing-key')
    expect(configArg?.providers?.[0]?.models).toEqual(['gpt-4.1'])
  })
})
