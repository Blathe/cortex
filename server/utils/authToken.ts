import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const AUTH_PATH = resolve(process.cwd(), 'agent/config/auth.json')

interface AuthConfig {
  token: string
}

// Set once per process by the startup plugin when it generates a fresh token.
// Consumed (and cleared) by the auth middleware to silently establish the first
// browser session without requiring the user to call /generate explicitly.
let firstRunPending = false

export const setFirstRunPending = (): void => {
  firstRunPending = true
}

export const consumeFirstRun = (): boolean => {
  if (firstRunPending) {
    firstRunPending = false
    return true
  }
  return false
}

export const readToken = (): string | null => {
  try {
    if (!existsSync(AUTH_PATH)) return null
    const raw = readFileSync(AUTH_PATH, 'utf-8')
    const config = JSON.parse(raw) as AuthConfig
    return config.token || null
  } catch {
    return null
  }
}

export const writeToken = (token: string): void => {
  writeFileSync(AUTH_PATH, JSON.stringify({ token }, null, 2) + '\n', 'utf-8')
}

export const generateToken = (): string => randomBytes(32).toString('hex')
