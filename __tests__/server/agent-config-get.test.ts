import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../server/api/agent/config.get'
import { isGitAutomationEnabled, readSettings } from '../../server/utils/agentConfig'
import { isPinConfigured } from '../../server/utils/pinAuth'

vi.mock('../../server/utils/agentConfig', () => ({
  isGitAutomationEnabled: vi.fn(),
  readSettings: vi.fn()
}))

vi.mock('../../server/utils/pinAuth', () => ({
  isPinConfigured: vi.fn()
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
    vi.mocked(isPinConfigured).mockReturnValue(true)
  })

  it('returns auth configured=true when PIN is set', async () => {
    const handle = makeApp()
    const res = await get(handle)

    expect(res.status).toBe(200)
    const json = await res.json() as { auth: Record<string, unknown> }
    expect(json.auth.configured).toBe(true)
  })

  it('returns auth configured=false when PIN is not configured', async () => {
    vi.mocked(isPinConfigured).mockReturnValue(false)

    const handle = makeApp()
    const res = await get(handle)

    expect(res.status).toBe(200)
    const json = await res.json() as { auth: Record<string, unknown> }
    expect(json.auth.configured).toBe(false)
  })
})
