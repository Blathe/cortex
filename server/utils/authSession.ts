import { createHmac } from 'node:crypto'
import { createError, getCookie, setCookie } from 'h3'
import type { H3Event } from 'h3'
import { safeStringEqual } from './security'
import { readPinData } from './pinStore'

const SESSION_COOKIE_NAME = 'cortex_auth'
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8
const MIN_SESSION_TTL_SECONDS = 60
const MAX_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const SUDO_WINDOW_SECONDS = 2 * 60 * 60 // 2 hours

interface SessionPayload {
  v: 2
  iat: number
  exp: number
  sudoAt?: number
}

export interface SessionData {
  iat: number
  exp: number
  sudoAt?: number
}

const encodeBase64Url = (value: string): string =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const decodeBase64Url = (value: string): string | null => {
  try {
    const normalized = value
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=')
    return Buffer.from(normalized, 'base64').toString('utf8')
  } catch {
    return null
  }
}

export const getSessionTtlSeconds = (): number => {
  const stored = readPinData().sessionTtlSeconds
  if (stored && Number.isFinite(stored) && stored > 0) {
    return Math.min(Math.max(Math.floor(stored), MIN_SESSION_TTL_SECONDS), MAX_SESSION_TTL_SECONDS)
  }
  const raw = Number(process.env.CORTEX_SESSION_TTL_SECONDS)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SESSION_TTL_SECONDS
  return Math.min(Math.max(Math.floor(raw), MIN_SESSION_TTL_SECONDS), MAX_SESSION_TTL_SECONDS)
}

/**
 * The session signing secret is the PIN pepper stored in data/pin.json.
 * When the PIN is reset via recovery code, a new pepper is generated, which
 * automatically invalidates all existing sessions.
 */
const getSessionSigningSecret = (): string => {
  const pepper = readPinData().pepper?.trim()
  const explicit = process.env.CORTEX_SESSION_SECRET?.trim()
  return pepper || explicit || 'cortex-session-dev'
}

const signPayload = (payloadB64: string): string =>
  createHmac('sha256', getSessionSigningSecret()).update(payloadB64).digest('hex')

export interface SessionValidationResult {
  valid: boolean
  data?: SessionData
  reason?: 'missing' | 'malformed' | 'invalid_signature' | 'expired' | 'invalid_payload'
}

export const createSessionCookieValue = (
  nowMs = Date.now(),
  ttlSeconds = getSessionTtlSeconds(),
  sudoAt?: number
): string => {
  const issuedAtSeconds = Math.floor(nowMs / 1000)
  const payload: SessionPayload = {
    v: 2,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + ttlSeconds,
    ...(sudoAt !== undefined ? { sudoAt } : {})
  }
  const payloadB64 = encodeBase64Url(JSON.stringify(payload))
  const signature = signPayload(payloadB64)
  return `${payloadB64}.${signature}`
}

export const validateSessionCookieValue = (
  sessionCookieValue: string | undefined | null,
  nowMs = Date.now()
): SessionValidationResult => {
  if (!sessionCookieValue) return { valid: false, reason: 'missing' }

  const parts = sessionCookieValue.split('.')
  if (parts.length !== 2) return { valid: false, reason: 'malformed' }

  const payloadB64 = parts[0] || ''
  const signature = parts[1] || ''
  if (!payloadB64 || !signature) return { valid: false, reason: 'malformed' }

  const expectedSignature = signPayload(payloadB64)
  if (!safeStringEqual(signature, expectedSignature)) {
    return { valid: false, reason: 'invalid_signature' }
  }

  const decoded = decodeBase64Url(payloadB64)
  if (!decoded) return { valid: false, reason: 'invalid_payload' }

  let payload: SessionPayload
  try {
    payload = JSON.parse(decoded) as SessionPayload
  } catch {
    return { valid: false, reason: 'invalid_payload' }
  }

  if (payload.v !== 2 || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
    return { valid: false, reason: 'invalid_payload' }
  }

  const nowSeconds = Math.floor(nowMs / 1000)
  if (payload.exp <= nowSeconds) return { valid: false, reason: 'expired' }

  return {
    valid: true,
    data: {
      iat: payload.iat,
      exp: payload.exp,
      sudoAt: payload.sudoAt
    }
  }
}

export const setSessionCookie = (event: H3Event, sudoAt?: number): string => {
  const ttlSeconds = getSessionTtlSeconds()
  const value = createSessionCookieValue(Date.now(), ttlSeconds, sudoAt)
  setCookie(event, SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ttlSeconds
  })
  return value
}

/** Read and validate the session cookie from the current request. */
export const validateSession = (event: H3Event): SessionValidationResult => {
  const cookie = getCookie(event, SESSION_COOKIE_NAME)
  return validateSessionCookieValue(cookie)
}

/**
 * Require that the session has a recent sudo (PIN re-auth) timestamp.
 * Throws 403 with requiresSudo=true if missing or expired.
 */
export const requireSudoMode = (event: H3Event): SessionData => {
  const result = validateSession(event)
  if (!result.valid || !result.data) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  const { sudoAt } = result.data
  if (!sudoAt || (nowSeconds - sudoAt) > SUDO_WINDOW_SECONDS) {
    throw createError({
      statusCode: 403,
      statusMessage: 'PIN confirmation required.',
      data: { requiresSudo: true }
    })
  }
  return result.data
}

export const hasValidSessionCookie = (event: H3Event): boolean =>
  validateSession(event).valid
