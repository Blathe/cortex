<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { AgentSettings, CortexConfig } from '~/types/cortex'

type ConfigFormState = Omit<CortexConfig, 'updatedAt'>

const { config, loadConfig, saveConfig, resetConfig } = useCortexConfig()
const { token, saveToken, authHeaders } = useCortexAuth()
const toast = useToast()

// ── LLM runtime config ────────────────────────────────────────────────────────

const state = reactive<ConfigFormState>({
  provider: '',
  model: '',
  baseUrl: '',
  apiKey: ''
})

const lastUpdatedLabel = computed(() => {
  return new Date(config.value.updatedAt).toLocaleString()
})

const apiKeyHelp = computed(() => {
  return state.apiKey
    ? 'Stored locally in this browser for v1.'
    : 'Optional. Leave blank to keep chat in mock mode.'
})

const syncFromConfig = (value: CortexConfig) => {
  state.provider = value.provider
  state.model = value.model
  state.baseUrl = value.baseUrl
  state.apiKey = value.apiKey
}

const validate = (formState: Partial<ConfigFormState>): FormError[] => {
  const errors: FormError[] = []

  if (!formState.provider?.trim()) {
    errors.push({ name: 'provider', message: 'Provider is required.' })
  }

  if (!formState.model?.trim()) {
    errors.push({ name: 'model', message: 'Model is required.' })
  }

  if (!formState.baseUrl?.trim()) {
    errors.push({ name: 'baseUrl', message: 'API base URL is required.' })
  }

  return errors
}

const onSubmit = (event: FormSubmitEvent<ConfigFormState>) => {
  const savedConfig = saveConfig(event.data)
  syncFromConfig(savedConfig)

  toast.add({
    title: 'Configuration saved',
    description: `Updated ${new Date(savedConfig.updatedAt).toLocaleTimeString()}.`,
    color: 'success'
  })
}

const onReset = () => {
  const defaults = resetConfig()
  syncFromConfig(defaults)

  toast.add({
    title: 'Defaults restored',
    description: 'Configuration has been reset.',
    color: 'warning'
  })
}

// ── Security ──────────────────────────────────────────────────────────────────

const tokenGenerating = ref(false)
const showRegenerateWarning = ref(false)

const onGenerateToken = async () => {
  tokenGenerating.value = true
  showRegenerateWarning.value = false
  try {
    const { token: newToken } = await $fetch<{ token: string }>('/api/agent/auth/generate', {
      method: 'POST'
    })
    saveToken(newToken)
    toast.add({ title: 'Token generated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to generate token', color: 'error' })
  } finally {
    tokenGenerating.value = false
  }
}

const onCopyToken = async () => {
  if (!token.value) return
  await navigator.clipboard.writeText(token.value)
  toast.add({ title: 'Token copied to clipboard', color: 'success' })
}

const loadTokenFromServer = async () => {
  try {
    const { token: serverToken } = await $fetch<{ token: string | null }>('/api/agent/auth/token')
    if (serverToken) saveToken(serverToken)
  } catch { /* non-critical */ }
}

// ── Agent behavior settings ───────────────────────────────────────────────────

const agentSettings = ref<AgentSettings | null>(null)
const agentSaving = ref(false)

const agentState = reactive({
  personaName: 'Cortex',
  tone: 'professional',
  verbosity: 'medium',
  temperature: 0.7,
  maxTokens: 2048,
  autoPush: true,
  autoMerge: true
})

const toneItems = [
  { label: 'Professional', value: 'professional' },
  { label: 'Casual', value: 'casual' },
  { label: 'Concise', value: 'concise' },
  { label: 'Verbose', value: 'verbose' }
]

const verbosityItems = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
]

const agentLastUpdatedLabel = computed(() => {
  const s = agentSettings.value
  if (!s) return '—'
  return new Date(s.meta.updatedAt).toLocaleString()
})

const syncFromAgentSettings = (settings: AgentSettings) => {
  agentState.personaName = settings.persona.name
  agentState.tone = settings.persona.tone
  agentState.verbosity = settings.persona.verbosity
  agentState.temperature = settings.reasoning.temperature
  agentState.maxTokens = settings.reasoning.maxTokens
  agentState.autoPush = settings.git.autoPush
  agentState.autoMerge = settings.git.autoMerge
}

const loadAgentSettings = async () => {
  try {
    const { settings } = await $fetch<{ settings: AgentSettings }>('/api/agent/config', {
      headers: authHeaders.value
    })
    agentSettings.value = settings
    syncFromAgentSettings(settings)
  } catch {
    toast.add({ title: 'Could not load agent settings', color: 'error' })
  }
}

const onAgentSubmit = async () => {
  agentSaving.value = true
  try {
    const patch = {
      persona: {
        name: agentState.personaName,
        tone: agentState.tone,
        verbosity: agentState.verbosity
      },
      reasoning: {
        temperature: agentState.temperature,
        maxTokens: agentState.maxTokens
      },
      git: {
        autoPush: agentState.autoPush,
        autoMerge: agentState.autoMerge
      }
    }
    const { settings } = await $fetch<{ settings: AgentSettings }>('/api/agent/config', {
      method: 'POST',
      headers: authHeaders.value,
      body: { patch, reason: 'Updated via config UI', source: 'user' }
    })
    agentSettings.value = settings
    syncFromAgentSettings(settings)
    toast.add({ title: 'Agent settings saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save agent settings', color: 'error' })
  } finally {
    agentSaving.value = false
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(async () => {
  const loadedConfig = loadConfig()
  syncFromConfig(loadedConfig)
  await loadTokenFromServer()
  loadAgentSettings()
})
</script>

<template>
  <UContainer class="py-6 md:py-8">
    <div class="space-y-6">
      <PageHeader
        title="Agent"
        description="Configure LLM provider, model, and agent behavior."
      />

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div class="space-y-6">
          <!-- Agent Behavior Settings -->
          <UCard>
            <template #header>
              <div class="space-y-1">
                <p class="text-sm font-medium text-highlighted">
                  Agent Behavior
                </p>
                <p class="text-xs text-muted">
                  Control the agent's persona, reasoning, and git automation. Changes are committed and PR'd automatically.
                </p>
              </div>
            </template>

            <div class="space-y-6">
              <section class="space-y-4">
                <h3 class="text-sm font-semibold text-highlighted">
                  Persona
                </h3>
                <div class="grid gap-4 md:grid-cols-3">
                  <UFormField
                    label="Name"
                    name="personaName"
                  >
                    <UInput
                      v-model="agentState.personaName"
                      placeholder="Cortex"
                    />
                  </UFormField>

                  <UFormField
                    label="Tone"
                    name="tone"
                  >
                    <USelect
                      v-model="agentState.tone"
                      :items="toneItems"
                      value-key="value"
                    />
                  </UFormField>

                  <UFormField
                    label="Verbosity"
                    name="verbosity"
                  >
                    <USelect
                      v-model="agentState.verbosity"
                      :items="verbosityItems"
                      value-key="value"
                    />
                  </UFormField>
                </div>
              </section>

              <USeparator />

              <section class="space-y-4">
                <h3 class="text-sm font-semibold text-highlighted">
                  Reasoning
                </h3>
                <div class="grid gap-4 md:grid-cols-2">
                  <UFormField
                    label="Temperature"
                    name="temperature"
                    help="Controls randomness. 0 = deterministic, 2 = very random."
                  >
                    <UInput
                      v-model.number="agentState.temperature"
                      type="number"
                      :min="0"
                      :max="2"
                      :step="0.1"
                    />
                  </UFormField>

                  <UFormField
                    label="Max Tokens"
                    name="maxTokens"
                    help="Maximum tokens in each response."
                  >
                    <UInput
                      v-model.number="agentState.maxTokens"
                      type="number"
                      :min="128"
                      :max="16384"
                      :step="128"
                    />
                  </UFormField>
                </div>
              </section>

              <USeparator />

              <section class="space-y-4">
                <h3 class="text-sm font-semibold text-highlighted">
                  Git Automation
                </h3>
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <p class="text-sm font-medium text-highlighted">
                        Auto-push
                      </p>
                      <p class="text-xs text-muted">
                        Commit and push config changes to a new branch automatically.
                      </p>
                    </div>
                    <USwitch v-model="agentState.autoPush" />
                  </div>
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <p class="text-sm font-medium text-highlighted">
                        Auto-merge
                      </p>
                      <p class="text-xs text-muted">
                        Automatically merge low-risk config PRs via the
                        <code>auto-merge</code> label.
                      </p>
                    </div>
                    <USwitch v-model="agentState.autoMerge" />
                  </div>
                </div>
              </section>

              <div class="flex justify-end pt-1">
                <UButton
                  :loading="agentSaving"
                  @click="onAgentSubmit"
                >
                  Save agent settings
                </UButton>
              </div>
            </div>
          </UCard>
          <!-- Security -->
          <UCard>
            <template #header>
              <div class="space-y-1">
                <p class="text-sm font-medium text-highlighted">
                  Security
                </p>
                <p class="text-xs text-muted">
                  Generate a token to authenticate requests to <code>/api/agent/*</code> endpoints. Once set, all requests require this token.
                </p>
              </div>
            </template>

            <div class="space-y-4">
              <UFormField
                label="API Token"
                :help="token ? 'Include this as an Authorization: Bearer header in API requests.' : 'No token generated yet. All agent API endpoints are currently open.'"
              >
                <div class="flex gap-2">
                  <UInput
                    :model-value="token ?? ''"
                    readonly
                    class="flex-1 font-mono text-xs"
                    placeholder="No token generated"
                  />
                  <UButton
                    icon="i-lucide-copy"
                    color="neutral"
                    variant="ghost"
                    aria-label="Copy token"
                    :disabled="!token"
                    @click="onCopyToken"
                  />
                </div>
              </UFormField>

              <UAlert
                v-if="showRegenerateWarning"
                color="warning"
                icon="i-lucide-triangle-alert"
                title="This will invalidate the current token immediately."
                description="Any other sessions or scripts using the old token will stop working."
              />

              <div class="flex justify-end">
                <UButton
                  :loading="tokenGenerating"
                  :color="token ? 'neutral' : 'primary'"
                  :variant="token ? 'outline' : 'solid'"
                  @click="token ? (showRegenerateWarning = true) : onGenerateToken()"
                >
                  {{ token ? 'Regenerate token' : 'Generate token' }}
                </UButton>
                <UButton
                  v-if="showRegenerateWarning"
                  color="error"
                  class="ml-2"
                  :loading="tokenGenerating"
                  @click="onGenerateToken"
                >
                  Confirm regenerate
                </UButton>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Sidebar -->
        <div class="space-y-4">
          <UCard>
            <template #header>
              <p class="text-sm font-medium text-highlighted">
                Current State
              </p>
            </template>

            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">LLM last saved</span>
                <span class="text-xs text-highlighted">{{ lastUpdatedLabel }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">Provider</span>
                <UBadge
                  :label="state.provider || 'unset'"
                  color="neutral"
                  variant="subtle"
                />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">Mode</span>
                <UBadge
                  :label="state.apiKey ? 'Live API' : 'Mock'"
                  :color="state.apiKey ? 'success' : 'warning'"
                  variant="subtle"
                />
              </div>
              <USeparator />
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">Agent last saved</span>
                <span class="text-xs text-highlighted">{{ agentLastUpdatedLabel }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">Persona</span>
                <UBadge
                  :label="agentState.personaName"
                  color="neutral"
                  variant="subtle"
                />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">Tone</span>
                <UBadge
                  :label="agentState.tone"
                  color="neutral"
                  variant="subtle"
                />
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <p class="text-sm font-medium text-highlighted">
                Notes
              </p>
            </template>
            <div class="space-y-2 text-sm text-muted">
              <p>LLM settings are stored in browser local storage.</p>
              <p>Agent behavior settings are written to <code>agent/config/settings.json</code> and committed on save.</p>
              <p>System prompt is loaded from <code>agent/prompts/</code>.</p>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </UContainer>
</template>
