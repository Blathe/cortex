export type ProviderId = 'openai' | 'anthropic' | 'groq'

export interface ProviderModelEntry {
  id: string
  label: string
}

export interface ProviderCatalogEntry {
  providerId: ProviderId
  label: string
  baseUrl: string
  authStrategy: 'bearer' | 'x-api-key'
  defaultModel: string
  models: ProviderModelEntry[]
}

export const PROVIDER_CATALOG: Record<ProviderId, ProviderCatalogEntry> = {
  openai: {
    providerId: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    authStrategy: 'bearer',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' }
    ]
  },
  anthropic: {
    providerId: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    authStrategy: 'x-api-key',
    defaultModel: 'claude-3-5-haiku-latest',
    models: [
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
      { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' }
    ]
  },
  groq: {
    providerId: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    authStrategy: 'bearer',
    defaultModel: 'llama-3.1-8b-instant',
    models: [
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32k' }
    ]
  }
}

export const PROVIDER_IDS = Object.keys(PROVIDER_CATALOG) as ProviderId[]

export const isProviderId = (value: string): value is ProviderId => {
  return PROVIDER_IDS.includes(value as ProviderId)
}

export const getProviderById = (providerId: ProviderId): ProviderCatalogEntry => {
  return PROVIDER_CATALOG[providerId]
}

export const getDefaultModel = (providerId: ProviderId): string => {
  return PROVIDER_CATALOG[providerId].defaultModel
}

export const isModelAllowed = (providerId: ProviderId, modelId: string): boolean => {
  return PROVIDER_CATALOG[providerId].models.some(model => model.id === modelId)
}
