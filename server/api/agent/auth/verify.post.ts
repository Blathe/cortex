import { createError, defineEventHandler, readBody } from 'h3'
import {
  clearPinAttempts,
  enforcePinRateLimit,
  getStoredPinHash,
  isPinConfigured,
  isValidPin,
  recordPinFailure,
  verifyPin
} from '../../../utils/pinAuth'
import { setSessionCookie, validateSession } from '../../../utils/authSession'

/**
 * POST /api/agent/auth/verify
 * Sudo re-authentication: validates PIN and stamps sudoAt on the current session.
 * Requires an existing valid session.
 */
export default defineEventHandler(async (event) => {
  enforcePinRateLimit(event)

  const session = validateSession(event)
  if (!session.valid) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!isPinConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'PIN is not configured.' })
  }

  const body = await readBody<{ pin?: unknown }>(event).catch(() => ({ pin: undefined }))

  if (!isValidPin(body?.pin)) {
    recordPinFailure(event)
    throw createError({ statusCode: 400, statusMessage: 'PIN must be exactly 6 digits.' })
  }

  const storedHash = getStoredPinHash()!
  const valid = await verifyPin(body.pin, storedHash)

  if (!valid) {
    recordPinFailure(event)
    throw createError({ statusCode: 401, statusMessage: 'Invalid PIN.' })
  }

  clearPinAttempts(event)
  const sudoAt = Math.floor(Date.now() / 1000)
  setSessionCookie(event, sudoAt)

  return { ok: true, sudoGranted: true }
})
