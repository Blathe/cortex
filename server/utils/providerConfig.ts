import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const PROVIDERS_PATH = resolve(process.cwd(), 'agent/config/providers.json')

export interface StoredProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
}

export interface ProvidersConfig {
  providers: StoredProvider[]
  activeId: string | null
}

export const readProviders = async (): Promise<ProvidersConfig> => {
  try {
    const raw = await readFile(PROVIDERS_PATH, 'utf-8')
    return JSON.parse(raw) as ProvidersConfig
  } catch {
    return { providers: [], activeId: null }
  }
}

export const writeProviders = async (config: ProvidersConfig): Promise<void> => {
  await mkdir(dirname(PROVIDERS_PATH), { recursive: true })
  await writeFile(PROVIDERS_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}
