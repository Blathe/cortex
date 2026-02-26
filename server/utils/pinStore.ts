import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const PIN_STORE_PATH = resolve(process.cwd(), 'data', 'pin.json')

export interface PinData {
  pepper: string | null
  pinHash: string | null
  recoveryHash: string | null
  recoveryUsed: boolean
  sessionTtlSeconds: number | null
}

const DEFAULTS: PinData = {
  pepper: null,
  pinHash: null,
  recoveryHash: null,
  recoveryUsed: false,
  sessionTtlSeconds: null
}

export const readPinData = (): PinData => {
  try {
    const raw = readFileSync(PIN_STORE_PATH, 'utf-8')
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PinData>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export const writePinData = (patch: Partial<PinData>): void => {
  const current = readPinData()
  const updated = { ...current, ...patch }
  const dir = dirname(PIN_STORE_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(PIN_STORE_PATH, JSON.stringify(updated, null, 2), 'utf-8')
}
