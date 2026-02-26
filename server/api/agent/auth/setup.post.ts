import { createError, defineEventHandler, readBody } from 'h3'
import {
  ensurePinPepper,
  hashPin,
  hashRecoveryCode,
  isPinConfigured,
  isValidPin,
  isValidRecoveryCodeInput
} from '../../../utils/pinAuth'
import { writeEnvVars } from '../../../utils/envFile'
import { setSessionCookie } from '../../../utils/authSession'
import { enforceRateLimit } from '../../../utils/security'

interface SetupBody {
  pin?: unknown
  confirmPin?: unknown
  recoveryCode?: unknown
  sessionTtlSeconds?: unknown
}

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, { key: 'agent-auth-setup', maxAttempts: 10, windowMs: 60_000 })

  if (isPinConfigured()) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A PIN is already configured. Use /api/agent/auth/change-pin to update it.'
    })
  }

  const body = await readBody<SetupBody>(event).catch(() => ({}) as SetupBody)

  if (!isValidPin(body.pin)) {
    throw createError({ statusCode: 400, statusMessage: 'PIN must be exactly 6 digits.' })
  }

  if (body.pin !== body.confirmPin) {
    throw createError({ statusCode: 400, statusMessage: 'PINs do not match.' })
  }

  if (!isValidRecoveryCodeInput(body.recoveryCode)) {
    throw createError({ statusCode: 400, statusMessage: 'recoveryCode must be a 16-character code.' })
  }

  if (body.sessionTtlSeconds !== undefined) {
    const ttl = Number(body.sessionTtlSeconds)
    if (!Number.isInteger(ttl) || ttl < 60 || ttl > 60 * 60 * 24 * 7) {
      throw createError({
        statusCode: 400,
        statusMessage: 'sessionTtlSeconds must be an integer between 60 and 604800.'
      })
    }
  }

  ensurePinPepper()

  const [pinHash, recoveryHash] = await Promise.all([
    hashPin(body.pin),
    hashRecoveryCode(body.recoveryCode)
  ])

  const vars: Record<string, string> = {
    PIN_HASH: pinHash,
    PIN_RECOVERY_HASH: recoveryHash,
    PIN_RECOVERY_USED: 'false'
  }

  if (body.sessionTtlSeconds !== undefined) {
    vars.CORTEX_SESSION_TTL_SECONDS = String(body.sessionTtlSeconds)
  }

  writeEnvVars(vars)
  setSessionCookie(event)

  return { ok: true, sessionEstablished: true }
})
