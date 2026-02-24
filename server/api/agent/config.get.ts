import { defineEventHandler } from 'h3'
import { readSettings } from '../../utils/agentConfig'

export default defineEventHandler(() => {
  const settings = readSettings()
  return { settings }
})
