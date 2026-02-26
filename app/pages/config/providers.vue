<script setup lang="ts">
import type { ProviderId, ProviderModelEntry } from '~/types/cortex'

const {
  catalog,
  credentials,
  active,
  migrationWarnings,
  loadProviders,
  setActive,
  saveCredential,
  validateConnection,
  fetchOllamaModels,
  getProviderById
} = useCortexProviders()
const toast = useToast()

const runtimeSelection = reactive({
  providerId: 'openai' as ProviderId,
  modelId: 'gpt-4o-mini'
})

const credentialDrafts = reactive<Record<string, string>>({})
const runtimeSaving = ref(false)
const runtimeTesting = ref(false)
const providerSaving = reactive<Record<string, boolean>>({})
const providerTesting = reactive<Record<string, boolean>>({})

const ollamaModels = ref<ProviderModelEntry[]>([])
const ollamaStatus = ref<'unknown' | 'checking' | 'ok' | 'error'>('unknown')
const ollamaError = ref<string | null>(null)

const providerItems = computed(() =>
  catalog.value.map(provider => ({ label: provider.label, value: provider.providerId }))
)

const runtimeProvider = computed(() => getProviderById(runtimeSelection.providerId))

const isOllamaRuntime = computed(() => runtimeSelection.providerId === 'ollama')

const modelItems = computed(() => {
  const provider = runtimeProvider.value
  if (!provider) return []
  if (provider.authStrategy === 'none') {
    return ollamaModels.value.map(m => ({ label: m.label, value: m.id }))
  }
  return provider.models.map(model => ({ label: model.label, value: model.id }))
})

const activeProviderLabel = computed(() => {
  if (!active.value) return 'not set'
  return getProviderById(active.value.providerId)?.label ?? active.value.providerId
})

const probeOllama = async () => {
  ollamaStatus.value = 'checking'
  ollamaError.value = null
  try {
    const models = await fetchOllamaModels()
    ollamaModels.value = models
    ollamaStatus.value = 'ok'
    if (runtimeSelection.providerId === 'ollama') {
      if (models.length && !models.some(m => m.id === runtimeSelection.modelId)) {
        runtimeSelection.modelId = models[0]?.id ?? ''
      }
    }
  } catch (e) {
    const err = e as { statusMessage?: string, message?: string }
    ollamaStatus.value = 'error'
    ollamaError.value = err.statusMessage ?? err.message ?? 'Ollama is not reachable.'
  }
}

const ensureRuntimeSelection = () => {
  const first = catalog.value[0]
  if (!first) {
    return
  }

  if (active.value) {
    runtimeSelection.providerId = active.value.providerId
    runtimeSelection.modelId = active.value.modelId
  }

  const provider = getProviderById(runtimeSelection.providerId) ?? first
  runtimeSelection.providerId = provider.providerId
  if (provider.authStrategy !== 'none' && !provider.models.some(model => model.id === runtimeSelection.modelId)) {
    runtimeSelection.modelId = provider.defaultModel
  }
}

const onRuntimeProviderChanged = () => {
  const provider = getProviderById(runtimeSelection.providerId)
  if (!provider) return

  if (provider.authStrategy === 'none') {
    probeOllama()
    return
  }

  if (!provider.models.some(model => model.id === runtimeSelection.modelId)) {
    runtimeSelection.modelId = provider.defaultModel
  }
}

const onSaveRuntime = async () => {
  runtimeSaving.value = true
  try {
    await setActive(runtimeSelection.providerId, runtimeSelection.modelId)
    toast.add({ title: 'Runtime updated', color: 'success' })
  } catch (error) {
    const err = error as { statusMessage?: string }
    toast.add({
      title: 'Failed to update runtime',
      description: err.statusMessage ?? 'Unknown error',
      color: 'error'
    })
  } finally {
    runtimeSaving.value = false
  }
}

const onTestRuntime = async () => {
  if (isOllamaRuntime.value) {
    await probeOllama()
    if (ollamaStatus.value === 'ok') {
      toast.add({ title: 'Ollama is running', color: 'success' })
    } else {
      toast.add({
        title: 'Ollama unreachable',
        description: ollamaError.value ?? 'Start Ollama with: ollama serve',
        color: 'error'
      })
    }
    return
  }

  runtimeTesting.value = true
  try {
    const result = await validateConnection(runtimeSelection.providerId, runtimeSelection.modelId)
    if (result.mode === 'mock') {
      toast.add({
        title: 'Runtime is in mock mode',
        description: result.message ?? 'No API key configured for this provider.',
        color: 'warning'
      })
    } else {
      toast.add({ title: 'Runtime connection successful', color: 'success' })
    }
  } catch (error) {
    const err = error as { statusMessage?: string }
    toast.add({
      title: 'Runtime validation failed',
      description: err.statusMessage ?? 'Unknown error',
      color: 'error'
    })
  } finally {
    runtimeTesting.value = false
  }
}

const onSaveCredential = async (providerId: ProviderId) => {
  providerSaving[providerId] = true
  try {
    const apiKey = credentialDrafts[providerId] ?? ''
    const result = await saveCredential(providerId, apiKey)
    toast.add({
      title: `${getProviderById(providerId)?.label ?? providerId} key ${result.configured ? 'saved' : 'cleared'}`,
      color: 'success'
    })
  } catch (error) {
    const err = error as { statusMessage?: string }
    toast.add({
      title: 'Failed to save credential',
      description: err.statusMessage ?? 'Unknown error',
      color: 'error'
    })
  } finally {
    providerSaving[providerId] = false
  }
}

const onRemoveCredential = async (providerId: ProviderId) => {
  providerSaving[providerId] = true
  try {
    await saveCredential(providerId, '')
    credentialDrafts[providerId] = ''
    toast.add({
      title: `${getProviderById(providerId)?.label ?? providerId} token removed`,
      color: 'success'
    })
  } catch (error) {
    const err = error as { statusMessage?: string }
    toast.add({
      title: 'Failed to remove token',
      description: err.statusMessage ?? 'Unknown error',
      color: 'error'
    })
  } finally {
    providerSaving[providerId] = false
  }
}

const onTestProvider = async (providerId: ProviderId) => {
  const provider = getProviderById(providerId)
  if (!provider) return

  if (provider.authStrategy === 'none') {
    await probeOllama()
    if (ollamaStatus.value === 'ok') {
      toast.add({ title: 'Ollama is running', color: 'success' })
    } else {
      toast.add({
        title: 'Ollama unreachable',
        description: ollamaError.value ?? 'Start Ollama with: ollama serve',
        color: 'error'
      })
    }
    return
  }

  providerTesting[providerId] = true
  try {
    const modelId = provider.defaultModel
    const draftKey = (credentialDrafts[providerId] ?? '').trim()
    const result = await validateConnection(providerId, modelId, draftKey || undefined)
    if (result.mode === 'mock') {
      toast.add({
        title: `${provider.label} is in mock mode`,
        description: result.message ?? 'No API key configured.',
        color: 'warning'
      })
    } else {
      toast.add({ title: `${provider.label} connection successful`, color: 'success' })
    }
  } catch (error) {
    const err = error as { statusMessage?: string, message?: string }
    toast.add({
      title: 'Connection test failed',
      description: err.statusMessage ?? err.message ?? 'Unknown error',
      color: 'error'
    })
  } finally {
    providerTesting[providerId] = false
  }
}

onMounted(async () => {
  try {
    await loadProviders()
    ensureRuntimeSelection()

    if (runtimeSelection.providerId === 'ollama') {
      await probeOllama()
    }

    for (const provider of catalog.value) {
      credentialDrafts[provider.providerId] = ''
      providerSaving[provider.providerId] = false
      providerTesting[provider.providerId] = false
    }
  } catch {
    toast.add({
      title: 'Failed to load providers',
      description: 'Refresh the page or re-authenticate and try again.',
      color: 'error'
    })
  }
})
</script>

<template>
  <UContainer class="py-6 md:py-8">
    <div class="space-y-6">
      <PageHeader
        title="Providers"
        description="Choose the active provider/model runtime and manage provider credentials."
      />

      <UAlert
        v-if="migrationWarnings.length"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        title="Legacy provider entries were disabled during migration"
      >
        <template #description>
          <ul class="space-y-1 text-xs">
            <li
              v-for="warning in migrationWarnings"
              :key="warning.legacyId"
            >
              <strong>{{ warning.legacyName }}:</strong> {{ warning.reason }}
            </li>
          </ul>
        </template>
      </UAlert>

      <UCard>
        <template #header>
          <div class="space-y-1">
            <p class="text-sm font-medium text-highlighted">
              Active Runtime
            </p>
            <p class="text-xs text-muted">
              Chat requests resolve provider and model server-side from this selection.
            </p>
          </div>
        </template>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField label="Provider">
            <USelect
              v-model="runtimeSelection.providerId"
              :items="providerItems"
              value-key="value"
              @update:model-value="onRuntimeProviderChanged"
            />
          </UFormField>

          <UFormField label="Model">
            <USelect
              v-model="runtimeSelection.modelId"
              :items="modelItems"
              value-key="value"
              :disabled="isOllamaRuntime && ollamaStatus !== 'ok'"
            />
          </UFormField>
        </div>

        <div
          v-if="isOllamaRuntime"
          class="mt-3"
        >
          <div
            v-if="ollamaStatus === 'error'"
            class="text-xs text-error"
          >
            {{ ollamaError ?? 'Ollama unreachable. Start with: ollama serve' }}
          </div>
          <div
            v-else-if="ollamaStatus === 'ok' && modelItems.length === 0"
            class="text-xs text-warning"
          >
            No models installed. Run <code>ollama pull &lt;model&gt;</code> to add one.
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-muted">
            Current active runtime:
            <span class="font-medium text-highlighted">{{ activeProviderLabel }}</span>
            <span class="text-highlighted"> / {{ active?.modelId || 'not set' }}</span>
          </p>

          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="outline"
              :loading="runtimeTesting || (isOllamaRuntime && ollamaStatus === 'checking')"
              @click="onTestRuntime"
            >
              {{ isOllamaRuntime ? 'Check Ollama' : 'Test connection' }}
            </UButton>
            <UButton
              :loading="runtimeSaving"
              @click="onSaveRuntime"
            >
              Save runtime
            </UButton>
          </div>
        </div>
      </UCard>

      <div class="grid gap-4 md:grid-cols-3">
        <UCard
          v-for="provider in catalog"
          :key="provider.providerId"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-highlighted">
                {{ provider.label }}
              </p>
              <UBadge
                v-if="provider.authStrategy === 'none'"
                label="local"
                color="success"
                variant="subtle"
                size="xs"
              />
              <UBadge
                v-else
                :label="credentials[provider.providerId]?.configured ? 'key set' : 'mock mode'"
                :color="credentials[provider.providerId]?.configured ? 'success' : 'warning'"
                variant="subtle"
                size="xs"
              />
            </div>
          </template>

          <div class="space-y-3">
            <p class="text-xs text-muted">
              Endpoint: <code>{{ provider.baseUrl }}</code>
            </p>

            <!-- Keyless provider (Ollama) -->
            <template v-if="provider.authStrategy === 'none'">
              <p class="text-xs text-muted">
                No API key required. Models are managed locally via <code>ollama pull</code>.
              </p>
              <div
                v-if="ollamaStatus === 'ok'"
                class="text-xs text-muted"
              >
                <span class="font-medium text-highlighted">{{ ollamaModels.length }}</span>
                model{{ ollamaModels.length === 1 ? '' : 's' }} installed
              </div>
              <div
                v-else-if="ollamaStatus === 'error'"
                class="text-xs text-error"
              >
                {{ ollamaError ?? 'Not reachable' }}
              </div>
            </template>

            <!-- Key-based provider -->
            <template v-else>
              <UFormField
                v-if="!credentials[provider.providerId]?.configured"
                label="API Key"
              >
                <UInput
                  v-model="credentialDrafts[provider.providerId]"
                  type="password"
                  placeholder="Paste key to link provider"
                  autocomplete="off"
                />
              </UFormField>

              <div
                v-else
                class="space-y-1 text-xs text-muted"
              >
                <p>
                  Token: <code>{{ credentials[provider.providerId]?.tokenPreview || 'set' }}</code>
                </p>
                <p>
                  Remove token to unlink this provider.
                </p>
              </div>
            </template>

            <div class="flex gap-2">
              <template v-if="provider.authStrategy === 'none'">
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-refresh-cw"
                  :loading="ollamaStatus === 'checking'"
                  @click="onTestProvider(provider.providerId)"
                >
                  Check Ollama
                </UButton>
              </template>
              <template v-else>
                <UButton
                  v-if="!credentials[provider.providerId]?.configured"
                  size="sm"
                  :loading="providerSaving[provider.providerId]"
                  @click="onSaveCredential(provider.providerId)"
                >
                  Save key
                </UButton>
                <UButton
                  v-else
                  size="sm"
                  color="error"
                  variant="outline"
                  :loading="providerSaving[provider.providerId]"
                  @click="onRemoveCredential(provider.providerId)"
                >
                  Remove token
                </UButton>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :loading="providerTesting[provider.providerId]"
                  @click="onTestProvider(provider.providerId)"
                >
                  Test
                </UButton>
              </template>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>
