import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SETTINGS_PATH = resolve(process.cwd(), 'agent/config/settings.json')
const SETTINGS_TMP_PATH = `${SETTINGS_PATH}.tmp`
const LOGS_DIR = resolve(process.cwd(), 'agent/logs')

export interface AgentSettings {
  version: number
  persona: {
    name: string
    tone: string
    verbosity: string
  }
  reasoning: {
    temperature: number
    maxTokens: number
  }
  git: {
    autoPush: boolean
    autoMerge: boolean
  }
  meta: {
    onboarded?: boolean
    updatedAt: string
    updatedBy: string
    revision: number
  }
}

const createDefaultSettings = (): AgentSettings => ({
  version: 1,
  persona: {
    name: 'Cortex',
    tone: 'professional',
    verbosity: 'medium'
  },
  reasoning: {
    temperature: 0.7,
    maxTokens: 2048
  },
  git: {
    autoPush: true,
    autoMerge: true
  },
  meta: {
    onboarded: false,
    updatedAt: new Date().toISOString(),
    updatedBy: 'user',
    revision: 0
  }
})

export const DEFAULT_SETTINGS: AgentSettings = createDefaultSettings()

export const LOW_RISK_FIELDS = new Set([
  'persona.tone',
  'persona.verbosity',
  'reasoning.temperature',
  'reasoning.maxTokens'
])

type FieldValidator = (v: unknown) => string | null

const PATCH_SCHEMA: Record<string, Record<string, FieldValidator>> = {
  persona: {
    name: (v) => {
      return (typeof v === 'string' && v.trim().length > 0)
        ? null
        : 'Must be a non-empty string.'
    },
    tone: (v) => {
      return ['professional', 'casual', 'concise', 'verbose'].includes(v as string)
        ? null
        : 'Must be one of: professional, casual, concise, verbose.'
    },
    verbosity: (v) => {
      return ['low', 'medium', 'high'].includes(v as string)
        ? null
        : 'Must be one of: low, medium, high.'
    }
  },
  reasoning: {
    temperature: (v) => {
      return (typeof v === 'number' && v >= 0 && v <= 2)
        ? null
        : 'Must be a number between 0 and 2.'
    },
    maxTokens: (v) => {
      return (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 16384)
        ? null
        : 'Must be an integer between 1 and 16384.'
    }
  },
  git: {
    autoPush: (v) => {
      return typeof v === 'boolean'
        ? null
        : 'Must be a boolean.'
    },
    autoMerge: (v) => {
      return typeof v === 'boolean'
        ? null
        : 'Must be a boolean.'
    }
  },
  meta: {
    onboarded: (v) => {
      return typeof v === 'boolean'
        ? null
        : 'Must be a boolean.'
    }
  }
}

const sanitizeSettings = (value: unknown): AgentSettings => {
  const defaults = createDefaultSettings()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults
  }

  const raw = value as Partial<AgentSettings>

  const revision = typeof raw.meta?.revision === 'number' && Number.isInteger(raw.meta.revision) && raw.meta.revision >= 0
    ? raw.meta.revision
    : defaults.meta.revision

  return {
    version: typeof raw.version === 'number' ? raw.version : defaults.version,
    persona: {
      name: typeof raw.persona?.name === 'string' && raw.persona.name.trim() ? raw.persona.name : defaults.persona.name,
      tone: typeof raw.persona?.tone === 'string' ? raw.persona.tone : defaults.persona.tone,
      verbosity: typeof raw.persona?.verbosity === 'string' ? raw.persona.verbosity : defaults.persona.verbosity
    },
    reasoning: {
      temperature: typeof raw.reasoning?.temperature === 'number' ? raw.reasoning.temperature : defaults.reasoning.temperature,
      maxTokens: typeof raw.reasoning?.maxTokens === 'number' ? raw.reasoning.maxTokens : defaults.reasoning.maxTokens
    },
    git: {
      autoPush: typeof raw.git?.autoPush === 'boolean' ? raw.git.autoPush : defaults.git.autoPush,
      autoMerge: typeof raw.git?.autoMerge === 'boolean' ? raw.git.autoMerge : defaults.git.autoMerge
    },
    meta: {
      onboarded: typeof raw.meta?.onboarded === 'boolean' ? raw.meta.onboarded : defaults.meta.onboarded,
      updatedAt: typeof raw.meta?.updatedAt === 'string' ? raw.meta.updatedAt : defaults.meta.updatedAt,
      updatedBy: typeof raw.meta?.updatedBy === 'string' ? raw.meta.updatedBy : defaults.meta.updatedBy,
      revision
    }
  }
}

export const readSettings = async (): Promise<AgentSettings> => {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8')
    return sanitizeSettings(JSON.parse(raw))
  } catch {
    return createDefaultSettings()
  }
}

const writeSettingsAtomic = async (settings: AgentSettings): Promise<void> => {
  await mkdir(dirname(SETTINGS_PATH), { recursive: true })
  const payload = JSON.stringify(settings, null, 2) + '\n'
  await writeFile(SETTINGS_TMP_PATH, payload, 'utf-8')
  await rename(SETTINGS_TMP_PATH, SETTINGS_PATH)
}

const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    const tgtVal = target[key]
    if (
      srcVal !== null
      && typeof srcVal === 'object'
      && !Array.isArray(srcVal)
      && tgtVal !== null
      && typeof tgtVal === 'object'
      && !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>)
    } else {
      result[key] = srcVal
    }
  }
  return result
}

class SettingsWriteLock {
  private tail: Promise<void> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    let release: () => void = () => {}
    const next = new Promise<void>((resolve) => {
      release = resolve
    })

    const previous = this.tail
    this.tail = this.tail.then(() => next)

    return previous.then(task).finally(() => {
      release()
    })
  }
}

const settingsWriteLock = new SettingsWriteLock()

export class RevisionConflictError extends Error {
  readonly expectedRevision: number
  readonly currentRevision: number

  constructor(expectedRevision: number, currentRevision: number) {
    super(`Settings revision mismatch. Expected ${expectedRevision}, current ${currentRevision}.`)
    this.name = 'RevisionConflictError'
    this.expectedRevision = expectedRevision
    this.currentRevision = currentRevision
  }
}

interface WriteSettingsOptions {
  source: 'user' | 'agent'
  expectedRevision?: number
}

interface WriteSettingsResult {
  previous: AgentSettings
  next: AgentSettings
}

export const writeSettings = async (
  patch: Record<string, unknown>,
  options: WriteSettingsOptions
): Promise<WriteSettingsResult> => {
  return settingsWriteLock.run(async () => {
    const current = await readSettings()
    const currentRevision = current.meta.revision

    if (
      options.expectedRevision !== undefined
      && options.expectedRevision !== currentRevision
    ) {
      throw new RevisionConflictError(options.expectedRevision, currentRevision)
    }

    const merged = deepMerge(current as unknown as Record<string, unknown>, patch) as unknown as AgentSettings
    merged.meta = {
      ...merged.meta,
      revision: currentRevision + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: options.source
    }

    await writeSettingsAtomic(merged)
    return { previous: current, next: merged }
  })
}

export const validatePatch = (patch: Record<string, unknown>): string | null => {
  const allowedSections = Object.keys(PATCH_SCHEMA)

  for (const [section, value] of Object.entries(patch)) {
    const sectionSchema = PATCH_SCHEMA[section]
    if (!sectionSchema) {
      return `Unknown section "${section}". Allowed: ${allowedSections.join(', ')}.`
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return `"${section}" must be an object.`
    }
    const fields = value as Record<string, unknown>
    const allowedFields = Object.keys(sectionSchema)
    for (const [field, fieldVal] of Object.entries(fields)) {
      const validate = sectionSchema[field]
      if (!validate) {
        return `Unknown field "${section}.${field}". Allowed: ${allowedFields.join(', ')}.`
      }
      const err = validate(fieldVal)
      if (err) {
        return `Invalid value for "${section}.${field}": ${err}`
      }
    }
  }
  return null
}

const getPatchDotPaths = (obj: Record<string, unknown>, prefix = ''): string[] => {
  const paths: string[] = []
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key
    const val = obj[key]
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      paths.push(...getPatchDotPaths(val as Record<string, unknown>, full))
    } else {
      paths.push(full)
    }
  }
  return paths
}

export const classifyRisk = (patch: Record<string, unknown>): 'low' | 'high' => {
  const paths = getPatchDotPaths(patch)
  for (const path of paths) {
    if (!LOW_RISK_FIELDS.has(path)) {
      return 'high'
    }
  }
  return 'low'
}

const slugify = (text: string): string => {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-+$/, '')
}

export const createChangeLog = async (
  prev: AgentSettings,
  next: AgentSettings,
  source: 'user' | 'agent',
  reason: string,
  sessionId: string,
  patch: Record<string, unknown>
): Promise<string> => {
  await mkdir(LOGS_DIR, { recursive: true })

  const now = new Date()
  const datePart = now.toISOString().replace('T', ' ').slice(0, 19)
  const fileDate = now.toISOString().replace(/[:.]/g, '-').slice(0, 23)
  const slug = slugify(reason || 'config-change')
  const fileName = `${fileDate}_${slug}.md`
  const filePath = resolve(LOGS_DIR, fileName)

  const content = [
    `# Config Change — ${datePart}`,
    '',
    `**Changed by:** ${source} (via chat)`,
    `**Session:** ${sessionId}`,
    '',
    '## Patch',
    '',
    '```json',
    JSON.stringify(patch, null, 2),
    '```',
    '',
    '## Previous value',
    '',
    '```json',
    JSON.stringify(prev, null, 2),
    '```',
    '',
    '## New value',
    '',
    '```json',
    JSON.stringify(next, null, 2),
    '```',
    '',
    '## Reason',
    '',
    reason || '(no reason provided)',
    ''
  ].join('\n')

  await writeFile(filePath, content, 'utf-8')
  return filePath
}

const git = (...args: string[]) =>
  execFileAsync('git', args, { cwd: process.cwd() })

const GITHUB_API_BASE = 'https://api.github.com'

export const isGitAutomationEnabled = (): boolean => {
  const raw = process.env.AGENT_GIT_AUTOMATION_ENABLED?.trim().toLowerCase()
  if (!raw) {
    return process.env.NODE_ENV !== 'production'
  }
  if (['1', 'true', 'yes', 'on'].includes(raw)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(raw)) {
    return false
  }
  return process.env.NODE_ENV !== 'production'
}

export const commitToBranch = async (branch: string, files: string[], message: string): Promise<void> => {
  const cwd = process.cwd()
  const safeName = branch.replace(/[^a-z0-9-]/g, '-')
  const worktreePath = resolve(cwd, `.gitworktrees/${safeName}`)

  try {
    // Create an isolated worktree on a new branch — main working tree HEAD is never touched
    await git('worktree', 'add', '-b', branch, worktreePath)

    // Copy the changed files from the main tree into the worktree
    for (const file of files) {
      const rel = relative(cwd, file)
      const dest = resolve(worktreePath, rel)
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(file, dest)
    }

    // Commit and push from within the isolated worktree
    const worktreeGit = (...args: string[]) => execFileAsync('git', args, { cwd: worktreePath })
    await worktreeGit('add', ...files.map(f => relative(cwd, f)))
    await worktreeGit('commit', '-m', message)
    await worktreeGit('push', '--set-upstream', 'origin', branch)
  } finally {
    // Always clean up the worktree regardless of success or failure
    await git('worktree', 'remove', '--force', worktreePath).catch(() => {})
  }
}

interface GitHubRepoRef {
  owner: string
  repo: string
}

interface GitHubPullRequest {
  number: number
  html_url: string
}

export interface UpsertConfigPullRequestOptions {
  branch: string
  riskLevel: 'low' | 'high'
  reason: string
  autoMerge: boolean
}

export interface UpsertConfigPullRequestResult {
  status: 'opened' | 'not_attempted' | 'failed'
  number?: number
  url?: string
  skipReason?: 'github_not_configured' | 'repo_invalid'
  error?: string
  labels?: string[]
}

const parseGitHubRepo = (rawRepo: string | undefined): GitHubRepoRef | null => {
  if (!rawRepo) {
    return null
  }
  const match = rawRepo.trim().match(/^([^/\s]+)\/([^/\s]+)$/)
  if (!match) {
    return null
  }
  return {
    owner: match[1]!,
    repo: match[2]!
  }
}

const requestGitHub = async <T>(
  token: string,
  path: string,
  init: {
    method?: string
    body?: unknown
  } = {}
): Promise<T> => {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'authorization': `Bearer ${token}`,
      'accept': 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {})
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {})
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(payload?.message || `GitHub API request failed (${response.status})`)
  }

  return response.json() as Promise<T>
}

const findExistingOpenPullRequest = async (
  token: string,
  repo: GitHubRepoRef,
  branch: string
): Promise<GitHubPullRequest | null> => {
  const head = encodeURIComponent(`${repo.owner}:${branch}`)
  const pulls = await requestGitHub<GitHubPullRequest[]>(
    token,
    `/repos/${repo.owner}/${repo.repo}/pulls?state=open&head=${head}`
  )
  return pulls[0] ?? null
}

const upsertPullRequest = async (
  token: string,
  repo: GitHubRepoRef,
  branch: string,
  reason: string
): Promise<GitHubPullRequest> => {
  const title = `feat(agent): update config${reason ? ` — ${reason}` : ''}`
  const body = [
    'Automated agent configuration update.',
    '',
    `Branch: \`${branch}\``,
    '',
    'This PR was opened by Cortex automation.'
  ].join('\n')

  try {
    return await requestGitHub<GitHubPullRequest>(token, `/repos/${repo.owner}/${repo.repo}/pulls`, {
      method: 'POST',
      body: {
        title,
        head: branch,
        base: 'master',
        body
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.toLowerCase().includes('already exists')) {
      throw error
    }

    const existing = await findExistingOpenPullRequest(token, repo, branch)
    if (!existing) {
      throw new Error('Pull request already exists but could not be resolved.')
    }
    return existing
  }
}

const applyRiskLabels = async (
  token: string,
  repo: GitHubRepoRef,
  pullNumber: number,
  labels: string[]
): Promise<void> => {
  await requestGitHub<{ labels: Array<{ name: string }> }>(
    token,
    `/repos/${repo.owner}/${repo.repo}/issues/${pullNumber}/labels`,
    {
      method: 'POST',
      body: { labels }
    }
  )
}

export const upsertConfigPullRequest = async (
  options: UpsertConfigPullRequestOptions
): Promise<UpsertConfigPullRequestResult> => {
  const token = process.env.GH_TOKEN?.trim() ?? ''
  if (!token) {
    return { status: 'not_attempted', skipReason: 'github_not_configured' }
  }

  const repo = parseGitHubRepo(process.env.GH_REPO)
  if (!repo) {
    return { status: 'not_attempted', skipReason: 'repo_invalid' }
  }

  try {
    const pull = await upsertPullRequest(token, repo, options.branch, options.reason)
    const labels = options.riskLevel === 'low' && options.autoMerge
      ? ['auto-merge']
      : ['needs-review']

    await applyRiskLabels(token, repo, pull.number, labels)

    return {
      status: 'opened',
      number: pull.number,
      url: pull.html_url,
      labels
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: 'failed',
      error: message
    }
  }
}
