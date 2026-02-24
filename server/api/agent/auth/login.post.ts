import { createError, defineEventHandler, readBody, setCookie } from 'h3'
import { readToken } from '../../../utils/authToken'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string }>(event)

  if (!body?.token || typeof body.token !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'token is required.' })
  }

  const stored = readToken()
  if (!stored) {
    throw createError({ statusCode: 400, statusMessage: 'No token configured on this server.' })
  }

  if (body.token !== stored) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid token.' })
  }

  setCookie(event, 'cortex_auth', stored, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365
  })

  return { ok: true }
})
