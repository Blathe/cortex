import { createError, defineEventHandler, getCookie, getHeader, readBody } from 'h3'
import { generateToken, readToken, writeToken } from '../../../utils/authToken'
import { setSessionCookie, validateSessionCookieValue } from '../../../utils/authSession'
import { enforceRateLimit, safeStringEqual } from '../../../utils/security'

interface GeneratePostBody {
  revealToken?: unknown
}

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, { key: 'agent-auth-generate', maxAttempts: 20, windowMs: 60_000 })

  const body: GeneratePostBody = await readBody<GeneratePostBody>(event)
    .catch(() => ({}) as GeneratePostBody)
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
    // Accept either a Bearer header (CLI) or a valid signed session cookie (browser).
    const header = getHeader(event, 'authorization')
    const cookie = getCookie(event, 'cortex_auth')
    const hasBearerAuth = header === `Bearer ${existing}`
    const hasValidSession = validateSessionCookieValue(cookie, existing).valid
    if (!hasBearerAuth && !hasValidSession) {
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

  setSessionCookie(event, token)

  const revealToken = body?.revealToken === true
  if (revealToken) {
    return {
      sessionEstablished: true,
      token
    }
  }

  return {
    sessionEstablished: true,
    tokenRevealed: false
  }
})
