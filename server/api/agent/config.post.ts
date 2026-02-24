import { createError, defineEventHandler, readBody } from 'h3'
import { resolve } from 'node:path'
import {
  classifyRisk,
  commitToBranch,
  createChangeLog,
  readSettings,
  validatePatch,
  writeSettings
} from '../../utils/agentConfig'

interface ConfigPostBody {
  patch: Record<string, unknown>
  reason?: string
  source?: 'user' | 'agent'
  sessionId?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ConfigPostBody>(event)

  const patch = body.patch
  const reason = body.reason?.trim() ?? ''
  const source = body.source ?? 'agent'
  const sessionId = body.sessionId ?? `session_${Date.now()}`

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw createError({ statusCode: 400, statusMessage: 'patch must be a non-null object.' })
  }

  const validationError = validatePatch(patch)
  if (validationError) {
    throw createError({ statusCode: 400, statusMessage: validationError })
  }

  const prev = await readSettings()
  const next = await writeSettings(patch, source)
  const logFile = await createChangeLog(prev, next, source, reason, sessionId, patch)

  if (!next.git.autoPush) {
    return { settings: next, logFile }
  }

  const riskLevel = classifyRisk(patch)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23)
  const branch = `agent-config/${timestamp}`
  const commitMessage = `feat(agent): update config — ${reason || 'agent self-configuration'}`

  const settingsPath = resolve(process.cwd(), 'agent/config/settings.json')

  try {
    await commitToBranch(branch, [settingsPath, logFile], commitMessage)
  } catch (error) {
    const gitError = error as { message?: string }
    console.warn('[agent/config] git commit failed:', gitError.message)
  }

  return { settings: next, logFile, branch, riskLevel }
})
