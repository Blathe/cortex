import { createError, defineEventHandler, readBody } from 'h3'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

interface EnvPostBody {
  vars: { key: string, value: string }[]
}

const ENV_PATH = resolve(process.cwd(), '.env')

const ALLOWED_KEYS = new Set(['GH_REPO', 'GH_TOKEN'])

const parseEnvFile = (content: string): Map<string, string> => {
  const map = new Map<string, string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    map.set(key, value)
  }
  return map
}

const serializeEnvFile = (map: Map<string, string>): string => {
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<EnvPostBody>(event)

  if (!Array.isArray(body?.vars)) {
    throw createError({ statusCode: 400, statusMessage: 'vars must be an array.' })
  }

  for (const entry of body.vars) {
    if (typeof entry.key !== 'string' || !entry.key.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Each var must have a non-empty key.' })
    }
    if (typeof entry.value !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Each var must have a string value.' })
    }
    if (!ALLOWED_KEYS.has(entry.key.trim())) {
      throw createError({ statusCode: 400, statusMessage: `Key '${entry.key}' is not allowed.` })
    }
  }

  let existing = ''
  try {
    existing = await readFile(ENV_PATH, 'utf-8')
  } catch {
    // .env doesn't exist yet — start fresh
  }

  const envMap = parseEnvFile(existing)
  for (const { key, value } of body.vars) {
    envMap.set(key.trim(), value)
  }

  await writeFile(ENV_PATH, serializeEnvFile(envMap), 'utf-8')
  return { ok: true }
})
