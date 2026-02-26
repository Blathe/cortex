import { createError, defineEventHandler, readBody } from 'h3'
import { parseEnvFile, serializeEnvFile, ENV_PATH } from '../../utils/envFile'
import { readFile, writeFile } from 'node:fs/promises'

interface EnvPostBody {
  vars: { key: string, value: string }[]
}

const ALLOWED_KEYS = new Set(['GH_REPO', 'GH_TOKEN'])
const GH_REPO_RE = /^[^/\s]+\/[^/\s]+$/
const MAX_VALUE_LENGTH = 1000

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
    if (/[\r\n]/.test(entry.value)) {
      throw createError({ statusCode: 400, statusMessage: `Value for '${entry.key}' must not contain newline characters.` })
    }
    if (entry.value.length > MAX_VALUE_LENGTH) {
      throw createError({ statusCode: 400, statusMessage: `Value for '${entry.key}' exceeds maximum allowed length.` })
    }
    if (entry.key.trim() === 'GH_REPO' && entry.value.trim() && !GH_REPO_RE.test(entry.value.trim())) {
      throw createError({ statusCode: 400, statusMessage: `GH_REPO must be in 'owner/repo' format.` })
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
