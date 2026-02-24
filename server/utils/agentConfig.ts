import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import simpleGit from 'simple-git'

const SETTINGS_PATH = resolve(process.cwd(), 'agent/config/settings.json')
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
    updatedAt: string
    updatedBy: string
  }
}

export const DEFAULT_SETTINGS: AgentSettings = {
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
    updatedAt: new Date().toISOString(),
    updatedBy: 'user'
  }
}

export const LOW_RISK_FIELDS = new Set([
  'persona.tone',
  'persona.verbosity',
  'reasoning.temperature',
  'reasoning.maxTokens'
])

const VALID_TOP_LEVEL_KEYS = new Set(['persona', 'reasoning', 'git', 'meta'])

export const readSettings = (): AgentSettings => {
  try {
    if (!existsSync(SETTINGS_PATH)) {
      return { ...DEFAULT_SETTINGS }
    }
    const raw = readFileSync(SETTINGS_PATH, 'utf-8')
    return JSON.parse(raw) as AgentSettings
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
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

export const writeSettings = (patch: Record<string, unknown>, source: 'user' | 'agent'): AgentSettings => {
  const current = readSettings()
  const merged = deepMerge(current as unknown as Record<string, unknown>, patch) as unknown as AgentSettings
  merged.meta = {
    updatedAt: new Date().toISOString(),
    updatedBy: source
  }
  writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
  return merged
}

export const validatePatch = (patch: Record<string, unknown>): string | null => {
  for (const key of Object.keys(patch)) {
    if (!VALID_TOP_LEVEL_KEYS.has(key)) {
      return `Unknown top-level key: "${key}". Allowed keys: ${[...VALID_TOP_LEVEL_KEYS].join(', ')}`
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

export const createChangeLog = (
  prev: AgentSettings,
  next: AgentSettings,
  source: 'user' | 'agent',
  reason: string,
  sessionId: string,
  patch: Record<string, unknown>
): string => {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true })
  }

  const now = new Date()
  const datePart = now.toISOString().replace('T', ' ').slice(0, 19)
  const fileDate = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
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

  writeFileSync(filePath, content, 'utf-8')
  return filePath
}

export const commitAndPush = async (branch: string, files: string[], message: string): Promise<void> => {
  const git = simpleGit(process.cwd())
  await git.checkoutLocalBranch(branch)
  await git.add(files)
  await git.commit(message)
  await git.push('origin', branch, ['--set-upstream'])
}

export const createGitHubPR = async (
  branch: string,
  title: string,
  body: string,
  labels: string[]
): Promise<string> => {
  const token = process.env.GH_TOKEN
  const repo = process.env.GH_REPO

  if (!token || !repo) {
    throw new Error('GH_TOKEN and GH_REPO env vars are required for PR creation.')
  }

  const [owner, repoName] = repo.split('/')
  const response = await $fetch<{ html_url: string }>(`https://api.github.com/repos/${owner}/${repoName}/pulls`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: {
      title,
      body,
      head: branch,
      base: 'master',
      labels
    }
  })

  const prUrl = response.html_url

  // Add labels to the PR (GitHub requires a separate labels API call for most cases)
  const prNumber = prUrl.split('/').at(-1)
  if (prNumber) {
    await $fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${prNumber}/labels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: { labels }
    }).catch(() => {
      // Non-fatal: labels may not exist yet
    })
  }

  return prUrl
}
