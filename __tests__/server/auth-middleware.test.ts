import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readToken } from '../../server/utils/authToken'
import handler from '../../server/middleware/auth'

vi.mock('../../server/utils/authToken')

const createMockEvent = (path: string, method = 'GET', headers: Record<string, string> = {}) => {
  const req = Object.assign(new IncomingMessage(new Socket()), { url: path, method, headers })
  const res = new ServerResponse(req)
  return createEvent(req, res)
}

describe('auth middleware — path allowlist', () => {
  beforeEach(() => {
    vi.mocked(readToken).mockReturnValue(null)
  })

  it('passes non-agent paths through', () => {
    const event = createMockEvent('/api/chat')
    expect(() => handler(event)).not.toThrow()
  })

  it('allows /api/agent/auth/generate without credentials', () => {
    const event = createMockEvent('/api/agent/auth/generate', 'POST')
    expect(() => handler(event)).not.toThrow()
  })

  it('allows /api/agent/auth/login without credentials', () => {
    const event = createMockEvent('/api/agent/auth/login', 'POST')
    expect(() => handler(event)).not.toThrow()
  })

  it('allows /api/agent/onboarding-status without credentials', () => {
    const event = createMockEvent('/api/agent/onboarding-status')
    expect(() => handler(event)).not.toThrow()
  })

  it('blocks protected agent paths when no token is configured', () => {
    vi.mocked(readToken).mockReturnValue(null)
    const event = createMockEvent('/api/agent/config')
    expect(() => handler(event)).toThrowError(expect.objectContaining({ statusCode: 503 }))
  })
})

describe('auth middleware — token enforcement', () => {
  beforeEach(() => {
    vi.mocked(readToken).mockReturnValue('configured-token')
    delete process.env.CORTEX_SETUP_SECRET
  })

  it('blocks GET /api/agent/config when no credentials are provided', () => {
    const event = createMockEvent('/api/agent/config', 'GET')
    expect(() => handler(event)).toThrow()
  })

  it('blocks POST /api/agent/env when no credentials are provided', () => {
    const event = createMockEvent('/api/agent/env', 'POST')
    expect(() => handler(event)).toThrow()
  })

  it('blocks /api/agent/providers with wrong Bearer token', () => {
    const event = createMockEvent('/api/agent/providers', 'GET', {
      authorization: 'Bearer wrong-token'
    })
    expect(() => handler(event)).toThrow()
  })

  it('allows /api/agent/config with valid Bearer token', () => {
    const event = createMockEvent('/api/agent/config', 'GET', {
      authorization: 'Bearer configured-token'
    })
    expect(() => handler(event)).not.toThrow()
  })

  it('allows /api/agent/config with valid session cookie', () => {
    const event = createMockEvent('/api/agent/config', 'GET', {
      cookie: 'cortex_auth=configured-token'
    })
    expect(() => handler(event)).not.toThrow()
  })

  it('returns 401 status for unauthorized requests', () => {
    const event = createMockEvent('/api/agent/config', 'GET')
    expect(() => handler(event)).toThrowError(expect.objectContaining({ statusCode: 401 }))
  })
})
