import type {
  ProviderCatalogEntry,
  ProviderCredentialStatus,
  ProviderId,
  ProviderMigrationWarning,
  ProviderRuntimeState
} from '~/types/cortex'

interface ProvidersGetResponse {
  catalog: ProviderCatalogEntry[]
  credentials: Record<ProviderId, ProviderCredentialStatus>
  active: ProviderRuntimeState | null
  migrationWarnings: ProviderMigrationWarning[]
}

interface ValidateProviderResponse {
  ok: boolean
  mode: 'live' | 'mock'
  message?: string
}

export const useCortexProviders = () => {
  const catalog = useState<ProviderCatalogEntry[]>('cortex.providers.catalog', () => [])
  const credentials = useState<Record<ProviderId, ProviderCredentialStatus>>('cortex.providers.credentials', () => ({
    openai: { configured: false, tokenPreview: null },
    anthropic: { configured: false, tokenPreview: null },
    groq: { configured: false, tokenPreview: null }
  }))
  const active = useState<ProviderRuntimeState | null>('cortex.providers.active', () => null)
  const migrationWarnings = useState<ProviderMigrationWarning[]>('cortex.providers.warnings', () => [])
  const loaded = useState<boolean>('cortex.providers.loaded', () => false)

  const loadProviders = async () => {
    const res = await $fetch<ProvidersGetResponse>('/api/agent/providers')
    catalog.value = res.catalog
    credentials.value = res.credentials
    active.value = res.active
    migrationWarnings.value = res.migrationWarnings
    loaded.value = true
  }

  const setActive = async (providerId: ProviderId, modelId: string) => {
    const res = await $fetch<{ ok: boolean, active: ProviderRuntimeState }>('/api/agent/providers/active', {
      method: 'POST',
      body: { providerId, modelId }
    })
    active.value = res.active
    return res.active
  }

  const saveCredential = async (providerId: ProviderId, apiKey: string) => {
    const res = await $fetch<{ ok: boolean, providerId: ProviderId, configured: boolean, tokenPreview: string | null }>('/api/agent/providers/credentials', {
      method: 'POST',
      body: { providerId, apiKey }
    })

    credentials.value = {
      ...credentials.value,
      [providerId]: { configured: res.configured, tokenPreview: res.tokenPreview }
    }

    return res
  }

  const validateConnection = async (providerId: ProviderId, modelId: string, apiKey?: string) => {
    return $fetch<ValidateProviderResponse>('/api/agent/providers/validate', {
      method: 'POST',
      body: { providerId, modelId, ...(apiKey !== undefined ? { apiKey } : {}) }
    })
  }

  const getProviderById = (providerId: ProviderId) => {
    return catalog.value.find(provider => provider.providerId === providerId)
  }

  const getModelLabel = (providerId: ProviderId, modelId: string) => {
    const provider = getProviderById(providerId)
    return provider?.models.find(model => model.id === modelId)?.label ?? modelId
  }

  const isLiveMode = computed(() => {
    if (!active.value) {
      return false
    }
    return credentials.value[active.value.providerId]?.configured === true
  })

  return {
    catalog,
    credentials,
    active,
    migrationWarnings,
    loaded,
    isLiveMode,
    loadProviders,
    setActive,
    saveCredential,
    validateConnection,
    getProviderById,
    getModelLabel
  }
}
