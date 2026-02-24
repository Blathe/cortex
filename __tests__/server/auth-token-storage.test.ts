import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { readToken, writeToken } from '../../server/utils/authToken'

const ENV_KEYS = [
  'CORTEX_AUTH_PATH',
  'CORTEX_TOKEN_ENCRYPTION_KEY',
  'CORTEX_SETUP_SECRET',
  'NODE_ENV'
] as const

const snapshotEnv = () => {
  const snapshot = new Map<string, string | undefined>()
  for (const key of ENV_KEYS) {
    snapshot.set(key, process.env[key])
  }
  return snapshot
}

const restoreEnv = (snapshot: Map<string, string | undefined>) => {
  for (const key of ENV_KEYS) {
    const value = snapshot.get(key)
    process.env[key] = value
  }
}

describe('authToken storage', () => {
  let envSnapshot: Map<string, string | undefined>
  let tempRoot: string
  let authPath: string

  beforeEach(() => {
    envSnapshot = snapshotEnv()
    tempRoot = mkdtempSync(join(tmpdir(), 'cortex-auth-token-'))
    authPath = join(tempRoot, 'agent/config/auth.json')
    process.env.CORTEX_AUTH_PATH = authPath
    delete process.env.CORTEX_TOKEN_ENCRYPTION_KEY
    delete process.env.CORTEX_SETUP_SECRET
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    restoreEnv(envSnapshot)
    rmSync(tempRoot, { recursive: true, force: true })
  })

  it('writes encrypted payload when CORTEX_TOKEN_ENCRYPTION_KEY is set', () => {
    process.env.CORTEX_TOKEN_ENCRYPTION_KEY = 'strong-test-key'

    writeToken('sensitive-token')

    const raw = JSON.parse(readFileSync(authPath, 'utf-8')) as Record<string, unknown>
    expect(raw.version).toBe(2)
    expect(raw.algorithm).toBe('aes-256-gcm')
    expect(raw.token).toBeUndefined()
    expect(typeof raw.iv).toBe('string')
    expect(typeof raw.tag).toBe('string')
    expect(typeof raw.ciphertext).toBe('string')
    expect(readToken()).toBe('sensitive-token')
  })

  it('auto-migrates legacy plaintext token to encrypted format when key is available', () => {
    mkdirSync(dirname(authPath), { recursive: true })
    writeFileSync(authPath, JSON.stringify({ token: 'legacy-token' }, null, 2) + '\n', 'utf-8')
    process.env.CORTEX_TOKEN_ENCRYPTION_KEY = 'migration-key'

    const token = readToken()

    expect(token).toBe('legacy-token')
    const migrated = JSON.parse(readFileSync(authPath, 'utf-8')) as Record<string, unknown>
    expect(migrated.version).toBe(2)
    expect(migrated.token).toBeUndefined()
  })

  it('returns null for encrypted token when key material is unavailable', () => {
    process.env.CORTEX_TOKEN_ENCRYPTION_KEY = 'decrypt-key'
    writeToken('encrypted-token')
    delete process.env.CORTEX_TOKEN_ENCRYPTION_KEY

    expect(readToken()).toBeNull()
  })

  it('uses setup secret as fallback encryption material', () => {
    process.env.CORTEX_SETUP_SECRET = 'setup-secret-key'

    writeToken('setup-encrypted-token')

    const raw = JSON.parse(readFileSync(authPath, 'utf-8')) as Record<string, unknown>
    expect(raw.version).toBe(2)
    expect(raw.token).toBeUndefined()
    expect(readToken()).toBe('setup-encrypted-token')
  })

  it('keeps plaintext behavior in local development when no key is configured', () => {
    writeToken('dev-token')

    const raw = JSON.parse(readFileSync(authPath, 'utf-8')) as Record<string, unknown>
    expect(raw.token).toBe('dev-token')
    expect(readToken()).toBe('dev-token')
  })

  it('requires encryption key in production mode', () => {
    process.env.NODE_ENV = 'production'

    expect(() => writeToken('prod-token')).toThrowError(
      'CORTEX_TOKEN_ENCRYPTION_KEY is required in production.'
    )

    mkdirSync(dirname(authPath), { recursive: true })
    writeFileSync(authPath, JSON.stringify({ token: 'legacy-prod-token' }, null, 2) + '\n', 'utf-8')
    expect(readToken()).toBeNull()
  })
})
