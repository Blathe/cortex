<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { ProviderId, ProviderModelEntry } from '~/types/cortex'

definePageMeta({ layout: false })

const { catalog, loadProviders, setActive, saveCredential, validateConnection, fetchOllamaModels, getProviderById } = useCortexProviders()

const currentStep = ref<number>(0)
const isDone = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const ONBOARDING_STATE_KEY = 'cortex.onboarding.state.v2'
const ONBOARDED_CACHE_KEY = 'cortex.onboarded'
const MAX_STEP = 4

// Step 1 — PIN setup
const pinValue = ref('')
const pinConfirm = ref('')
const recoveryCode = ref<string | null>(null)
const recoveryAcknowledged = ref(false)
const sessionTtlSeconds = ref(60 * 60 * 8) // default 8h

const sessionTtlOptions = [
  { label: '1 hour', value: 60 * 60 },
  { label: '8 hours (default)', value: 60 * 60 * 8 },
  { label: '24 hours', value: 60 * 60 * 24 },
  { label: '7 days', value: 60 * 60 * 24 * 7 }
]

// Step 2 — LLM Provider
const providerForm = reactive({
  providerId: 'openai' as ProviderId,
  modelId: 'gpt-4o-mini',
  apiKey: ''
})

// Step 2 — Ollama state
const ollamaModels = ref<ProviderModelEntry[]>([])
const ollamaStatus = ref<'unknown' | 'checking' | 'ok' | 'error'>('unknown')
const ollamaError = ref<string | null>(null)

// Step 3 — GitHub
const githubForm = reactive({
  ghRepo: '',
  ghToken: ''
})

// Step 4 — Persona
const personaForm = reactive({
  name: 'Cortex',
  tone: 'casual',
  verbosity: 'low'
})

const steps = ref<StepperItem[]>([
  { title: 'Welcome', description: 'Introduction', icon: 'i-lucide-sparkles' },
  { title: 'PIN Setup', description: 'Secure access', icon: 'i-lucide-shield-check' },
  { title: 'LLM Provider', description: 'Configure AI provider', icon: 'i-lucide-plug' },
  { title: 'GitHub', description: 'Repository credentials', icon: 'i-lucide-github' },
  { title: 'Persona', description: 'Agent behavior', icon: 'i-lucide-bot' }
])

const toneOptions = [
  { label: 'Casual', value: 'casual' },
  { label: 'Professional', value: 'professional' },
  { label: 'Concise', value: 'concise' },
  { label: 'Verbose', value: 'verbose' }
]

const verbosityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
]

interface OnboardingDraft {
  currentStep: number
  provider: {
    providerId: ProviderId
    modelId: string
  }
  github: {
    ghRepo: string
  }
  persona: {
    name: string
    tone: string
    verbosity: string
  }
}

const clampStep = (value: number) => Math.min(Math.max(value, 0), MAX_STEP)

const buildDraft = (): OnboardingDraft => ({
  currentStep: currentStep.value,
  provider: {
    providerId: providerForm.providerId,
    modelId: providerForm.modelId
  },
  github: {
    ghRepo: githubForm.ghRepo
  },
  persona: {
    name: personaForm.name,
    tone: personaForm.tone,
    verbosity: personaForm.verbosity
  }
})

const persistDraft = () => {
  if (!import.meta.client) return
  sessionStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(buildDraft()))
}

const clearDraft = () => {
  if (!import.meta.client) return
  sessionStorage.removeItem(ONBOARDING_STATE_KEY)
}

const isProviderId = (value: unknown): value is ProviderId => {
  return value === 'openai' || value === 'anthropic' || value === 'groq' || value === 'ollama'
}

const isOllamaSelected = computed(() => providerForm.providerId === 'ollama')

const providerItems = computed(() =>
  catalog.value.map(provider => ({ label: provider.label, value: provider.providerId }))
)

const selectedProvider = computed(() => getProviderById(providerForm.providerId))

const modelItems = computed(() => {
  if (isOllamaSelected.value) {
    return ollamaModels.value.map(model => ({ label: model.label, value: model.id }))
  }
  return (selectedProvider.value?.models ?? []).map(model => ({ label: model.label, value: model.id }))
})

const probeOllama = async () => {
  ollamaStatus.value = 'checking'
  ollamaError.value = null
  try {
    const models = await fetchOllamaModels()
    ollamaModels.value = models
    ollamaStatus.value = 'ok'
    if (models[0] && !providerForm.modelId) {
      providerForm.modelId = models[0].id
    } else if (models[0] && !models.some(m => m.id === providerForm.modelId)) {
      providerForm.modelId = models[0].id
    }
  } catch (e) {
    const err = e as { statusMessage?: string, message?: string }
    ollamaStatus.value = 'error'
    ollamaError.value = err.statusMessage ?? err.message ?? 'Ollama is not reachable.'
  }
}

const applyProviderDefaults = () => {
  const first = catalog.value[0]
  if (!first) {
    return
  }

  const currentProvider = getProviderById(providerForm.providerId)
  if (!currentProvider) {
    providerForm.providerId = first.providerId
  }

  const provider = getProviderById(providerForm.providerId)
  if (!provider) {
    return
  }

  if (provider.authStrategy === 'none') {
    return
  }

  const modelAllowed = provider.models.some(model => model.id === providerForm.modelId)
  if (!modelAllowed) {
    providerForm.modelId = provider.defaultModel
  }
}

const restoreDraft = () => {
  if (!import.meta.client) return
  const raw = sessionStorage.getItem(ONBOARDING_STATE_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>
    currentStep.value = clampStep(Number(parsed.currentStep ?? 0))
    if (isProviderId(parsed.provider?.providerId)) {
      providerForm.providerId = parsed.provider.providerId
    }
    if (typeof parsed.provider?.modelId === 'string' && parsed.provider.modelId.trim()) {
      providerForm.modelId = parsed.provider.modelId.trim()
    }
    githubForm.ghRepo = parsed.github?.ghRepo ?? githubForm.ghRepo
    personaForm.name = parsed.persona?.name ?? personaForm.name
    personaForm.tone = parsed.persona?.tone ?? personaForm.tone
    personaForm.verbosity = parsed.persona?.verbosity ?? personaForm.verbosity
  } catch {
    clearDraft()
  }
}

const normalizeRestoredStep = async () => {
  if (currentStep.value <= 1) return
  try {
    await loadProviders()
    applyProviderDefaults()
    if (isOllamaSelected.value) {
      await probeOllama()
    }
  } catch {
    currentStep.value = 1
  }
}

const setupPin = async () => {
  const pin = pinValue.value.trim()
  const confirm = pinConfirm.value.trim()

  if (!/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be exactly 6 digits.')
  }

  if (pin !== confirm) {
    throw new Error('PINs do not match.')
  }

  // Phase 1 — recovery code not yet shown: generate it client-side and pause for acknowledgement.
  // Nothing is saved to the server yet, so a page refresh at this point is harmless.
  if (!recoveryCode.value) {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    recoveryCode.value = Array.from(bytes).map(b => CHARS[b % CHARS.length]!).join('')
    throw new Error('__recovery_code_shown__')
  }

  // Phase 2 — recovery code shown but not acknowledged: block advance.
  if (!recoveryAcknowledged.value) {
    throw new Error('Please confirm you have saved the recovery code before continuing.')
  }

  // Phase 3 — acknowledged: atomically save PIN + hashed recovery code on the server.
  await $fetch('/api/agent/auth/setup', {
    method: 'POST',
    body: {
      pin,
      confirmPin: confirm,
      recoveryCode: recoveryCode.value,
      sessionTtlSeconds: sessionTtlSeconds.value
    }
  })
}

const goNext = async () => {
  error.value = null
  isLoading.value = true
  try {
    if (currentStep.value === 1) {
      await setupPin()
      await loadProviders()
      applyProviderDefaults()
    } else if (currentStep.value === 2) {
      if (isOllamaSelected.value) {
        await validateConnection(providerForm.providerId, providerForm.modelId)
      } else {
        const apiKey = providerForm.apiKey.trim()
        await validateConnection(providerForm.providerId, providerForm.modelId, apiKey || undefined)
        if (apiKey) {
          await saveCredential(providerForm.providerId, apiKey)
        }
      }
      await setActive(providerForm.providerId, providerForm.modelId)
    } else if (currentStep.value === 3) {
      const vars: { key: string, value: string }[] = []
      if (githubForm.ghRepo.trim()) vars.push({ key: 'GH_REPO', value: githubForm.ghRepo.trim() })
      if (githubForm.ghToken.trim()) vars.push({ key: 'GH_TOKEN', value: githubForm.ghToken.trim() })
      if (vars.length) {
        await $fetch('/api/agent/env', { method: 'POST', body: { vars } })
      }
    } else if (currentStep.value === 4) {
      await finishOnboarding()
    }

    if (currentStep.value < 4) {
      currentStep.value += 1
      persistDraft()
    }
  } catch (e) {
    const err = e as { statusCode?: number, statusMessage?: string, message?: string }
    if (err.message === '__recovery_code_shown__') {
      // Recovery code was just revealed — stay on step 1, no error
    } else if (currentStep.value === 1 && err.statusCode === 409) {
      error.value = 'A PIN is already configured on this server. It may have been set up previously.'
    } else {
      error.value = err.statusMessage ?? err.message ?? 'Something went wrong.'
    }
  } finally {
    isLoading.value = false
  }
}

const finishOnboarding = async () => {
  await $fetch('/api/agent/config', {
    method: 'POST',
    body: {
      patch: {
        persona: {
          name: personaForm.name,
          tone: personaForm.tone,
          verbosity: personaForm.verbosity
        },
        meta: { onboarded: true }
      },
      reason: 'Onboarding complete',
      source: 'user'
    }
  })
  if (import.meta.client) {
    sessionStorage.setItem(ONBOARDED_CACHE_KEY, 'true')
  }
  clearDraft()
  useState<boolean | null>('onboarded').value = true
  isDone.value = true
}

const goBack = () => {
  if (currentStep.value > 0) {
    error.value = null
    currentStep.value -= 1
    persistDraft()
  }
}

watch(() => providerForm.providerId, () => {
  applyProviderDefaults()
  if (isOllamaSelected.value) {
    probeOllama()
  }
})

onMounted(async () => {
  restoreDraft()
  await normalizeRestoredStep()
  if (currentStep.value >= 2 && !catalog.value.length) {
    await loadProviders().catch(() => {})
    applyProviderDefaults()
  }
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-default p-6">
    <div class="w-full max-w-2xl">
      <div class="mb-8 flex items-center gap-3">
        <UIcon
          name="i-lucide-brain-circuit"
          class="size-8 text-primary"
        />
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Cortex
          </p>
          <p class="text-lg font-semibold text-highlighted">
            Agent Console
          </p>
        </div>
      </div>

      <!-- Done screen -->
      <div v-if="isDone">
        <UCard>
          <div class="py-8 text-center">
            <UIcon
              name="i-lucide-circle-check"
              class="mx-auto mb-4 size-16 text-primary"
            />
            <h2 class="mb-2 text-2xl font-bold text-highlighted">
              You're all set!
            </h2>
            <p class="mb-6 text-muted">
              Cortex is configured and ready to use.
            </p>
            <UButton
              to="/chat"
              size="lg"
              icon="i-lucide-messages-square"
            >
              Go to Chat
            </UButton>
          </div>
        </UCard>
      </div>

      <!-- Wizard -->
      <template v-else>
        <UStepper
          v-model="currentStep"
          :items="steps"
          disabled
          color="primary"
          class="mb-8 w-full"
        />

        <UCard>
          <!-- Step 0: Welcome -->
          <div v-if="currentStep === 0">
            <h2 class="mb-2 text-xl font-semibold text-highlighted">
              Welcome to Cortex
            </h2>
            <p class="mb-4 text-muted">
              Let's get you set up. This wizard will walk you through:
            </p>
            <ul class="mb-6 space-y-3 text-sm text-default">
              <li class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-shield-check"
                  class="size-4 shrink-0 text-primary"
                />
                Setting up a PIN for secure access
              </li>
              <li class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-plug"
                  class="size-4 shrink-0 text-primary"
                />
                Connecting an LLM provider
              </li>
              <li class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-github"
                  class="size-4 shrink-0 text-primary"
                />
                Configuring GitHub for autonomous commits
              </li>
              <li class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-bot"
                  class="size-4 shrink-0 text-primary"
                />
                Personalizing the agent's behavior
              </li>
            </ul>
          </div>

          <!-- Step 1: PIN Setup -->
          <div v-else-if="currentStep === 1">
            <!-- Recovery code acknowledgement (shown after successful PIN creation) -->
            <template v-if="recoveryCode">
              <div class="mb-4 flex items-center gap-2">
                <UIcon
                  name="i-lucide-shield-check"
                  class="size-5 shrink-0 text-primary"
                />
                <h2 class="text-xl font-semibold text-highlighted">
                  Save your recovery code
                </h2>
              </div>
              <p class="mb-4 text-sm text-muted">
                If you ever forget your PIN, this code is the only way to regain access.
                It can only be used once and will not be shown again.
              </p>

              <div class="mb-6 rounded-md bg-elevated p-4 text-center">
                <p class="mb-1 text-xs text-muted">
                  Recovery code
                </p>
                <code class="text-xl font-mono font-bold tracking-widest text-highlighted">
                  {{ recoveryCode }}
                </code>
              </div>

              <UCheckbox
                v-model="recoveryAcknowledged"
                label="I have saved this recovery code in a secure place"
              />
            </template>

            <!-- PIN entry form -->
            <template v-else>
              <h2 class="mb-2 text-xl font-semibold text-highlighted">
                Set your PIN
              </h2>
              <p class="mb-4 text-sm text-muted">
                Choose a 6-digit PIN to protect access to Cortex.
              </p>

              <div class="space-y-4">
                <UFormField label="PIN">
                  <UInput
                    v-model="pinValue"
                    type="password"
                    inputmode="numeric"
                    placeholder="••••••"
                    maxlength="6"
                    autocomplete="new-password"
                    class="w-full font-mono tracking-widest"
                  />
                </UFormField>

                <UFormField label="Confirm PIN">
                  <UInput
                    v-model="pinConfirm"
                    type="password"
                    inputmode="numeric"
                    placeholder="••••••"
                    maxlength="6"
                    autocomplete="new-password"
                    class="w-full font-mono tracking-widest"
                  />
                </UFormField>

                <UFormField
                  label="Session timeout"
                  description="How long before you need to re-enter your PIN."
                >
                  <USelect
                    v-model="sessionTtlSeconds"
                    :items="sessionTtlOptions"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </template>
          </div>

          <!-- Step 2: LLM Provider -->
          <div v-else-if="currentStep === 2">
            <h2 class="mb-2 text-xl font-semibold text-highlighted">
              LLM Provider
            </h2>
            <p class="mb-6 text-sm text-muted">
              Select a provider and model. For Ollama, models are pulled locally via <code>ollama pull</code>.
            </p>
            <div class="space-y-4">
              <UFormField label="Provider">
                <USelect
                  v-model="providerForm.providerId"
                  :items="providerItems"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>

              <!-- Ollama status indicator -->
              <div
                v-if="isOllamaSelected"
                class="flex items-center gap-3"
              >
                <UBadge
                  v-if="ollamaStatus === 'checking'"
                  label="Checking..."
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-loader"
                />
                <UBadge
                  v-else-if="ollamaStatus === 'ok'"
                  label="Ollama running"
                  color="success"
                  variant="subtle"
                  icon="i-lucide-circle-check"
                />
                <UBadge
                  v-else-if="ollamaStatus === 'error'"
                  label="Ollama unreachable"
                  color="error"
                  variant="subtle"
                  icon="i-lucide-circle-x"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-refresh-cw"
                  :loading="ollamaStatus === 'checking'"
                  @click="probeOllama"
                >
                  Retry
                </UButton>
              </div>

              <UAlert
                v-if="isOllamaSelected && ollamaStatus === 'error'"
                color="warning"
                variant="subtle"
                icon="i-lucide-terminal"
                title="Ollama is not reachable"
                :description="ollamaError ?? 'Start Ollama with: ollama serve'"
              />

              <UFormField label="Model">
                <USelect
                  v-model="providerForm.modelId"
                  :items="modelItems"
                  value-key="value"
                  :disabled="isOllamaSelected && ollamaStatus !== 'ok'"
                  class="w-full"
                />
                <template
                  v-if="isOllamaSelected && ollamaStatus === 'ok' && modelItems.length === 0"
                  #description
                >
                  <span class="text-warning">No models installed. Run <code>ollama pull &lt;model&gt;</code> first.</span>
                </template>
              </UFormField>

              <UFormField
                v-if="!isOllamaSelected"
                label="API Key"
              >
                <UInput
                  v-model="providerForm.apiKey"
                  type="password"
                  placeholder="sk-..."
                  class="w-full"
                />
              </UFormField>

              <p class="text-xs text-muted">
                <template v-if="isOllamaSelected">
                  Endpoint: <code>{{ selectedProvider?.baseUrl || 'http://localhost:11434' }}</code>
                  — set <code>OLLAMA_HOST</code> to override
                </template>
                <template v-else>
                  Selected provider endpoint: <code>{{ selectedProvider?.baseUrl || 'unavailable' }}</code>
                </template>
              </p>
            </div>
          </div>

          <!-- Step 3: GitHub Setup -->
          <div v-else-if="currentStep === 3">
            <h2 class="mb-2 text-xl font-semibold text-highlighted">
              GitHub Setup
            </h2>
            <p class="mb-4 text-sm text-muted">
              Cortex can autonomously commit configuration changes and open PRs on your behalf.
            </p>
            <UAlert
              color="info"
              variant="subtle"
              icon="i-lucide-shield-check"
              title="Your credentials are safe"
              description="These values are written to .env on the server, which is gitignored and never committed."
              class="mb-6"
            />
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-shield-check"
              title="Ensure your repo is private!"
              description="Your bot's repo should never be exposed to the public."
              class="mb-6"
            />
            <div class="space-y-4">
              <UFormField
                label="Repository"
                description="The repository for this specific bot you are setting up."
                hint="owner/repo format"
              >
                <UInput
                  v-model="githubForm.ghRepo"
                  placeholder="acme/my-repo"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="GitHub Personal Access Token">
                <UInput
                  v-model="githubForm.ghToken"
                  type="password"
                  placeholder="ghp_..."
                  class="w-full"
                />
              </UFormField>
            </div>
            <p class="mt-4 text-xs text-muted">
              Both fields are optional. Skip if you don't need autonomous git operations.
            </p>
          </div>

          <!-- Step 4: Agent Persona -->
          <div v-else-if="currentStep === 4">
            <h2 class="mb-2 text-xl font-semibold text-highlighted">
              Agent Persona
            </h2>
            <p class="mb-6 text-sm text-muted">
              Customize how Cortex presents itself in conversations.
            </p>
            <div class="space-y-4">
              <UFormField label="Agent Name">
                <UInput
                  v-model="personaForm.name"
                  placeholder="Cortex"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Tone">
                <USelect
                  v-model="personaForm.tone"
                  :items="toneOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Verbosity">
                <USelect
                  v-model="personaForm.verbosity"
                  :items="verbosityOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <!-- Error alert -->
          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-x"
            :title="error"
            class="mt-4"
          />

          <template #footer>
            <div class="flex items-center justify-between">
              <UButton
                v-if="currentStep > 0"
                variant="ghost"
                icon="i-lucide-arrow-left"
                type="button"
                :disabled="isLoading"
                @click="goBack"
              >
                Back
              </UButton>
              <span v-else />

              <UButton
                :loading="isLoading"
                :disabled="currentStep === 1 && recoveryCode !== null && !recoveryAcknowledged"
                trailing
                type="button"
                :icon="currentStep === 4 ? 'i-lucide-check' : 'i-lucide-arrow-right'"
                @click="goNext"
              >
                {{ currentStep === 3 ? 'Skip / Next' : currentStep === 4 ? 'Finish' : 'Next' }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </div>
  </div>
</template>
