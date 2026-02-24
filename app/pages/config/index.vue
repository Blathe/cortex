<script setup lang="ts">
import type { AgentSettings, CortexConfig } from '~/types/cortex'

type ConfigFormState = Omit<CortexConfig, 'updatedAt'>

const { config, loadConfig } = useCortexConfig()
const toast = useToast()

// ── LLM runtime config ────────────────────────────────────────────────────────

const state = reactive<ConfigFormState>({
  provider: '',
  model: '',
  baseUrl: '',
  apiKeySet: false
})

const lastUpdatedLabel = computed(() => {
  return new Date(config.value.updatedAt).toLocaleString()
})

const syncFromConfig = (value: CortexConfig) => {
  state.provider = value.provider
  state.model = value.model
  state.baseUrl = value.baseUrl
  state.apiKeySet = value.apiKeySet
}

// ── Security ──────────────────────────────────────────────────────────────────

const tokenGenerating = ref(false)
const showRegenerateWarning = ref(false)
const newlyGeneratedToken = ref<string | null>(null)

const onGenerateToken = async () => {
  tokenGenerating.value = true
  showRegenerateWarning.value = false
  newlyGeneratedToken.value = null
  try {
    const { token: newToken } = await $fetch<{ token: string }>('/api/agent/auth/generate', { method: 'POST' })
    // Token is stored in an HttpOnly cookie by the server.
    // Display it once here so the user can copy it for CLI/API use.
    newlyGeneratedToken.value = newToken
    toast.add({ title: 'Token generated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to generate token', color: 'error' })
  } finally {
    tokenGenerating.value = false
  }
}

const onCopyToken = async () => {
  if (!newlyGeneratedToken.value) return
  await navigator.clipboard.writeText(newlyGeneratedToken.value)
  toast.add({ title: 'Token copied to clipboard', color: 'success' })
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
    const { settings } = await $fetch<{ settings: AgentSettings }>('/api/agent/config')
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
              <UAlert
                v-if="newlyGeneratedToken"
                color="success"
                icon="i-lucide-key"
                title="Token generated — copy it now"
                description="This is the only time it will be shown. The server stores it in agent/config/auth.json for CLI/API use."
              >
                <template #description>
                  <p class="mb-2 text-xs">
                    This is shown once. For CLI/API access, also find it in <code>agent/config/auth.json</code>.
                  </p>
                  <div class="flex gap-2">
                    <UInput
                      :model-value="newlyGeneratedToken"
                      readonly
                      class="flex-1 font-mono text-xs"
                    />
                    <UButton
                      icon="i-lucide-copy"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Copy token"
                      @click="onCopyToken"
                    />
                  </div>
                </template>
              </UAlert>

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
                  color="neutral"
                  variant="outline"
                  @click="showRegenerateWarning = true"
                >
                  Generate / rotate token
                </UButton>
                <UButton
                  v-if="showRegenerateWarning"
                  color="error"
                  class="ml-2"
                  :loading="tokenGenerating"
                  @click="onGenerateToken"
                >
                  Confirm
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
                  :label="state.apiKeySet ? 'Live API' : 'Mock'"
                  :color="state.apiKeySet ? 'success' : 'warning'"
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
              <p>Provider credentials are stored server-side in <code>agent/config/providers.json</code> (gitignored).</p>
              <p>Agent behavior settings are written to <code>agent/config/settings.json</code> and committed on save.</p>
              <p>System prompt is loaded from <code>agent/prompts/</code>.</p>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </UContainer>
</template>
