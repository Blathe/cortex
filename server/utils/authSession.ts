import { createHmac } from 'node:crypto'
import { getCookie, setCookie } from 'h3'
import type { H3Event } from 'h3'
import { safeStringEqual } from './security'

const SESSION_COOKIE_NAME = 'cortex_auth'
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8
const MIN_SESSION_TTL_SECONDS = 60
const MAX_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

interface SessionPayload {
  v: 1
  iat: number
  exp: number
}

const encodeBase64Url = (value: string): string => {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

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

const getSessionTtlSeconds = (): number => {
  const raw = Number(process.env.CORTEX_SESSION_TTL_SECONDS)
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_SESSION_TTL_SECONDS
  }
  return Math.min(Math.max(Math.floor(raw), MIN_SESSION_TTL_SECONDS), MAX_SESSION_TTL_SECONDS)
}

const getSessionSigningSecret = (authToken: string): string => {
  const base = process.env.CORTEX_SESSION_SECRET?.trim() || 'cortex-session'
  return `${base}:${authToken}`
}

const signPayload = (payloadB64: string, authToken: string): string => {
  return createHmac('sha256', getSessionSigningSecret(authToken))
    .update(payloadB64)
    .digest('hex')
}

export interface SessionValidationResult {
  valid: boolean
  reason?: 'missing' | 'malformed' | 'invalid_signature' | 'expired' | 'invalid_payload'
}

export const createSessionCookieValue = (
  authToken: string,
  nowMs = Date.now(),
  ttlSeconds = getSessionTtlSeconds()
): string => {
  const issuedAtSeconds = Math.floor(nowMs / 1000)
  const payload: SessionPayload = {
    v: 1,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + ttlSeconds
  }

  const payloadB64 = encodeBase64Url(JSON.stringify(payload))
  const signature = signPayload(payloadB64, authToken)
  return `${payloadB64}.${signature}`
}

export const validateSessionCookieValue = (
  sessionCookieValue: string | undefined | null,
  authToken: string,
  nowMs = Date.now()
): SessionValidationResult => {
  if (!sessionCookieValue) {
    return { valid: false, reason: 'missing' }
  }

  const parts = sessionCookieValue.split('.')
  if (parts.length !== 2) {
    return { valid: false, reason: 'malformed' }
  }

  const payloadB64 = parts[0] || ''
  const signature = parts[1] || ''
  if (!payloadB64 || !signature) {
    return { valid: false, reason: 'malformed' }
  }

  const expectedSignature = signPayload(payloadB64, authToken)
  if (!safeStringEqual(signature, expectedSignature)) {
    return { valid: false, reason: 'invalid_signature' }
  }

  const decoded = decodeBase64Url(payloadB64)
  if (!decoded) {
    return { valid: false, reason: 'invalid_payload' }
  }

  let payload: SessionPayload
  try {
    payload = JSON.parse(decoded) as SessionPayload
  } catch {
    return { valid: false, reason: 'invalid_payload' }
  }

  if (payload.v !== 1 || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
    return { valid: false, reason: 'invalid_payload' }
  }

  const nowSeconds = Math.floor(nowMs / 1000)
  if (payload.exp <= nowSeconds) {
    return { valid: false, reason: 'expired' }
  }

  return { valid: true }
}

export const setSessionCookie = (event: H3Event, authToken: string): string => {
  const ttlSeconds = getSessionTtlSeconds()
  const value = createSessionCookieValue(authToken, Date.now(), ttlSeconds)
  setCookie(event, SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ttlSeconds
  })
  return value
}

export const hasValidSessionCookie = (event: H3Event, authToken: string): boolean => {
  const cookie = getCookie(event, SESSION_COOKIE_NAME)
  return validateSessionCookieValue(cookie, authToken).valid
}
