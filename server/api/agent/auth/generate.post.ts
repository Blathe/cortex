import { createError, defineEventHandler, getCookie, getHeader, setCookie } from 'h3'
import { generateToken, readToken, writeToken } from '../../../utils/authToken'

export default defineEventHandler((event) => {
  const existing = readToken()

  // If a token already exists, require it to regenerate (prevent unauthenticated rotation).
  // Accept either a Bearer header (CLI) or the HttpOnly cookie (browser).
  if (existing !== null) {
    const header = getHeader(event, 'authorization')
    const cookie = getCookie(event, 'cortex_auth')
    if (header !== `Bearer ${existing}` && cookie !== existing) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  const token = generateToken()
  writeToken(token)

  setCookie(event, 'cortex_auth', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365
  })

  // Still return the token so the user can copy it for programmatic/CLI use.
  // It is NOT stored client-side; the HttpOnly cookie handles browser auth.
  return { token }
})
