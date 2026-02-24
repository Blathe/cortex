<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'

const { addProvider, setActive } = useCortexProviders()
const { saveToken, authHeaders } = useCortexAuth()

// ── Bootstrap (runs before the wizard is shown) ─────────────────────────────
// We call POST /api/agent/auth/generate on mount to silently establish a session.
// If CORTEX_SETUP_SECRET is configured the server returns 403 and we prompt for it.
// If a token exists but the cookie is missing/expired the server returns 401 and
// we fall back to the manual-token login flow.
type BootstrapState = 'loading' | 'ready' | 'setup-secret' | 'login'
const bootstrapState = ref<BootstrapState>('loading')
const bootstrapError = ref<string | null>(null)
const setupSecret = ref('')
const loginToken = ref('')

const tryGenerate = async (secret?: string) => {
  bootstrapError.value = null
  const headers: Record<string, string> = {}
  if (secret) headers['x-cortex-setup-secret'] = secret
  await $fetch('/api/agent/auth/generate', { method: 'POST', headers })
  bootstrapState.value = 'ready'
}

const handleBootstrapSecret = async () => {
  if (!setupSecret.value.trim()) return
  try {
    await tryGenerate(setupSecret.value.trim())
  } catch (e) {
    const err = e as { statusCode?: number, statusMessage?: string }
    bootstrapError.value = err.statusCode === 403
      ? 'Invalid setup secret. Check your CORTEX_SETUP_SECRET environment variable.'
      : (err.statusMessage ?? 'Failed to authenticate.')
  }
}

const handleLogin = async () => {
  if (!loginToken.value.trim()) return
  bootstrapError.value = null
  try {
    await saveToken(loginToken.value.trim())
    bootstrapState.value = 'ready'
  } catch (e) {
    const err = e as { statusMessage?: string }
    bootstrapError.value = err.statusMessage ?? 'Invalid token.'
  }
}

onMounted(async () => {
  try {
    await tryGenerate()
  } catch (e) {
    const err = e as { statusCode?: number }
    if (err.statusCode === 403) {
      bootstrapState.value = 'setup-secret'
    } else if (err.statusCode === 401) {
      bootstrapState.value = 'login'
    } else {
      // Unexpected error — still let the user proceed; API calls will surface the error.
      bootstrapState.value = 'ready'
    }
  }
})

// ── Wizard ───────────────────────────────────────────────────────────────────
const currentStep = ref<number>(0)
const isDone = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Step 1 — LLM Provider
const providerForm = reactive({
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o'
})

// Step 2 — GitHub
const githubForm = reactive({
  ghRepo: '',
  ghToken: ''
})

// Step 3 — Persona
const personaForm = reactive({
  name: 'Cortex',
  tone: 'casual',
  verbosity: 'low'
})

const steps = ref<StepperItem[]>([
  { title: 'Welcome', description: 'Introduction', icon: 'i-lucide-sparkles' },
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

const goNext = async () => {
  error.value = null
  isLoading.value = true
  try {
    if (currentStep.value === 1) {
      const id = await addProvider({
        name: providerForm.name,
        baseUrl: providerForm.baseUrl,
        apiKey: providerForm.apiKey,
        models: [providerForm.model]
      })
      await setActive(id)
    } else if (currentStep.value === 2) {
      const vars: { key: string, value: string }[] = []
      if (githubForm.ghRepo.trim()) vars.push({ key: 'GH_REPO', value: githubForm.ghRepo.trim() })
      if (githubForm.ghToken.trim()) vars.push({ key: 'GH_TOKEN', value: githubForm.ghToken.trim() })
      if (vars.length) {
        await $fetch('/api/agent/env', { method: 'POST', headers: authHeaders.value, body: { vars } })
      }
    } else if (currentStep.value === 3) {
      await $fetch('/api/agent/config', {
        method: 'POST',
        headers: authHeaders.value,
        body: {
          patch: {
            persona: {
              name: personaForm.name,
              tone: personaForm.tone,
              verbosity: personaForm.verbosity
            }
          },
          reason: 'Onboarding: agent persona configured',
          source: 'user'
        }
      })
    }

    if (currentStep.value < 3) {
      currentStep.value += 1
    } else {
      await finishOnboarding()
    }
  } catch (e) {
    const err = e as { statusMessage?: string, message?: string }
    error.value = err.statusMessage ?? err.message ?? 'Something went wrong.'
  } finally {
    isLoading.value = false
  }
}

const finishOnboarding = async () => {
  await $fetch('/api/agent/config', {
    method: 'POST',
    headers: authHeaders.value,
    body: {
      patch: { meta: { onboarded: true } },
      reason: 'Onboarding complete',
      source: 'user'
    }
  })
  useState<boolean | null>('onboarded').value = true
  isDone.value = true
}

const goBack = () => {
  if (currentStep.value > 0) {
    error.value = null
    currentStep.value -= 1
  }
}
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

      <!-- Bootstrap: loading -->
      <div
        v-if="bootstrapState === 'loading'"
        class="flex justify-center py-16"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-8 animate-spin text-muted"
        />
      </div>

      <!-- Bootstrap: setup secret required -->
      <UCard v-else-if="bootstrapState === 'setup-secret'">
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-lock"
              class="size-5 text-primary"
            />
            <h2 class="text-lg font-semibold text-highlighted">
              Setup Secret Required
            </h2>
          </div>
          <p class="text-sm text-muted">
            This server requires a setup secret to generate the first access token.
            Enter the value of <code class="rounded bg-elevated px-1">CORTEX_SETUP_SECRET</code> from your server environment.
          </p>
          <UFormField label="Setup Secret">
            <UInput
              v-model="setupSecret"
              type="password"
              placeholder="Enter setup secret"
              class="w-full"
              @keydown.enter="handleBootstrapSecret"
            />
          </UFormField>
          <UAlert
            v-if="bootstrapError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-x"
            :title="bootstrapError"
          />
        </div>
        <template #footer>
          <UButton
            icon="i-lucide-arrow-right"
            trailing
            @click="handleBootstrapSecret"
          >
            Continue
          </UButton>
        </template>
      </UCard>

      <!-- Bootstrap: login with existing token -->
      <UCard v-else-if="bootstrapState === 'login'">
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-key"
              class="size-5 text-primary"
            />
            <h2 class="text-lg font-semibold text-highlighted">
              Enter Your Access Token
            </h2>
          </div>
          <p class="text-sm text-muted">
            An access token is already configured on this server. Paste it below to authenticate your browser session.
          </p>
          <UFormField label="Access Token">
            <UInput
              v-model="loginToken"
              type="password"
              placeholder="Paste your token"
              class="w-full"
              @keydown.enter="handleLogin"
            />
          </UFormField>
          <UAlert
            v-if="bootstrapError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-x"
            :title="bootstrapError"
          />
        </div>
        <template #footer>
          <UButton
            icon="i-lucide-arrow-right"
            trailing
            @click="handleLogin"
          >
            Continue
          </UButton>
        </template>
      </UCard>

      <!-- Done screen -->
      <div v-else-if="isDone">
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

      <!-- Wizard (bootstrapState === 'ready') -->
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

          <!-- Step 1: LLM Provider -->
          <div v-else-if="currentStep === 1">
            <h2 class="mb-2 text-xl font-semibold text-highlighted">
              LLM Provider
            </h2>
            <p class="mb-6 text-sm text-muted">
              Configure the AI model Cortex will use for chat.
            </p>
            <div class="space-y-4">
              <UFormField label="Provider Name">
                <UInput
                  v-model="providerForm.name"
                  placeholder="e.g. OpenAI"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Base URL">
                <UInput
                  v-model="providerForm.baseUrl"
                  placeholder="https://api.openai.com/v1"
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
              <UFormField label="Default Model">
                <UInput
                  v-model="providerForm.model"
                  placeholder="gpt-4o"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <!-- Step 2: GitHub Setup -->
          <div v-else-if="currentStep === 2">
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

          <!-- Step 3: Agent Persona -->
          <div v-else-if="currentStep === 3">
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
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Verbosity">
                <USelect
                  v-model="personaForm.verbosity"
                  :items="verbosityOptions"
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
                :disabled="isLoading"
                @click="goBack"
              >
                Back
              </UButton>
              <span v-else />

              <UButton
                :loading="isLoading"
                trailing
                :icon="currentStep === 3 ? 'i-lucide-check' : 'i-lucide-arrow-right'"
                @click="goNext"
              >
                {{ currentStep === 2 ? 'Skip / Next' : currentStep === 3 ? 'Finish' : 'Next' }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </div>
  </div>
</template>
