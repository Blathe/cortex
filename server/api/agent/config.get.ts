import { defineEventHandler } from 'h3'
import { isGitAutomationEnabled, readSettings } from '../../utils/agentConfig'
import { readToken } from '../../utils/authToken'

const toTokenPreview = (token: string): string => `${token.slice(0, 5)}...`

export default defineEventHandler(async () => {
  const settings = await readSettings()
  const token = readToken()

  return {
    settings,
    automationEnabled: isGitAutomationEnabled(),
    auth: {
      configured: Boolean(token),
      tokenPreview: token ? toTokenPreview(token) : null
    }
  }
})
