import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateToken, readToken, writeToken } from '../../server/utils/authToken'
import generateHandler from '../../server/api/agent/auth/generate.post'

vi.mock('../../server/utils/authToken')

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/generate', generateHandler)
  app.use(router)
  return toWebHandler(app)
}

const post = (
  handler: ReturnType<typeof toWebHandler>,
  headers: Record<string, string> = {}
) =>
  handler(new Request('http://localhost/generate', {
    method: 'POST',
    headers
  }))

describe('POST /api/agent/auth/generate — bootstrap (no existing token)', () => {
  beforeEach(() => {
    vi.mocked(readToken).mockReturnValue(null)
    vi.mocked(generateToken).mockReturnValue('new-token-hex')
    vi.mocked(writeToken).mockImplementation(() => {})
    delete process.env.CORTEX_SETUP_SECRET
  })

  it('allows bootstrap when CORTEX_SETUP_SECRET is not set', async () => {
    const handle = makeApp()
    const res = await post(handle)
    expect(res.status).toBe(200)
  })

  it('returns the generated token in the response body', async () => {
    const handle = makeApp()
    const res = await post(handle)
    const body = await res.json() as { token: string }
    expect(body.token).toBe('new-token-hex')
  })

  it('writes the generated token to storage', async () => {
    const handle = makeApp()
    await post(handle)
    expect(writeToken).toHaveBeenCalledWith('new-token-hex')
  })

  it('blocks bootstrap when CORTEX_SETUP_SECRET is set and header is missing', async () => {
    process.env.CORTEX_SETUP_SECRET = 'my-super-secret'
    const handle = makeApp()
    const res = await post(handle)
    expect(res.status).toBe(403)
  })

  it('blocks bootstrap when CORTEX_SETUP_SECRET is set and header is wrong', async () => {
    process.env.CORTEX_SETUP_SECRET = 'my-super-secret'
    const handle = makeApp()
    const res = await post(handle, { 'x-cortex-setup-secret': 'wrong-value' })
    expect(res.status).toBe(403)
  })

  it('allows bootstrap when CORTEX_SETUP_SECRET is set and header matches', async () => {
    process.env.CORTEX_SETUP_SECRET = 'my-super-secret'
    const handle = makeApp()
    const res = await post(handle, { 'x-cortex-setup-secret': 'my-super-secret' })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/agent/auth/generate — token rotation (existing token)', () => {
  beforeEach(() => {
    vi.mocked(readToken).mockReturnValue('existing-token')
    vi.mocked(generateToken).mockReturnValue('rotated-token-hex')
    vi.mocked(writeToken).mockImplementation(() => {})
    delete process.env.CORTEX_SETUP_SECRET
  })

  it('blocks rotation when no credentials are provided', async () => {
    const handle = makeApp()
    const res = await post(handle)
    expect(res.status).toBe(401)
  })

  it('blocks rotation with wrong Bearer token', async () => {
    const handle = makeApp()
    const res = await post(handle, { authorization: 'Bearer wrong-token' })
    expect(res.status).toBe(401)
  })

  it('allows rotation with valid Bearer token', async () => {
    const handle = makeApp()
    const res = await post(handle, { authorization: 'Bearer existing-token' })
    expect(res.status).toBe(200)
  })

  it('allows rotation with valid session cookie', async () => {
    const handle = makeApp()
    const res = await post(handle, { cookie: 'cortex_auth=existing-token' })
    expect(res.status).toBe(200)
  })
})
