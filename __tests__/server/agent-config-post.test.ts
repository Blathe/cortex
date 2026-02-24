import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../server/api/agent/config.post'
import {
  classifyRisk,
  commitToBranch,
  createChangeLog,
  isGitAutomationEnabled,
  RevisionConflictError,
  upsertConfigPullRequest,
  validatePatch,
  writeSettings
} from '../../server/utils/agentConfig'

vi.mock('../../server/utils/agentConfig', async () => {
  const actual = await vi.importActual<typeof import('../../server/utils/agentConfig')>('../../server/utils/agentConfig')
  return {
    ...actual,
    classifyRisk: vi.fn(),
    commitToBranch: vi.fn(),
    createChangeLog: vi.fn(),
    isGitAutomationEnabled: vi.fn(),
    upsertConfigPullRequest: vi.fn(),
    validatePatch: vi.fn(),
    writeSettings: vi.fn()
  }
})

const makeApp = () => {
  const app = createApp()
  const router = createRouter()
  router.post('/api/agent/config', handler)
  app.use(router)
  return toWebHandler(app)
}

const post = (h: ReturnType<typeof toWebHandler>, body: unknown) =>
  h(new Request('http://localhost/api/agent/config', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }))

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
    updatedAt: new Date().toISOString(),
    updatedBy: 'user',
    revision: 3
  }
}

describe('POST /api/agent/config', () => {
  beforeEach(() => {
    vi.mocked(validatePatch).mockReturnValue(null)
    vi.mocked(createChangeLog).mockResolvedValue('/tmp/log.md')
    vi.mocked(classifyRisk).mockReturnValue('low')
    vi.mocked(isGitAutomationEnabled).mockReturnValue(true)
    vi.mocked(commitToBranch).mockResolvedValue(undefined)
    vi.mocked(upsertConfigPullRequest).mockResolvedValue({
      status: 'not_attempted',
      skipReason: 'github_not_configured'
    })
    vi.mocked(writeSettings).mockResolvedValue({
      previous: baseSettings,
      next: baseSettings
    })
  })

  it('returns skipped when auto-push is disabled in settings', async () => {
    vi.mocked(writeSettings).mockResolvedValue({
      previous: baseSettings,
      next: {
        ...baseSettings,
        git: { ...baseSettings.git, autoPush: false }
      }
    })

    const handle = makeApp()
    const res = await post(handle, { patch: { persona: { verbosity: 'low' } }, source: 'user' })
    expect(res.status).toBe(200)

    const json = await res.json() as { gitStatus: string, gitSkipReason: string }
    expect(json.gitStatus).toBe('skipped')
    expect(json.gitSkipReason).toBe('auto_push_disabled')
  })

  it('returns skipped when git automation policy is disabled', async () => {
    vi.mocked(isGitAutomationEnabled).mockReturnValue(false)

    const handle = makeApp()
    const res = await post(handle, { patch: { persona: { verbosity: 'low' } }, source: 'user' })
    expect(res.status).toBe(200)

    const json = await res.json() as { gitStatus: string, gitSkipReason: string }
    expect(json.gitStatus).toBe('skipped')
    expect(json.gitSkipReason).toBe('automation_disabled')
  })

  it('returns pushed + not_attempted when branch push succeeds but github is not configured', async () => {
    const handle = makeApp()
    const res = await post(handle, { patch: { persona: { verbosity: 'low' } }, source: 'user' })
    expect(res.status).toBe(200)

    const json = await res.json() as { gitStatus: string, prStatus: string, branch?: string }
    expect(json.gitStatus).toBe('pushed')
    expect(json.prStatus).toBe('not_attempted')
    expect(typeof json.branch).toBe('string')
  })

  it('returns opened when PR upsert succeeds', async () => {
    vi.mocked(upsertConfigPullRequest).mockResolvedValue({
      status: 'opened',
      number: 42,
      url: 'https://github.com/acme/repo/pull/42',
      labels: ['auto-merge']
    })

    const handle = makeApp()
    const res = await post(handle, { patch: { persona: { verbosity: 'low' } }, source: 'user' })
    expect(res.status).toBe(200)

    const json = await res.json() as { prStatus: string, prNumber?: number, prUrl?: string }
    expect(json.prStatus).toBe('opened')
    expect(json.prNumber).toBe(42)
    expect(json.prUrl).toContain('/pull/42')
  })

  it('returns failed PR status when PR upsert fails', async () => {
    vi.mocked(upsertConfigPullRequest).mockResolvedValue({
      status: 'failed',
      error: 'GitHub API denied'
    })

    const handle = makeApp()
    const res = await post(handle, { patch: { persona: { verbosity: 'low' } }, source: 'user' })
    expect(res.status).toBe(200)

    const json = await res.json() as { prStatus: string, prError?: string }
    expect(json.prStatus).toBe('failed')
    expect(json.prError).toContain('GitHub API denied')
  })

  it('returns failed git status when commit automation throws', async () => {
    vi.mocked(commitToBranch).mockRejectedValue(new Error('push failed'))

    const handle = makeApp()
    const res = await post(handle, { patch: { persona: { verbosity: 'low' } }, source: 'user' })
    expect(res.status).toBe(200)

    const json = await res.json() as { gitStatus: string, gitError?: string }
    expect(json.gitStatus).toBe('failed')
    expect(json.gitError).toContain('push failed')
  })

  it('returns 409 when expectedRevision conflicts', async () => {
    vi.mocked(writeSettings).mockRejectedValue(new RevisionConflictError(2, 3))

    const handle = makeApp()
    const res = await post(handle, {
      patch: { persona: { verbosity: 'low' } },
      source: 'user',
      expectedRevision: 2
    })
    expect(res.status).toBe(409)
  })
})
