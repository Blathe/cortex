import { createError, defineEventHandler, readBody } from 'h3'
import { resolve } from 'node:path'
import {
  classifyRisk,
  commitToBranch,
  createChangeLog,
  isGitAutomationEnabled,
  RevisionConflictError,
  upsertConfigPullRequest,
  validatePatch,
  writeSettings
} from '../../utils/agentConfig'

interface ConfigPostBody {
  patch: Record<string, unknown>
  reason?: string
  source?: 'user' | 'agent'
  sessionId?: string
  expectedRevision?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ConfigPostBody>(event)

  const patch = body.patch
  const reason = body.reason?.trim() ?? ''
  const source = body.source ?? 'agent'
  const sessionId = body.sessionId ?? `session_${Date.now()}`
  const expectedRevision = body.expectedRevision

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw createError({ statusCode: 400, statusMessage: 'patch must be a non-null object.' })
  }

  const validationError = validatePatch(patch)
  if (validationError) {
    throw createError({ statusCode: 400, statusMessage: validationError })
  }

  if (expectedRevision !== undefined && (!Number.isInteger(expectedRevision) || expectedRevision < 0)) {
    throw createError({ statusCode: 400, statusMessage: 'expectedRevision must be a non-negative integer when provided.' })
  }

  let writeResult: Awaited<ReturnType<typeof writeSettings>>
  try {
    writeResult = await writeSettings(patch, {
      source,
      ...(expectedRevision !== undefined ? { expectedRevision } : {})
    })
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Settings were updated by another request. Reload and retry.',
        data: {
          expectedRevision: error.expectedRevision,
          currentRevision: error.currentRevision
        }
      })
    }
    throw error
  }

  const { previous: prev, next } = writeResult
  const logFile = await createChangeLog(prev, next, source, reason, sessionId, patch)

  if (!next.git.autoPush) {
    return {
      settings: next,
      logFile,
      persistenceStatus: 'persisted',
      gitStatus: 'skipped',
      gitSkipReason: 'auto_push_disabled',
      prStatus: 'not_attempted',
      prSkipReason: 'git_skipped',
      automationEnabled: isGitAutomationEnabled()
    }
  }

  const automationEnabled = isGitAutomationEnabled()
  if (!automationEnabled) {
    return {
      settings: next,
      logFile,
      persistenceStatus: 'persisted',
      gitStatus: 'skipped',
      gitSkipReason: 'automation_disabled',
      prStatus: 'not_attempted',
      prSkipReason: 'automation_disabled',
      automationEnabled
    }
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
    return {
      settings: next,
      logFile,
      persistenceStatus: 'persisted',
      gitStatus: 'failed',
      gitError: gitError.message ?? 'Unknown git error',
      prStatus: 'not_attempted',
      prSkipReason: 'git_failed',
      automationEnabled,
      riskLevel
    }
  }

  const prResult = await upsertConfigPullRequest({
    branch,
    riskLevel,
    reason,
    autoMerge: next.git.autoMerge
  })

  return {
    settings: next,
    logFile,
    persistenceStatus: 'persisted',
    gitStatus: 'pushed',
    prStatus: prResult.status,
    ...(prResult.status === 'not_attempted' ? { prSkipReason: prResult.skipReason } : {}),
    ...(prResult.status === 'opened'
      ? {
          prNumber: prResult.number,
          prUrl: prResult.url,
          prLabels: prResult.labels
        }
      : {}),
    ...(prResult.status === 'failed' ? { prError: prResult.error } : {}),
    automationEnabled,
    branch,
    riskLevel
  }
})
