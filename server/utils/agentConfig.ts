import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

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
  }
}

export const readSettings = async (): Promise<AgentSettings> => {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8')
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

export const writeSettings = async (patch: Record<string, unknown>, source: 'user' | 'agent'): Promise<AgentSettings> => {
  const current = await readSettings()
  const merged = deepMerge(current as unknown as Record<string, unknown>, patch) as unknown as AgentSettings
  merged.meta = {
    updatedAt: new Date().toISOString(),
    updatedBy: source
  }
  await writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
  return merged
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
