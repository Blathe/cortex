import { createError, defineEventHandler, readBody } from 'h3'
import {
  ensurePinPepper,
  generateRecoveryCode,
  getStoredRecoveryHash,
  hashPin,
  hashRecoveryCode,
  isPinConfigured,
  isRecoveryCodeUsed,
  isValidPin,
  verifyRecoveryCode
} from '../../../utils/pinAuth'
import { writeEnvVars } from '../../../utils/envFile'
import { setSessionCookie } from '../../../utils/authSession'
import { enforceRateLimit } from '../../../utils/security'

interface RecoveryBody {
  recoveryCode?: unknown
  newPin?: unknown
  confirmNewPin?: unknown
}

/**
 * POST /api/agent/auth/recovery
 * Use a recovery code to reset the PIN. The code is single-use.
 * On success, a new PIN and a fresh recovery code are issued.
 */
export default defineEventHandler(async (event) => {
  enforceRateLimit(event, { key: 'agent-auth-recovery', maxAttempts: 5, windowMs: 15 * 60_000 })

  if (!isPinConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'PIN is not configured.' })
  }

  if (isRecoveryCodeUsed()) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Recovery code has already been used. Contact server admin to reset access.'
    })
  }

  const storedRecoveryHash = getStoredRecoveryHash()
  if (!storedRecoveryHash) {
    throw createError({ statusCode: 503, statusMessage: 'No recovery code is configured.' })
  }

  const body = await readBody<RecoveryBody>(event).catch(() => ({}) as RecoveryBody)

  if (typeof body.recoveryCode !== 'string' || !body.recoveryCode.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'recoveryCode is required.' })
  }

  if (!isValidPin(body.newPin)) {
    throw createError({ statusCode: 400, statusMessage: 'newPin must be exactly 6 digits.' })
  }

  if (body.newPin !== body.confirmNewPin) {
    throw createError({ statusCode: 400, statusMessage: 'New PINs do not match.' })
  }

  const codeValid = await verifyRecoveryCode(body.recoveryCode, storedRecoveryHash)
  if (!codeValid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid recovery code.' })
  }

  // Generate a new pepper — invalidates all existing sessions
  process.env.PIN_PEPPER = ''
  ensurePinPepper()

  const newRecoveryCode = generateRecoveryCode()
  const [newPinHash, newRecoveryHash] = await Promise.all([
    hashPin(body.newPin),
    hashRecoveryCode(newRecoveryCode)
  ])

  writeEnvVars({
    PIN_HASH: newPinHash,
    PIN_RECOVERY_HASH: newRecoveryHash,
    PIN_RECOVERY_USED: 'false'
  })

  setSessionCookie(event)

  return { ok: true, sessionEstablished: true, recoveryCode: newRecoveryCode }
})
