import { createError, defineEventHandler, readBody } from 'h3'
import { resolve } from 'node:path'
import {
  classifyRisk,
  commitAndPush,
  createChangeLog,
  createGitHubPR,
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

  const prev = readSettings()
  const next = writeSettings(patch, source)
  const logFile = createChangeLog(prev, next, source, reason, sessionId, patch)

  const settings = next

  if (!settings.git.autoPush) {
    return { settings, logFile }
  }

  const riskLevel = classifyRisk(patch)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const branch = `agent-config/${timestamp}`
  const commitMessage = `feat(agent): update config — ${reason || 'agent self-configuration'}`

  const settingsPath = resolve(process.cwd(), 'agent/config/settings.json')
  const filesToCommit = [settingsPath, logFile]

  let prUrl: string | undefined

  try {
    await commitAndPush(branch, filesToCommit, commitMessage)

    const label = riskLevel === 'low' ? 'auto-merge' : 'needs-review'
    const prTitle = `[agent-config] ${reason || 'Behavioral config update'}`
    const prBody = [
      `## Config Change`,
      '',
      `**Risk level:** ${riskLevel}`,
      `**Changed by:** ${source}`,
      `**Session:** ${sessionId}`,
      '',
      '### Patch',
      '',
      '```json',
      JSON.stringify(patch, null, 2),
      '```',
      '',
      `### Reason`,
      '',
      reason || '(no reason provided)'
    ].join('\n')

    prUrl = await createGitHubPR(branch, prTitle, prBody, [label])
  } catch (error) {
    const gitError = error as { message?: string }
    // Non-fatal: git/PR failure shouldn't block the config write
    console.warn('[agent/config] git push or PR creation failed:', gitError.message)
  }

  return { settings, logFile, pr: prUrl }
})
