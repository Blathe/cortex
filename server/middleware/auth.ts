import { createError, defineEventHandler, getCookie, getHeader } from 'h3'
import { readToken } from '../utils/authToken'
import { setSessionCookie, validateSessionCookieValue } from '../utils/authSession'

export default defineEventHandler((event) => {
  // Only guard agent endpoints
  if (!event.path.startsWith('/api/agent/')) return

  // Auth management endpoints are always accessible (token generation, login)
  if (event.path.startsWith('/api/agent/auth/')) return

  // Minimal onboarding check is intentionally public — returns only a boolean
  if (event.path === '/api/agent/onboarding-status') return

  // Strict secure default: if token is missing/corrupt, deny protected access.
  // Bootstrap/auth flows must go through /api/agent/auth/* endpoints above.
  const stored = readToken()
  if (!stored) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Authentication is not initialized. Generate a token via /api/agent/auth/generate.'
    })
  }

  // Session-first auth:
  // - Bearer token is still accepted for CLI/API clients
  // - Browser auth uses a signed session cookie with rolling expiration
  const header = getHeader(event, 'authorization')
  const cookie = getCookie(event, 'cortex_auth')

  if (header === `Bearer ${stored}`) return

  const session = validateSessionCookieValue(cookie, stored)
  if (session.valid) {
    // Rolling session expiration for active browser sessions.
    setSessionCookie(event, stored)
    return
  }

  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
})
