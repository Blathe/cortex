import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockRename = vi.fn()
const mockMkdir = vi.fn()

vi.mock('node:fs/promises', () => ({
  copyFile: vi.fn(),
  mkdir: mockMkdir,
  readFile: mockReadFile,
  rename: mockRename,
  writeFile: mockWriteFile
}))

vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}))

const importAgentConfig = async () => {
  vi.resetModules()
  return import('../../server/utils/agentConfig')
}

describe('agentConfig write path', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
    mockWriteFile.mockReset()
    mockRename.mockReset()
    mockMkdir.mockReset()
    mockWriteFile.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)
    mockMkdir.mockResolvedValue(undefined)
  })

  it('returns defaults when settings file is missing', async () => {
    mockReadFile.mockRejectedValue(new Error('missing'))
    const { readSettings } = await importAgentConfig()
    const settings = await readSettings()
    expect(settings.meta.revision).toBe(0)
  })

  it('increments revision and writes atomically on successful update', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      version: 1,
      persona: { name: 'Cortex', tone: 'professional', verbosity: 'medium' },
      reasoning: { temperature: 0.7, maxTokens: 2048 },
      git: { autoPush: true, autoMerge: true },
      meta: { onboarded: true, updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: 'user', revision: 3 }
    }))

    const { writeSettings } = await importAgentConfig()
    const result = await writeSettings({ persona: { verbosity: 'low' } }, { source: 'user', expectedRevision: 3 })

    expect(result.next.meta.revision).toBe(4)
    expect(mockWriteFile).toHaveBeenCalledOnce()
    const writePath = mockWriteFile.mock.calls[0]?.[0] as string
    expect(writePath.endsWith('agent/config/settings.json.tmp')).toBe(true)
    expect(mockRename).toHaveBeenCalledOnce()
  })

  it('throws a revision conflict when expected revision is stale', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      version: 1,
      persona: { name: 'Cortex', tone: 'professional', verbosity: 'medium' },
      reasoning: { temperature: 0.7, maxTokens: 2048 },
      git: { autoPush: true, autoMerge: true },
      meta: { onboarded: true, updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: 'user', revision: 5 }
    }))

    const { writeSettings, RevisionConflictError } = await importAgentConfig()
    await expect(writeSettings(
      { persona: { verbosity: 'low' } },
      { source: 'user', expectedRevision: 4 }
    )).rejects.toBeInstanceOf(RevisionConflictError)

    expect(mockWriteFile).not.toHaveBeenCalled()
    expect(mockRename).not.toHaveBeenCalled()
  })
})
