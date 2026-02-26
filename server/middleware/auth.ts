import { createError, defineEventHandler } from 'h3'
import { isPinConfigured } from '../utils/pinAuth'
import { setSessionCookie, validateSession } from '../utils/authSession'

export default defineEventHandler((event) => {
  // Only guard agent endpoints
  if (!event.path.startsWith('/api/agent/')) return

  // Auth management and status endpoints are always accessible
  if (event.path.startsWith('/api/agent/auth/')) return

  // Minimal onboarding check is intentionally public — returns only a boolean
  if (event.path === '/api/agent/onboarding-status') return

  const session = validateSession(event)

  if (!session.valid) {
    // Distinguish between "not set up yet" and "not logged in"
    if (!isPinConfigured()) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Authentication is not initialized. Complete onboarding first.'
      })
    }
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Rolling session expiration: refresh the cookie on each authenticated request
  setSessionCookie(event, session.data?.sudoAt)
})
