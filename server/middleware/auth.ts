import { createError, defineEventHandler, getHeader } from 'h3'
import { readToken } from '../utils/authToken'

export default defineEventHandler((event) => {
  // Only guard agent endpoints
  if (!event.path.startsWith('/api/agent/')) return

  // Auth management endpoints are always accessible (token retrieval + generation)
  if (event.path.startsWith('/api/agent/auth/')) return

  const stored = readToken()
  const header = getHeader(event, 'authorization')
  if (!stored || !header || header !== `Bearer ${stored}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
