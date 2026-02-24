import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../server/api/agent/config.get'
import { isGitAutomationEnabled, readSettings } from '../../server/utils/agentConfig'
import { readToken } from '../../server/utils/authToken'

vi.mock('../../server/utils/agentConfig', () => ({
  isGitAutomationEnabled: vi.fn(),
  readSettings: vi.fn()
}))

vi.mock('../../server/utils/authToken', () => ({
  readToken: vi.fn()
}))

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.get('/api/agent/config', handler)
  app.use(router)
  return toWebHandler(app)
}

const get = (h: ReturnType<typeof toWebHandler>) =>
  h(new Request('http://localhost/api/agent/config'))

const baseSettings = {
  version: 1,
  persona: {
    name: 'Cortex',
    tone: 'professional',
    verbosity: 'medium'
  },
  reasoning: {
    temperature: 0.7,
    maxTokens: 2048
  },
  git: {
    autoPush: true,
    autoMerge: true
  },
  meta: {
    onboarded: true,
    updatedAt: '2026-02-24T00:00:00.000Z',
    updatedBy: 'user',
    revision: 3
  }
}

describe('GET /api/agent/config', () => {
  beforeEach(() => {
    vi.mocked(readSettings).mockResolvedValue(baseSettings)
    vi.mocked(isGitAutomationEnabled).mockReturnValue(true)
    vi.mocked(readToken).mockReturnValue('abcde12345secret')
  })

  it('returns masked auth token preview without exposing full token', async () => {
    const handle = makeApp()
    const res = await get(handle)

    expect(res.status).toBe(200)
    const json = await res.json() as { auth: Record<string, unknown> }

    expect(json.auth.configured).toBe(true)
    expect(json.auth.tokenPreview).toBe('abcde...')
    expect(String(json.auth.tokenPreview)).not.toContain('12345secret')
  })

  it('returns null token preview when no token is configured', async () => {
    vi.mocked(readToken).mockReturnValue(null)

    const handle = makeApp()
    const res = await get(handle)

    expect(res.status).toBe(200)
    const json = await res.json() as { auth: Record<string, unknown> }

    expect(json.auth.configured).toBe(false)
    expect(json.auth.tokenPreview).toBeNull()
  })
})
