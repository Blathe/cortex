import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const ENV_PATH = resolve(process.cwd(), '.env')

export const parseEnvFile = (content: string): Map<string, string> => {
  const map = new Map<string, string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const raw = trimmed.slice(eqIndex + 1).trim()
    if (raw.startsWith('"') && raw.endsWith('"')) {
      map.set(key, raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
    } else {
      map.set(key, raw)
    }
  }
  return map
}

const needsQuoting = (value: string): boolean =>
  value.length === 0 || /[^\w./@:+-]/.test(value)

export const serializeValue = (value: string): string => {
  if (!needsQuoting(value)) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export const serializeEnvFile = (map: Map<string, string>): string =>
  [...map.entries()].map(([k, v]) => `${k}=${serializeValue(v)}`).join('\n') + '\n'

/**
 * Write key-value pairs to the .env file, updating existing keys in place.
 * Also immediately updates process.env so values are available without restart.
 */
export const writeEnvVars = (vars: Record<string, string>): void => {
  let existing = ''
  try {
    existing = readFileSync(ENV_PATH, 'utf-8')
  } catch {
    // .env doesn't exist yet
  }

  const envMap = parseEnvFile(existing)
  for (const [key, value] of Object.entries(vars)) {
    envMap.set(key, value)
    process.env[key] = value
  }

  writeFileSync(ENV_PATH, serializeEnvFile(envMap), 'utf-8')
}
