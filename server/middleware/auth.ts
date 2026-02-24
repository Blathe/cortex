import { createError, defineEventHandler, getHeader } from 'h3'
import { readToken } from '../utils/authToken'

export default defineEventHandler((event) => {
  // Only guard agent endpoints
  if (!event.path.startsWith('/api/agent/')) return

  // Auth management endpoints are always accessible (token generation)
  if (event.path.startsWith('/api/agent/auth/')) return

  // No token configured — auth is not enabled, allow all requests through
  const stored = readToken()
  if (!stored) return

  const header = getHeader(event, 'authorization')
  if (!header || header !== `Bearer ${stored}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
