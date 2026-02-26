import { defineEventHandler } from 'h3'
import { isGitAutomationEnabled, readSettings } from '../../utils/agentConfig'
import { isPinConfigured } from '../../utils/pinAuth'

export default defineEventHandler(async () => {
  const settings = await readSettings()

  return {
    settings,
    automationEnabled: isGitAutomationEnabled(),
    auth: {
      configured: isPinConfigured()
    }
  }
})
