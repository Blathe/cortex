import { createError, defineEventHandler, readBody } from 'h3'
import { readToken } from '../../../utils/authToken'
import { setSessionCookie } from '../../../utils/authSession'
import { enforceRateLimit, safeStringEqual } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, { key: 'agent-auth-login', maxAttempts: 30, windowMs: 60_000 })

  const body = await readBody<{ token?: string }>(event)

  if (!body?.token || typeof body.token !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'token is required.' })
  }

  const stored = readToken()
  if (!stored) {
    throw createError({ statusCode: 400, statusMessage: 'No token configured on this server.' })
  }

  if (!safeStringEqual(body.token, stored)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid token.' })
  }

  setSessionCookie(event, stored)

  return { ok: true, sessionEstablished: true }
})
