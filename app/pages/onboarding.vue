<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'

const { addProvider, setActive } = useCortexProviders()
const { saveToken, authHeaders } = useCortexAuth()

const currentStep = ref<number>(1)
const isDone = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Step 2 — LLM Provider
const providerForm = reactive({
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o'
})

// Step 3 — API Token
const tokenMode = ref<'generate' | 'paste'>('generate')
const pastedToken = ref('')
const generatedToken = ref('')

// Step 4 — GitHub
const githubForm = reactive({
  ghRepo: '',
  ghToken: ''
})

// Step 5 — Persona
const personaForm = reactive({
  name: 'Cortex',
  tone: 'casual',
  verbosity: 'low'
})

const steps = ref<StepperItem[]>([
  { title: 'Welcome', description: 'Introduction', value: 1, icon: 'i-lucide-sparkles' },
  { title: 'LLM Provider', description: 'Configure AI provider', value: 2, icon: 'i-lucide-plug' },
  { title: 'API Token', description: 'Secure access token', value: 3, icon: 'i-lucide-key' },
  { title: 'GitHub', description: 'Repository credentials', value: 4, icon: 'i-lucide-github' },
  { title: 'Persona', description: 'Agent behavior', value: 5, icon: 'i-lucide-bot' }
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

const handleGenerateToken = async () => {
  isLoading.value = true
  error.value = null
  try {
    const res = await $fetch<{ token: string }>('/api/agent/auth/generate', {
      method: 'POST',
      headers: authHeaders.value
    })
    generatedToken.value = res.token
    saveToken(res.token)
  } catch (e) {
    const err = e as { statusMessage?: string }
    error.value = err.statusMessage ?? 'Failed to generate token.'
  } finally {
    isLoading.value = false
  }
}

const goNext = async () => {
  error.value = null
  isLoading.value = true
  try {
    if (currentStep.value === 2) {
      const id = addProvider({
        name: providerForm.name,
        baseUrl: providerForm.baseUrl,
        apiKey: providerForm.apiKey,
        models: [providerForm.model]
      })
      setActive(id)
    } else if (currentStep.value === 3) {
      if (tokenMode.value === 'paste' && pastedToken.value.trim()) {
        saveToken(pastedToken.value.trim())
      }
    } else if (currentStep.value === 4) {
      const vars: { key: string, value: string }[] = []
      if (githubForm.ghRepo.trim()) vars.push({ key: 'GH_REPO', value: githubForm.ghRepo.trim() })
      if (githubForm.ghToken.trim()) vars.push({ key: 'GH_TOKEN', value: githubForm.ghToken.trim() })
      if (vars.length) {
        await $fetch('/api/env', { method: 'POST', body: { vars } })
      }
    } else if (currentStep.value === 5) {
      await $fetch('/api/agent/config', {
        method: 'POST',
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

    if (currentStep.value < 5) {
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
    body: {
      patch: { meta: { onboarded: true } },
      reason: 'Onboarding complete',
      source: 'user'
    }
  })
  localStorage.setItem('cortex.onboarded', '1')
  isDone.value = true
}

const goBack = () => {
  if (currentStep.value > 1) {
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
          <!-- Step 1: Welcome -->
          <div v-if="currentStep === 1">
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
                  name="i-lucide-key"
                  class="size-4 shrink-0 text-primary"
                />
                Setting up a secure API token
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
            <p class="text-xs text-muted">
              Each step is optional except the LLM provider, which is required for chat.
            </p>
          </div>

          <!-- Step 2: LLM Provider -->
          <div v-else-if="currentStep === 2">
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

          <!-- Step 3: API Token -->
          <div v-else-if="currentStep === 3">
            <h2 class="mb-2 text-xl font-semibold text-highlighted">
              API Token
            </h2>
            <p class="mb-4 text-sm text-muted">
              Cortex uses a bearer token to secure its API. Generate one automatically or paste an existing token.
            </p>
            <div class="mb-6 flex gap-2">
              <UButton
                :variant="tokenMode === 'generate' ? 'solid' : 'outline'"
                size="sm"
                @click="tokenMode = 'generate'"
              >
                Generate
              </UButton>
              <UButton
                :variant="tokenMode === 'paste' ? 'solid' : 'outline'"
                size="sm"
                @click="tokenMode = 'paste'"
              >
                Paste existing
              </UButton>
            </div>
            <div v-if="tokenMode === 'generate'">
              <UButton
                :loading="isLoading"
                icon="i-lucide-refresh-cw"
                @click="handleGenerateToken"
              >
                Generate token
              </UButton>
              <div
                v-if="generatedToken"
                class="mt-4 rounded-md bg-elevated p-3"
              >
                <p class="mb-1 text-xs text-muted">
                  Your token (saved automatically):
                </p>
                <code class="break-all text-sm text-highlighted">{{ generatedToken }}</code>
              </div>
            </div>
            <div v-else>
              <UFormField label="Existing Token">
                <UInput
                  v-model="pastedToken"
                  type="password"
                  placeholder="Paste your token here"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <!-- Step 4: GitHub Setup -->
          <div v-else-if="currentStep === 4">
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
            <div class="space-y-4">
              <UFormField
                label="Repository"
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

          <!-- Step 5: Agent Persona -->
          <div v-else-if="currentStep === 5">
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
                v-if="currentStep > 1"
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
                :icon="currentStep === 5 ? 'i-lucide-check' : 'i-lucide-arrow-right'"
                @click="goNext"
              >
                {{ currentStep === 4 ? 'Skip / Next' : currentStep === 5 ? 'Finish' : 'Next' }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </div>
  </div>
</template>
