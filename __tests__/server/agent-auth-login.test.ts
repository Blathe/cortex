import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readToken } from '../../server/utils/authToken'
import loginHandler from '../../server/api/agent/auth/login.post'

vi.mock('../../server/utils/authToken')

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/login', loginHandler)
  app.use(router)
  return toWebHandler(app)
}

const post = (handler: ReturnType<typeof toWebHandler>, body: unknown) =>
  handler(new Request('http://localhost/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }))

describe('POST /api/agent/auth/login', () => {
  beforeEach(() => {
    vi.mocked(readToken).mockReturnValue('server-token')
  })

  it('returns 400 when token is missing in request body', async () => {
    const handle = makeApp()
    const res = await post(handle, {})
    expect(res.status).toBe(400)
  })

  it('returns 400 when server has no configured token', async () => {
    vi.mocked(readToken).mockReturnValue(null)
    const handle = makeApp()
    const res = await post(handle, { token: 'anything' })
    expect(res.status).toBe(400)
  })

  it('returns 401 when provided token is invalid', async () => {
    const handle = makeApp()
    const res = await post(handle, { token: 'wrong-token' })
    expect(res.status).toBe(401)
  })

  it('returns 200 and sets auth cookie when token is valid', async () => {
    const handle = makeApp()
    const res = await post(handle, { token: 'server-token' })
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toContain('cortex_auth=')
  })
})
