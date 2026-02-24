import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockMkdir = vi.fn()
const mockRename = vi.fn()

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  rename: mockRename
}))

const importProviderConfig = async () => {
  vi.resetModules()
  return import('../../server/utils/providerConfig')
}

describe('provider config migration (v1 -> v2)', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
    mockWriteFile.mockReset()
    mockMkdir.mockReset()
    mockRename.mockReset()
    mockWriteFile.mockResolvedValue(undefined)
    mockMkdir.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)
  })

  it('migrates a legacy OpenAI provider and preserves API key', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      providers: [{
        id: 'legacy-openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-legacy',
        models: ['gpt-4o']
      }],
      activeId: 'legacy-openai'
    }))

    const { readProviders } = await importProviderConfig()
    const result = await readProviders()

    expect(result.version).toBe(2)
    expect(result.credentials.openai.apiKey).toBe('sk-legacy')
    expect(result.active).toEqual({ providerId: 'openai', modelId: 'gpt-4o' })
    expect(mockWriteFile).toHaveBeenCalled()
    expect(mockRename).toHaveBeenCalled()
  })

  it('falls back to default model when legacy model is invalid', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      providers: [{
        id: 'legacy-openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-legacy',
        models: ['not-a-real-model']
      }],
      activeId: 'legacy-openai'
    }))

    const { readProviders } = await importProviderConfig()
    const result = await readProviders()

    expect(result.active).toEqual({ providerId: 'openai', modelId: 'gpt-4o-mini' })
    expect(result.migrationWarnings.some(w => w.reason.includes('not supported'))).toBe(true)
  })

  it('keeps unknown providers as migration warnings', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      providers: [{
        id: 'legacy-unknown',
        name: 'My Custom Host',
        baseUrl: 'https://example.com/v1',
        apiKey: 'sk-custom',
        models: ['whatever']
      }],
      activeId: 'legacy-unknown'
    }))

    const { readProviders } = await importProviderConfig()
    const result = await readProviders()

    expect(result.active).toBeNull()
    expect(result.migrationWarnings).toHaveLength(2)
    expect(result.migrationWarnings[0]?.legacyId).toBe('legacy-unknown')
  })
})
