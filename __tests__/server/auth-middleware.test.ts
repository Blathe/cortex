import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isPinConfigured } from '../../server/utils/pinAuth'
import { createSessionCookieValue } from '../../server/utils/authSession'
import handler from '../../server/middleware/auth'

vi.mock('../../server/utils/pinAuth', () => ({
  isPinConfigured: vi.fn()
}))

const createMockEvent = (path: string, method = 'GET', headers: Record<string, string> = {}) => {
  const req = Object.assign(new IncomingMessage(new Socket()), { url: path, method, headers })
  const res = new ServerResponse(req)
  return createEvent(req, res)
}

describe('auth middleware — path allowlist', () => {
  beforeEach(() => {
    vi.mocked(isPinConfigured).mockReturnValue(false)
    process.env.PIN_PEPPER = 'test-pepper-for-session-signing'
  })

  it('passes non-agent paths through', () => {
    const event = createMockEvent('/api/chat')
    expect(() => handler(event)).not.toThrow()
  })

  it('allows /api/agent/auth/login without credentials', () => {
    const event = createMockEvent('/api/agent/auth/login', 'POST')
    expect(() => handler(event)).not.toThrow()
  })

  it('allows /api/agent/auth/setup without credentials', () => {
    const event = createMockEvent('/api/agent/auth/setup', 'POST')
    expect(() => handler(event)).not.toThrow()
  })

  it('allows /api/agent/auth/status without credentials', () => {
    const event = createMockEvent('/api/agent/auth/status')
    expect(() => handler(event)).not.toThrow()
  })

  it('allows /api/agent/onboarding-status without credentials', () => {
    const event = createMockEvent('/api/agent/onboarding-status')
    expect(() => handler(event)).not.toThrow()
  })

  it('blocks protected agent paths when PIN is not configured', () => {
    vi.mocked(isPinConfigured).mockReturnValue(false)
    const event = createMockEvent('/api/agent/config')
    expect(() => handler(event)).toThrowError(expect.objectContaining({ statusCode: 503 }))
  })
})

describe('auth middleware — session enforcement', () => {
  beforeEach(() => {
    vi.mocked(isPinConfigured).mockReturnValue(true)
    process.env.PIN_PEPPER = 'test-pepper-for-session-signing'
  })

  it('blocks GET /api/agent/config when no session cookie is provided', () => {
    const event = createMockEvent('/api/agent/config', 'GET')
    expect(() => handler(event)).toThrow()
  })

  it('blocks POST /api/agent/env when no session cookie is provided', () => {
    const event = createMockEvent('/api/agent/env', 'POST')
    expect(() => handler(event)).toThrow()
  })

  it('allows /api/agent/config with valid session cookie', () => {
    const session = createSessionCookieValue()
    const event = createMockEvent('/api/agent/config', 'GET', {
      cookie: `cortex_auth=${session}`
    })
    expect(() => handler(event)).not.toThrow()
  })

  it('blocks /api/agent/config with expired session cookie', () => {
    const expiredSession = createSessionCookieValue(0, 60)
    const event = createMockEvent('/api/agent/config', 'GET', {
      cookie: `cortex_auth=${expiredSession}`
    })
    expect(() => handler(event)).toThrow()
  })

  it('returns 401 status for unauthorized requests', () => {
    const event = createMockEvent('/api/agent/config', 'GET')
    expect(() => handler(event)).toThrowError(expect.objectContaining({ statusCode: 401 }))
  })
})
