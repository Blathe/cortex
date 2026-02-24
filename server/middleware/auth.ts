import { createError, defineEventHandler, getCookie, getHeader } from 'h3'
import { readToken } from '../utils/authToken'

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

  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
})
