import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { upsertConfigPullRequest } from '../../server/utils/agentConfig'

vi.mock('node:fs/promises', () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  rename: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}))

const makeResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) => {
  return {
    ok,
    status,
    json: async () => payload
  } as Response
}

describe('upsertConfigPullRequest', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    delete process.env.GH_TOKEN
    delete process.env.GH_REPO
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns not_attempted when GH_TOKEN is missing', async () => {
    process.env.GH_REPO = 'acme/repo'
    const result = await upsertConfigPullRequest({
      branch: 'agent-config/123',
      riskLevel: 'low',
      reason: 'test',
      autoMerge: true
    })

    expect(result.status).toBe('not_attempted')
    expect(result.skipReason).toBe('github_not_configured')
  })

  it('returns not_attempted when GH_REPO is invalid', async () => {
    process.env.GH_TOKEN = 'token'
    process.env.GH_REPO = 'bad-format'

    const result = await upsertConfigPullRequest({
      branch: 'agent-config/123',
      riskLevel: 'low',
      reason: 'test',
      autoMerge: true
    })

    expect(result.status).toBe('not_attempted')
    expect(result.skipReason).toBe('repo_invalid')
  })

  it('opens PR and applies auto-merge label for low-risk autoMerge updates', async () => {
    process.env.GH_TOKEN = 'token'
    process.env.GH_REPO = 'acme/repo'

    fetchMock
      .mockResolvedValueOnce(makeResponse(true, { number: 17, html_url: 'https://github.com/acme/repo/pull/17' }))
      .mockResolvedValueOnce(makeResponse(true, { labels: [{ name: 'auto-merge' }] }))

    const result = await upsertConfigPullRequest({
      branch: 'agent-config/123',
      riskLevel: 'low',
      reason: 'safe tweak',
      autoMerge: true
    })

    expect(result.status).toBe('opened')
    expect(result.number).toBe(17)
    expect(result.labels).toEqual(['auto-merge'])
  })

  it('applies needs-review label for high-risk updates', async () => {
    process.env.GH_TOKEN = 'token'
    process.env.GH_REPO = 'acme/repo'

    fetchMock
      .mockResolvedValueOnce(makeResponse(true, { number: 22, html_url: 'https://github.com/acme/repo/pull/22' }))
      .mockResolvedValueOnce(makeResponse(true, { labels: [{ name: 'needs-review' }] }))

    const result = await upsertConfigPullRequest({
      branch: 'agent-config/456',
      riskLevel: 'high',
      reason: 'risky tweak',
      autoMerge: true
    })

    expect(result.status).toBe('opened')
    expect(result.labels).toEqual(['needs-review'])
  })

  it('reuses existing PR when create returns already exists', async () => {
    process.env.GH_TOKEN = 'token'
    process.env.GH_REPO = 'acme/repo'

    fetchMock
      .mockResolvedValueOnce(makeResponse(false, { message: 'A pull request already exists for acme:agent-config/123.' }, 422))
      .mockResolvedValueOnce(makeResponse(true, [{ number: 31, html_url: 'https://github.com/acme/repo/pull/31' }]))
      .mockResolvedValueOnce(makeResponse(true, { labels: [{ name: 'needs-review' }] }))

    const result = await upsertConfigPullRequest({
      branch: 'agent-config/123',
      riskLevel: 'low',
      reason: 'safe tweak',
      autoMerge: false
    })

    expect(result.status).toBe('opened')
    expect(result.number).toBe(31)
    expect(result.labels).toEqual(['needs-review'])
  })

  it('returns failed when github API operations fail', async () => {
    process.env.GH_TOKEN = 'token'
    process.env.GH_REPO = 'acme/repo'

    fetchMock.mockRejectedValue(new Error('network down'))

    const result = await upsertConfigPullRequest({
      branch: 'agent-config/123',
      riskLevel: 'low',
      reason: 'safe tweak',
      autoMerge: true
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('network down')
  })
})
