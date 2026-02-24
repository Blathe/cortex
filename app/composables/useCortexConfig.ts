import type { CortexConfig } from '~/types/cortex'

const STORAGE_KEY = 'cortex.config.v1'

export const getDefaultCortexConfig = (): CortexConfig => {
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    updatedAt: new Date().toISOString()
  }
}

const sanitizeConfig = (value: unknown): CortexConfig => {
  const defaults = getDefaultCortexConfig()
  const maybeConfig = value as Partial<CortexConfig> | null

  if (!maybeConfig || typeof maybeConfig !== 'object') {
    return defaults
  }

  return {
    provider: typeof maybeConfig.provider === 'string' ? maybeConfig.provider : defaults.provider,
    model: typeof maybeConfig.model === 'string' ? maybeConfig.model : defaults.model,
    baseUrl: typeof maybeConfig.baseUrl === 'string' ? maybeConfig.baseUrl : defaults.baseUrl,
    apiKey: typeof maybeConfig.apiKey === 'string' ? maybeConfig.apiKey : defaults.apiKey,
    updatedAt: typeof maybeConfig.updatedAt === 'string' ? maybeConfig.updatedAt : defaults.updatedAt
  }
}

export const useCortexConfig = () => {
  const config = useState<CortexConfig>('cortex.config', () => getDefaultCortexConfig())

  const loadConfig = () => {
    if (!import.meta.client) {
      return config.value
    }

    const storedConfig = localStorage.getItem(STORAGE_KEY)
    if (!storedConfig) {
      return config.value
    }

    try {
      config.value = sanitizeConfig(JSON.parse(storedConfig))
    } catch {
      config.value = getDefaultCortexConfig()
    }

    return config.value
  }

  const saveConfig = (value: Omit<CortexConfig, 'updatedAt'>) => {
    const nextConfig: CortexConfig = {
      ...value,
      updatedAt: new Date().toISOString()
    }

    config.value = nextConfig

    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig))
    }

    return nextConfig
  }

  return {
    config,
    loadConfig,
    saveConfig
  }
}
