import { describe, expect, it } from 'vitest'
import { parseEnvFile, serializeEnvFile, serializeValue } from '../../server/api/agent/env.post'

describe('parseEnvFile', () => {
  it('parses simple key=value pairs', () => {
    const result = parseEnvFile('FOO=bar\nBAZ=qux')
    expect(result.get('FOO')).toBe('bar')
    expect(result.get('BAZ')).toBe('qux')
  })

  it('skips blank lines and comments', () => {
    const result = parseEnvFile('# comment\n\nFOO=bar')
    expect(result.size).toBe(1)
    expect(result.get('FOO')).toBe('bar')
  })

  it('strips surrounding double-quotes from values', () => {
    const result = parseEnvFile('FOO="hello world"')
    expect(result.get('FOO')).toBe('hello world')
  })

  it('un-escapes sequences inside quoted values', () => {
    const result = parseEnvFile('FOO="say \\"hi\\""')
    expect(result.get('FOO')).toBe('say "hi"')
  })

  it('un-escapes backslashes inside quoted values', () => {
    const result = parseEnvFile('FOO="C:\\\\path"')
    expect(result.get('FOO')).toBe('C:\\path')
  })
})

describe('serializeValue', () => {
  it('returns plain alphanumeric values unquoted', () => {
    expect(serializeValue('simple')).toBe('simple')
    expect(serializeValue('abc123')).toBe('abc123')
  })

  it('returns owner/repo values unquoted', () => {
    expect(serializeValue('owner/repo')).toBe('owner/repo')
  })

  it('returns GitHub PAT values unquoted', () => {
    expect(serializeValue('ghp_abc123XYZ')).toBe('ghp_abc123XYZ')
  })

  it('quotes values containing spaces', () => {
    expect(serializeValue('hello world')).toBe('"hello world"')
  })

  it('quotes empty string', () => {
    expect(serializeValue('')).toBe('""')
  })

  it('escapes double-quotes inside quoted values', () => {
    expect(serializeValue('say "hi"')).toBe('"say \\"hi\\""')
  })

  it('escapes backslashes inside quoted values', () => {
    expect(serializeValue('C:\\path')).toBe('"C:\\\\path"')
  })

  it('quotes values containing # (would be treated as comment)', () => {
    expect(serializeValue('val#with#hash')).toBe('"val#with#hash"')
  })
})

describe('serializeEnvFile round-trip', () => {
  it('re-parses to the same values after serialization', () => {
    const original = new Map([
      ['GH_REPO', 'owner/my-repo'],
      ['GH_TOKEN', 'ghp_abc123XYZ'],
      ['SPACED', 'hello world'],
      ['QUOTED', 'say "hi"'],
      ['BACKSLASH', 'C:\\path']
    ])
    const serialized = serializeEnvFile(original)
    const reparsed = parseEnvFile(serialized)
    for (const [key, value] of original) {
      expect(reparsed.get(key)).toBe(value)
    }
  })

  it('produces one key=value line per entry', () => {
    const map = new Map([['FOO', 'bar'], ['BAZ', 'qux']])
    const lines = serializeEnvFile(map).trim().split('\n')
    expect(lines).toHaveLength(2)
  })
})
