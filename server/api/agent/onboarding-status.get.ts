import { defineEventHandler } from 'h3'
import { readSettings } from '../../utils/agentConfig'

export default defineEventHandler(async () => {
  const settings = await readSettings()
  return { onboarded: settings.meta.onboarded === true }
})
