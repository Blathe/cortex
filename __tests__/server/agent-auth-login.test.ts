import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPinAttempts,
  getStoredPinHash,
  isPinConfigured,
  recordPinFailure,
  verifyPin
} from '../../server/utils/pinAuth'
import loginHandler from '../../server/api/agent/auth/login.post'

vi.mock('../../server/utils/pinAuth', () => ({
  isPinConfigured: vi.fn(),
  getStoredPinHash: vi.fn(),
  isValidPin: vi.fn((v: unknown) => typeof v === 'string' && /^\d{6}$/.test(v)),
  verifyPin: vi.fn(),
  enforcePinRateLimit: vi.fn(),
  recordPinFailure: vi.fn(),
  clearPinAttempts: vi.fn()
}))

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
    vi.mocked(isPinConfigured).mockReturnValue(true)
    vi.mocked(getStoredPinHash).mockReturnValue('argon2-hash-stub')
    vi.mocked(verifyPin).mockResolvedValue(false)
    process.env.PIN_PEPPER = 'test-pepper'
  })

  it('returns 400 when pin is missing', async () => {
    const handle = makeApp()
    const res = await post(handle, {})
    expect(res.status).toBe(400)
  })

  it('returns 400 when pin is not 6 digits', async () => {
    const handle = makeApp()
    const res = await post(handle, { pin: '1234' })
    expect(res.status).toBe(400)
  })

  it('returns 503 when PIN is not configured on server', async () => {
    vi.mocked(isPinConfigured).mockReturnValue(false)
    const handle = makeApp()
    const res = await post(handle, { pin: '123456' })
    expect(res.status).toBe(503)
  })

  it('returns 401 when PIN is incorrect', async () => {
    vi.mocked(verifyPin).mockResolvedValue(false)
    const handle = makeApp()
    const res = await post(handle, { pin: '123456' })
    expect(res.status).toBe(401)
    expect(recordPinFailure).toHaveBeenCalled()
  })

  it('returns 200 and sets auth cookie when PIN is correct', async () => {
    vi.mocked(verifyPin).mockResolvedValue(true)
    const handle = makeApp()
    const res = await post(handle, { pin: '123456' })
    expect(res.status).toBe(200)
    expect(clearPinAttempts).toHaveBeenCalled()
    const setCookie = res.headers.get('set-cookie') || ''
    expect(setCookie).toContain('cortex_auth=')

    const body = await res.json() as { ok: boolean, sessionEstablished: boolean }
    expect(body.ok).toBe(true)
    expect(body.sessionEstablished).toBe(true)
  })
})
