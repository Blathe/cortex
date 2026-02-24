import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const AUTH_PATH = resolve(process.cwd(), 'agent/config/auth.json')

interface AuthConfig {
  token: string
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
