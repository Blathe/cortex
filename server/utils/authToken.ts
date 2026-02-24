import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const DEFAULT_AUTH_PATH = resolve(process.cwd(), 'agent/config/auth.json')
const AUTH_FILE_VERSION = 2
const TOKEN_ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const AUTH_CIPHER_IV_BYTES = 12

interface PlainAuthConfig {
  token: string
}

interface EncryptedAuthConfig {
  version: 2
  algorithm: 'aes-256-gcm'
  iv: string
  tag: string
  ciphertext: string
}

const getAuthPath = (): string => {
  const override = process.env.CORTEX_AUTH_PATH?.trim()
  if (!override) {
    return DEFAULT_AUTH_PATH
  }
  return resolve(override)
}

const writeAuthFileAtomically = (content: string): void => {
  const authPath = getAuthPath()
  mkdirSync(dirname(authPath), { recursive: true })
  const tempPath = `${authPath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tempPath, content, 'utf-8')
  renameSync(tempPath, authPath)
}

const getEncryptionSecret = (): string | null => {
  const explicit = process.env.CORTEX_TOKEN_ENCRYPTION_KEY?.trim()
  if (explicit) {
    return explicit
  }

  const setupSecret = process.env.CORTEX_SETUP_SECRET?.trim()
  if (setupSecret) {
    return setupSecret
  }

  return null
}

const getEncryptionKey = (): Buffer | null => {
  const secret = getEncryptionSecret()
  if (!secret) {
    return null
  }

  return createHash('sha256')
    .update(`cortex-auth-token:${secret}`)
    .digest()
}

const isEncryptedAuthConfig = (value: unknown): value is EncryptedAuthConfig => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<EncryptedAuthConfig>
  return candidate.version === AUTH_FILE_VERSION
    && candidate.algorithm === TOKEN_ENCRYPTION_ALGORITHM
    && typeof candidate.iv === 'string'
    && typeof candidate.tag === 'string'
    && typeof candidate.ciphertext === 'string'
}

const isPlainAuthConfig = (value: unknown): value is PlainAuthConfig => {
  if (!value || typeof value !== 'object') {
    return false
  }
  return typeof (value as Partial<PlainAuthConfig>).token === 'string'
}

const encryptToken = (token: string, key: Buffer): EncryptedAuthConfig => {
  const iv = randomBytes(AUTH_CIPHER_IV_BYTES)
  const cipher = createCipheriv(TOKEN_ENCRYPTION_ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()

  return {
    version: AUTH_FILE_VERSION,
    algorithm: TOKEN_ENCRYPTION_ALGORITHM,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  }
}

const decryptToken = (config: EncryptedAuthConfig, key: Buffer): string | null => {
  try {
    const iv = Buffer.from(config.iv, 'base64')
    const tag = Buffer.from(config.tag, 'base64')
    const ciphertext = Buffer.from(config.ciphertext, 'base64')

    if (!iv.length || !tag.length || !ciphertext.length) {
      return null
    }

    const decipher = createDecipheriv(TOKEN_ENCRYPTION_ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const token = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString('utf8')

    return token || null
  } catch {
    return null
  }
}

const writePlainToken = (token: string): void => {
  writeAuthFileAtomically(JSON.stringify({ token }, null, 2) + '\n')
}

const writeEncryptedToken = (token: string, key: Buffer): void => {
  const payload = encryptToken(token, key)
  writeAuthFileAtomically(JSON.stringify(payload, null, 2) + '\n')
}

export const readToken = (): string | null => {
  try {
    const authPath = getAuthPath()
    if (!existsSync(authPath)) return null
    const raw = readFileSync(authPath, 'utf-8')
    const config = JSON.parse(raw) as unknown

    if (isEncryptedAuthConfig(config)) {
      const key = getEncryptionKey()
      if (!key) {
        return null
      }
      return decryptToken(config, key)
    }

    if (!isPlainAuthConfig(config)) {
      return null
    }

    const token = config.token || null
    if (!token) {
      return null
    }

    const key = getEncryptionKey()
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        return null
      }
      return token
    }

    // Safe auto-migration from plaintext to encrypted storage.
    try {
      writeEncryptedToken(token, key)
    } catch {
      // Keep serving the token even if migration write fails.
    }

    return token
  } catch {
    return null
  }
}

export const writeToken = (token: string): void => {
  const key = getEncryptionKey()
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CORTEX_TOKEN_ENCRYPTION_KEY is required in production.')
    }
    writePlainToken(token)
    return
  }

  writeEncryptedToken(token, key)
}

export const generateToken = (): string => randomBytes(32).toString('hex')
