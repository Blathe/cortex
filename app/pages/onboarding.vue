<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { ProviderId } from '~/types/cortex'

const { catalog, loadProviders, setActive, saveCredential, validateConnection, getProviderById } = useCortexProviders()
const { saveToken } = useCortexAuth()

const currentStep = ref<number>(0)
const isDone = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const ONBOARDING_STATE_KEY = 'cortex.onboarding.state.v2'
const ONBOARDED_CACHE_KEY = 'cortex.onboarded'
const MAX_STEP = 4

// Step 1 — Authentication
const tokenMode = ref<'generate' | 'paste'>('generate')
const setupSecret = ref('')
const pastedToken = ref('')
const generatedToken = ref('')

// Step 2 — LLM Provider
const providerForm = reactive({
  providerId: 'openai' as ProviderId,
  modelId: 'gpt-4o-mini',
  apiKey: ''
})

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
  { title: 'Authentication', description: 'Secure access', icon: 'i-lucide-key-round' },
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
  tokenMode: 'generate' | 'paste'
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
  tokenMode: tokenMode.value,
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
  return value === 'openai' || value === 'anthropic' || value === 'groq'
}

const providerItems = computed(() =>
  catalog.value.map(provider => ({ label: provider.label, value: provider.providerId }))
)

const selectedProvider = computed(() => getProviderById(providerForm.providerId))

const modelItems = computed(() =>
  (selectedProvider.value?.models ?? []).map(model => ({ label: model.label, value: model.id }))
)

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
    tokenMode.value = parsed.tokenMode === 'paste' ? 'paste' : 'generate'
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
  } catch {
    currentStep.value = 1
  }
}

const authenticateSession = async () => {
  if (tokenMode.value === 'paste') {
    const token = pastedToken.value.trim()
    if (!token) {
      throw new Error('Paste your existing token to continue.')
    }
    await saveToken(token)
    return
  }

  const headers: Record<string, string> = {}
  const secret = setupSecret.value.trim()
  if (secret) {
    headers['x-cortex-setup-secret'] = secret
  }

  const res = await $fetch<{ token: string }>('/api/agent/auth/generate', {
    method: 'POST',
    headers
  })
  generatedToken.value = res.token
}

const goNext = async () => {
  error.value = null
  isLoading.value = true
  try {
    if (currentStep.value === 1) {
      await authenticateSession()
      await loadProviders()
      applyProviderDefaults()
    } else if (currentStep.value === 2) {
      const apiKey = providerForm.apiKey.trim()
      await validateConnection(providerForm.providerId, providerForm.modelId, apiKey || undefined)

      if (apiKey) {
        await saveCredential(providerForm.providerId, apiKey)
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
    if (currentStep.value === 1 && err.statusCode === 401) {
      error.value = 'This server already has a token. Choose "Use existing token", paste it, and continue.'
    } else if (currentStep.value === 1 && err.statusCode === 403) {
      error.value = 'Setup secret is required or invalid. Enter CORTEX_SETUP_SECRET and try again.'
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
                  name="i-lucide-key-round"
                  class="size-4 shrink-0 text-primary"
                />
                Authenticating your session
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

          <!-- Step 1: Authentication -->
          <div v-else-if="currentStep === 1">
            <h2 class="mb-2 text-xl font-semibold text-highlighted">
              Authentication
            </h2>
            <p class="mb-4 text-sm text-muted">
              Protected setup endpoints require authentication before configuration changes can be saved.
            </p>

            <div class="mb-4 flex gap-2">
              <UButton
                :variant="tokenMode === 'generate' ? 'solid' : 'outline'"
                color="neutral"
                @click="tokenMode = 'generate'"
              >
                Generate token
              </UButton>
              <UButton
                :variant="tokenMode === 'paste' ? 'solid' : 'outline'"
                color="neutral"
                @click="tokenMode = 'paste'"
              >
                Use existing token
              </UButton>
            </div>

            <div
              v-if="tokenMode === 'generate'"
              class="space-y-4"
            >
              <UFormField
                label="Setup Secret"
                description="If CORTEX_SETUP_SECRET is configured on the server, enter it here."
                hint="Optional when no setup secret is configured"
              >
                <UInput
                  v-model="setupSecret"
                  type="password"
                  placeholder="Paste setup secret"
                  class="w-full"
                />
              </UFormField>

              <p class="text-xs text-muted">
                If token generation returns unauthorized, switch to "Use existing token" and paste the current token.
              </p>

              <div
                v-if="generatedToken"
                class="rounded-md bg-elevated p-3"
              >
                <p class="mb-1 text-xs text-muted">
                  Generated token:
                </p>
                <code class="break-all text-sm text-highlighted">{{ generatedToken }}</code>
              </div>
            </div>

            <div
              v-else
              class="space-y-4"
            >
              <UFormField
                label="Existing Token"
                description="Paste an existing token to establish a browser session."
              >
                <UInput
                  v-model="pastedToken"
                  type="password"
                  placeholder="Paste token"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <!-- Step 2: LLM Provider -->
          <div v-else-if="currentStep === 2">
            <h2 class="mb-2 text-xl font-semibold text-highlighted">
              LLM Provider
            </h2>
            <p class="mb-6 text-sm text-muted">
              Select a provider and model from the supported catalog. Base URLs are managed automatically.
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
              <UFormField label="Model">
                <USelect
                  v-model="providerForm.modelId"
                  :items="modelItems"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="API Key">
                <UInput
                  v-model="providerForm.apiKey"
                  type="password"
                  placeholder="sk-..."
                  class="w-full"
                />
              </UFormField>
              <p class="text-xs text-muted">
                Selected provider endpoint:
                <code>{{ selectedProvider?.baseUrl || 'unavailable' }}</code>
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
