import { createError, defineEventHandler, readBody } from 'h3'
import {
  clearPinAttempts,
  enforcePinRateLimit,
  generateRecoveryCode,
  getStoredPinHash,
  hashPin,
  hashRecoveryCode,
  isPinConfigured,
  isValidPin,
  recordPinFailure,
  verifyPin
} from '../../../utils/pinAuth'
import { writePinData } from '../../../utils/pinStore'
import { requireSudoMode } from '../../../utils/authSession'

interface ChangePinBody {
  currentPin?: unknown
  newPin?: unknown
  confirmNewPin?: unknown
}

/**
 * POST /api/agent/auth/change-pin
 * Change the PIN. Requires an active session with recent sudo confirmation.
 */
export default defineEventHandler(async (event) => {
  enforcePinRateLimit(event)
  requireSudoMode(event)

  if (!isPinConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'PIN is not configured.' })
  }

  const body = await readBody<ChangePinBody>(event).catch(() => ({}) as ChangePinBody)

  if (!isValidPin(body.currentPin)) {
    throw createError({ statusCode: 400, statusMessage: 'currentPin must be exactly 6 digits.' })
  }

  if (!isValidPin(body.newPin)) {
    throw createError({ statusCode: 400, statusMessage: 'newPin must be exactly 6 digits.' })
  }

  if (body.newPin !== body.confirmNewPin) {
    throw createError({ statusCode: 400, statusMessage: 'New PINs do not match.' })
  }

  const storedHash = getStoredPinHash()!
  const currentValid = await verifyPin(body.currentPin, storedHash)

  if (!currentValid) {
    recordPinFailure(event)
    throw createError({ statusCode: 401, statusMessage: 'Current PIN is incorrect.' })
  }

  clearPinAttempts(event)

  const newRecoveryCode = generateRecoveryCode()
  const [newPinHash, newRecoveryHash] = await Promise.all([
    hashPin(body.newPin),
    hashRecoveryCode(newRecoveryCode)
  ])

  writePinData({
    pinHash: newPinHash,
    recoveryHash: newRecoveryHash,
    recoveryUsed: false
  })

  return { ok: true, recoveryCode: newRecoveryCode }
})
