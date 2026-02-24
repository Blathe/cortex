import { createError, defineEventHandler, getCookie, getHeader, setCookie } from 'h3'
import { createHash, timingSafeEqual } from 'node:crypto'
import { generateToken, readToken, writeToken } from '../../../utils/authToken'

// Hash both strings before comparing so timingSafeEqual always operates on equal-length buffers
// regardless of input length, preventing timing attacks on the setup secret.
const safeStringEqual = (a: string, b: string): boolean => {
  const hashA = createHash('sha256').update(a).digest()
  const hashB = createHash('sha256').update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

export default defineEventHandler((event) => {
  const existing = readToken()
  const setupSecret = process.env.CORTEX_SETUP_SECRET
  const providedSetupSecret = getHeader(event, 'x-cortex-setup-secret')

  // If a setup secret is configured and the caller provided one, validate it.
  // This ensures onboarding catches mistyped secrets immediately instead of
  // silently proceeding when other credentials (cookie/Bearer) are valid.
  if (setupSecret && providedSetupSecret !== undefined) {
    if (!safeStringEqual(providedSetupSecret, setupSecret)) {
      throw createError({ statusCode: 403, statusMessage: 'Invalid or missing setup secret.' })
    }
  }

  if (existing !== null) {
    // Token exists — require current credentials to rotate (prevent unauthenticated rotation).
    // Accept either a Bearer header (CLI) or the HttpOnly cookie (browser).
    const header = getHeader(event, 'authorization')
    const cookie = getCookie(event, 'cortex_auth')
    if (header !== `Bearer ${existing}` && cookie !== existing) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  } else {
    // No token yet — bootstrap path.
    // If CORTEX_SETUP_SECRET is configured, require it to prevent first-requester takeover.
    if (setupSecret) {
      const provided = providedSetupSecret ?? ''
      if (!safeStringEqual(provided, setupSecret)) {
        throw createError({ statusCode: 403, statusMessage: 'Invalid or missing setup secret.' })
      }
    }
    // If CORTEX_SETUP_SECRET is not set, bootstrap is open (local-dev convenience).
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
