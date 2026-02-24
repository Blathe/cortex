import type { CortexProvider } from '~/types/cortex'

const STORAGE_KEY = 'cortex.providers.v1'
const ACTIVE_KEY = 'cortex.providers.active'

const defaultProvider = (): CortexProvider => ({
  id: 'openai-default',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
})

const sanitizeProvider = (p: unknown): CortexProvider | null => {
  const maybe = p as Partial<CortexProvider> | null
  if (!maybe || typeof maybe !== 'object') return null
  if (typeof maybe.id !== 'string' || !maybe.id) return null
  return {
    id: maybe.id,
    name: typeof maybe.name === 'string' ? maybe.name : '',
    baseUrl: typeof maybe.baseUrl === 'string' ? maybe.baseUrl : '',
    apiKey: typeof maybe.apiKey === 'string' ? maybe.apiKey : '',
    models: Array.isArray(maybe.models) ? maybe.models.filter(m => typeof m === 'string') : []
  }
}

export const useCortexProviders = () => {
  const providers = useState<CortexProvider[]>('cortex.providers', () => [defaultProvider()])
  const activeProviderId = useState<string | null>('cortex.providers.active', () => null)

  const loadProviders = () => {
    if (!import.meta.client) return

    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const valid = parsed.map(sanitizeProvider).filter((p): p is CortexProvider => p !== null)
          providers.value = valid.length ? valid : [defaultProvider()]
        }
      } catch {
        providers.value = [defaultProvider()]
      }
    }

    const activeRaw = localStorage.getItem(ACTIVE_KEY)
    if (activeRaw && providers.value.some(p => p.id === activeRaw)) {
      activeProviderId.value = activeRaw
    } else {
      activeProviderId.value = null
    }
  }

  const saveProviders = () => {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(providers.value))
    if (activeProviderId.value !== null) {
      localStorage.setItem(ACTIVE_KEY, activeProviderId.value)
    } else {
      localStorage.removeItem(ACTIVE_KEY)
    }
  }

  const addProvider = (p: Omit<CortexProvider, 'id'>) => {
    const id = `provider-${Date.now()}`
    providers.value = [...providers.value, { ...p, id }]
    saveProviders()
    return id
  }

  const updateProvider = (id: string, patch: Partial<Omit<CortexProvider, 'id'>>) => {
    providers.value = providers.value.map(p => p.id === id ? { ...p, ...patch } : p)
    saveProviders()
  }

  const deleteProvider = (id: string) => {
    providers.value = providers.value.filter(p => p.id !== id)
    if (activeProviderId.value === id) {
      activeProviderId.value = null
    }
    saveProviders()
  }

  const setActive = (id: string) => {
    const provider = providers.value.find(p => p.id === id)
    if (!provider) return

    activeProviderId.value = id
    saveProviders()

    const { saveConfig, config } = useCortexConfig()
    saveConfig({
      provider: provider.name,
      model: config.value.model,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey
    })
  }

  return {
    providers,
    activeProviderId,
    loadProviders,
    saveProviders,
    addProvider,
    updateProvider,
    deleteProvider,
    setActive
  }
}
