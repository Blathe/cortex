import { createError, defineEventHandler, getCookie, getHeader, setCookie } from 'h3'
import { consumeFirstRun, readToken } from '../utils/authToken'

export default defineEventHandler((event) => {
  // Only guard agent endpoints
  if (!event.path.startsWith('/api/agent/')) return

  // Auth management endpoints are always accessible (token generation, login)
  if (event.path.startsWith('/api/agent/auth/')) return

  // Minimal onboarding check is intentionally public — returns only a boolean
  if (event.path === '/api/agent/onboarding-status') return

  // No token configured — auth is not enabled, allow all requests through
  const stored = readToken()
  if (!stored) return

  // Accept Bearer token (for API/CLI clients) or HttpOnly cookie (for browser)
  const header = getHeader(event, 'authorization')
  const cookie = getCookie(event, 'cortex_auth')

  if (header === `Bearer ${stored}` || cookie === stored) return

  // First browser request after a fresh install — silently establish a session
  // by setting the HttpOnly cookie. Only applies when CORTEX_SETUP_SECRET is not
  // configured; shared deployments that set the secret require explicit auth.
  if (!process.env.CORTEX_SETUP_SECRET && consumeFirstRun()) {
    setCookie(event, 'cortex_auth', stored, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365
    })
    return
  }

  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
})
