import { defineEventHandler } from 'h3'
import { isPinConfigured } from '../../../utils/pinAuth'
import { validateSession } from '../../../utils/authSession'
import { readSettings } from '../../../utils/agentConfig'

/**
 * GET /api/agent/auth/status
 * Public endpoint — returns onboarding and session state.
 * Used by the global route middleware to determine redirect targets.
 */
export default defineEventHandler(async (event) => {
  const settings = await readSettings().catch(() => null)
  const onboarded = settings?.meta?.onboarded === true

  const session = validateSession(event)
  const authenticated = session.valid

  return {
    onboarded,
    authenticated,
    pinConfigured: isPinConfigured()
  }
})
