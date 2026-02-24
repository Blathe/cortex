<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { CortexConfig } from '~/types/cortex'

type ConfigFormState = Omit<CortexConfig, 'updatedAt'>

const { config, loadConfig, saveConfig, resetConfig } = useCortexConfig()
const toast = useToast()

const state = reactive<ConfigFormState>({
    provider: '',
    model: '',
    baseUrl: '',
    apiKey: '',
    systemPrompt: ''
})

const lastUpdatedLabel = computed(() => {
    return new Date(config.value.updatedAt).toLocaleString()
})

const apiKeyHelp = computed(() => {
    return state.apiKey
        ? 'Stored locally in this browser for v1. Chat will call OpenAI when provider is set to "openai".'
        : 'Optional. Leave blank to keep chat in mock mode.'
})

const syncFromConfig = (value: CortexConfig) => {
    state.provider = value.provider
    state.model = value.model
    state.baseUrl = value.baseUrl
    state.apiKey = value.apiKey
    state.systemPrompt = value.systemPrompt
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

onMounted(() => {
    const loadedConfig = loadConfig()
    syncFromConfig(loadedConfig)
})
</script>

<template>
    <UContainer class="py-6 md:py-8">
        <div class="space-y-6">

            <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                <UCard>
                    <template #header>
                        <div class="space-y-1">
                            <p class="text-sm font-medium text-highlighted">
                                Core Runtime Settings
                            </p>
                            <p class="text-xs text-muted">
                                Configure provider, model, endpoint, and prompt behavior.
                            </p>
                        </div>
                    </template>

                    <UForm :state="state" :validate="validate" class="space-y-6" @submit="onSubmit">
                        <section class="space-y-4">
                            <h3 class="text-sm font-semibold text-highlighted">
                                Provider and Model
                            </h3>
                            <div class="grid gap-4 md:grid-cols-2">
                                <UFormField name="provider" label="Provider" required>
                                    <UInput v-model="state.provider" placeholder="openai" />
                                </UFormField>

                                <UFormField name="model" label="Model" required>
                                    <UInput v-model="state.model" placeholder="gpt-4o-mini" />
                                </UFormField>
                            </div>

                            <UFormField name="baseUrl" label="API Base URL" required>
                                <UInput v-model="state.baseUrl" placeholder="https://api.openai.com/v1" />
                            </UFormField>
                        </section>

                        <USeparator />

                        <section class="space-y-4">
                            <h3 class="text-sm font-semibold text-highlighted">
                                Credentials and Prompting
                            </h3>
                            <UFormField name="apiKey" label="API Key" hint="Optional" :help="apiKeyHelp">
                                <UInput v-model="state.apiKey" type="password" autocomplete="off"
                                    placeholder="sk-..." />
                            </UFormField>

                            <UFormField name="systemPrompt" label="System Prompt">
                                <UTextarea v-model="state.systemPrompt" :rows="6" autoresize
                                    placeholder="You are Cortex..." />
                            </UFormField>
                        </section>

                        <div class="flex flex-wrap justify-end gap-2 pt-1">
                            <UButton type="button" color="neutral" variant="ghost" @click="onReset">
                                Reset to defaults
                            </UButton>
                            <UButton type="submit">
                                Save configuration
                            </UButton>
                        </div>
                    </UForm>
                </UCard>

                <div class="space-y-4">
                    <UCard>
                        <template #header>
                            <p class="text-sm font-medium text-highlighted">
                                Current State
                            </p>
                        </template>

                        <div class="space-y-3">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-sm text-muted">Last updated</span>
                                <span class="text-xs text-highlighted">{{ lastUpdatedLabel }}</span>
                            </div>
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-sm text-muted">Provider</span>
                                <UBadge :label="state.provider || 'unset'" color="neutral" variant="subtle" />
                            </div>
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-sm text-muted">Mode</span>
                                <UBadge :label="state.apiKey ? 'Live API' : 'Mock'"
                                    :color="state.apiKey ? 'success' : 'warning'" variant="subtle" />
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
                            <p>Changes are stored in browser local storage for this v1 build.</p>
                            <p>Leave API Key empty to keep the chat experience in mock mode.</p>
                            <p>Set provider to <code>openai</code> to enable live completions.</p>
                        </div>
                    </UCard>
                </div>
            </div>
        </div>
    </UContainer>
</template>
