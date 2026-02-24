import type { CortexProvider } from '~/types/cortex'

// Input type for create/update — apiKey is the real secret (sent to server once, never stored client-side)
export interface ProviderInput {
  name: string
  baseUrl: string
  apiKey?: string
  models: string[]
}

interface ProvidersGetResponse {
  providers: CortexProvider[]
  activeId: string | null
}

interface ProviderPostResponse {
  ok: boolean
  id: string
}

export const useCortexProviders = () => {
  const providers = useState<CortexProvider[]>('cortex.providers', () => [])
  const activeProviderId = useState<string | null>('cortex.providers.active', () => null)

  const { authHeaders } = useCortexAuth()

  const loadProviders = async () => {
    const res = await $fetch<ProvidersGetResponse>('/api/agent/providers', {
      headers: authHeaders.value
    })
    providers.value = res.providers
    activeProviderId.value = res.activeId
  }

  const addProvider = async (input: ProviderInput) => {
    const res = await $fetch<ProviderPostResponse>('/api/agent/providers', {
      method: 'POST',
      headers: authHeaders.value,
      body: input
    })
    await loadProviders()
    return res.id
  }

  const updateProvider = async (id: string, patch: Partial<ProviderInput>) => {
    await $fetch('/api/agent/providers', {
      method: 'POST',
      headers: authHeaders.value,
      body: { id, ...patch }
    })
    await loadProviders()
  }

  const deleteProvider = async (id: string) => {
    await $fetch(`/api/agent/providers/${id}`, {
      method: 'DELETE',
      headers: authHeaders.value
    })
    providers.value = providers.value.filter(p => p.id !== id)
    if (activeProviderId.value === id) {
      activeProviderId.value = providers.value[0]?.id ?? null
    }
  }

  const setActive = async (id: string) => {
    const provider = providers.value.find(p => p.id === id)
    if (!provider) return

    await $fetch('/api/agent/providers', {
      method: 'POST',
      headers: authHeaders.value,
      body: { id, name: provider.name, baseUrl: provider.baseUrl, models: provider.models, setActive: true }
    })

    activeProviderId.value = id

    const { saveConfig, config } = useCortexConfig()
    saveConfig({
      provider: provider.name,
      model: config.value.model,
      baseUrl: provider.baseUrl,
      apiKeySet: provider.apiKeySet
    })
  }

  return {
    providers,
    activeProviderId,
    loadProviders,
    addProvider,
    updateProvider,
    deleteProvider,
    setActive
  }
}
