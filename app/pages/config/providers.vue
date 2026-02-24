<script setup lang="ts">
import type { ProviderId } from '~/types/cortex'

const {
  catalog,
  credentials,
  active,
  migrationWarnings,
  loadProviders,
  setActive,
  saveCredential,
  validateConnection,
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

const providerItems = computed(() =>
  catalog.value.map(provider => ({ label: provider.label, value: provider.providerId }))
)

const runtimeProvider = computed(() => getProviderById(runtimeSelection.providerId))

const modelItems = computed(() =>
  (runtimeProvider.value?.models ?? []).map(model => ({ label: model.label, value: model.id }))
)

const activeProviderLabel = computed(() => {
  if (!active.value) return 'not set'
  return getProviderById(active.value.providerId)?.label ?? active.value.providerId
})

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
  if (!provider.models.some(model => model.id === runtimeSelection.modelId)) {
    runtimeSelection.modelId = provider.defaultModel
  }
}

const onRuntimeProviderChanged = () => {
  const provider = getProviderById(runtimeSelection.providerId)
  if (!provider) return

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

const onTestProvider = async (providerId: ProviderId) => {
  providerTesting[providerId] = true
  try {
    const provider = getProviderById(providerId)
    if (!provider) {
      throw new Error('Provider not found')
    }
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
            />
          </UFormField>
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
              :loading="runtimeTesting"
              @click="onTestRuntime"
            >
              Test connection
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
            <UFormField label="API Key">
              <UInput
                v-model="credentialDrafts[provider.providerId]"
                type="password"
                placeholder="Paste to update, empty to clear"
                autocomplete="off"
              />
            </UFormField>

            <div class="flex gap-2">
              <UButton
                size="sm"
                :loading="providerSaving[provider.providerId]"
                @click="onSaveCredential(provider.providerId)"
              >
                Save key
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
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>
