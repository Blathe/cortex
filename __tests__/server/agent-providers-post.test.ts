import { createApp, createRouter, toWebHandler } from 'h3'
import { describe, expect, it } from 'vitest'
import providersPostHandler from '../../server/api/agent/providers/index.post'

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/api/agent/providers', providersPostHandler)
  app.use(router)
  return toWebHandler(app)
}

const post = (handler: ReturnType<typeof toWebHandler>, body: unknown = {}) =>
  handler(new Request('http://localhost/api/agent/providers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }))

describe('POST /api/agent/providers', () => {
  it('returns 410 because the free-form provider endpoint is deprecated', async () => {
    const handle = makeApp()
    const res = await post(handle, {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4o']
    })
    expect(res.status).toBe(410)
  })
})
