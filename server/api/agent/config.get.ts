import { defineEventHandler } from 'h3'
import { isGitAutomationEnabled, readSettings } from '../../utils/agentConfig'

export default defineEventHandler(async () => {
  const settings = await readSettings()
  return {
    settings,
    automationEnabled: isGitAutomationEnabled()
  }
})
