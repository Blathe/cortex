import { createHmac, randomBytes } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { writeEnvVars } from './envFile'
import { getClientIp } from './security'

// Argon2id parameters per OWASP recommendation (minimum: m=19456, t=2, p=1)
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32
}

// Recovery code character set — no ambiguous chars (I, O, 0, 1)
export const RECOVERY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// ─── PIN pepper ──────────────────────────────────────────────────────────────

export const getPinPepper = (): string => {
  return process.env.PIN_PEPPER?.trim() ?? ''
}

/** Auto-generates and persists a pepper if not already set. Returns the pepper. */
export const ensurePinPepper = (): string => {
  const existing = getPinPepper()
  if (existing) return existing
  const pepper = randomBytes(32).toString('hex')
  writeEnvVars({ PIN_PEPPER: pepper })
  return pepper
}

// ─── Hashing ─────────────────────────────────────────────────────────────────

/** Hash a PIN with Argon2id. The pepper is HMAC'd into the input so that
 *  stealing the hash file alone is insufficient for offline cracking. */
export const hashPin = async (pin: string): Promise<string> => {
  const pepper = getPinPepper()
  if (!pepper) throw new Error('PIN_PEPPER is not set.')
  const peppered = createHmac('sha256', pepper).update(pin).digest('hex')
  return hash(peppered, ARGON2_OPTIONS)
}

export const verifyPin = async (pin: string, storedHash: string): Promise<boolean> => {
  try {
    const pepper = getPinPepper()
    if (!pepper) return false
    const peppered = createHmac('sha256', pepper).update(pin).digest('hex')
    return await verify(storedHash, peppered)
  } catch {
    return false
  }
}

/** Recovery codes have enough entropy that no pepper is needed. */
export const hashRecoveryCode = async (code: string): Promise<string> => {
  return hash(code.toUpperCase(), ARGON2_OPTIONS)
}

export const verifyRecoveryCode = async (code: string, storedHash: string): Promise<boolean> => {
  try {
    return await verify(storedHash, code.toUpperCase())
  } catch {
    return false
  }
}

// ─── Generation ──────────────────────────────────────────────────────────────

/** Generate a 16-character recovery code using an unambiguous character set. */
export const generateRecoveryCode = (): string => {
  const bytes = randomBytes(16)
  return Array.from(bytes).map(b => RECOVERY_CHARS[b % RECOVERY_CHARS.length]!).join('')
}

// ─── Validation ──────────────────────────────────────────────────────────────

export const isValidPin = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{6}$/.test(value)

export const isValidRecoveryCodeInput = (value: unknown): value is string =>
  typeof value === 'string' && new RegExp(`^[${RECOVERY_CHARS}]{16}$`).test(value.toUpperCase())

// ─── State reads ─────────────────────────────────────────────────────────────

export const isPinConfigured = (): boolean => Boolean(process.env.PIN_HASH?.trim())

export const getStoredPinHash = (): string | null =>
  process.env.PIN_HASH?.trim() || null

export const getStoredRecoveryHash = (): string | null =>
  process.env.PIN_RECOVERY_HASH?.trim() || null

export const isRecoveryCodeUsed = (): boolean =>
  process.env.PIN_RECOVERY_USED === 'true'

// ─── Rate limiting ────────────────────────────────────────────────────────────

interface PinAttemptState {
  failures: number
  lockedUntil: number | null
}

const pinAttempts = new Map<string, PinAttemptState>()

/** Lockout schedule: 15 min after 5 failures, doubling each additional failure,
 *  capped at 24 hours. */
const getLockoutMs = (failures: number): number => {
  const base = 15 * 60 * 1000
  const extra = Math.max(0, failures - 5)
  return Math.min(base * Math.pow(2, extra), 24 * 60 * 60 * 1000)
}

export const enforcePinRateLimit = (event: H3Event): void => {
  const ip = getClientIp(event)
  const now = Date.now()
  const state = pinAttempts.get(ip)

  if (state?.lockedUntil && state.lockedUntil > now) {
    const secondsLeft = Math.ceil((state.lockedUntil - now) / 1000)
    const minutesLeft = Math.ceil(secondsLeft / 60)
    const display = secondsLeft < 120 ? `${secondsLeft} seconds` : `${minutesLeft} minutes`
    throw createError({
      statusCode: 429,
      statusMessage: `Too many PIN attempts. Try again in ${display}.`
    })
  }
}

export const recordPinFailure = (event: H3Event): void => {
  const ip = getClientIp(event)
  const state = pinAttempts.get(ip) ?? { failures: 0, lockedUntil: null }
  state.failures += 1
  if (state.failures >= 5) {
    state.lockedUntil = Date.now() + getLockoutMs(state.failures)
  }
  pinAttempts.set(ip, state)
}

export const clearPinAttempts = (event: H3Event): void => {
  const ip = getClientIp(event)
  pinAttempts.delete(ip)
}
