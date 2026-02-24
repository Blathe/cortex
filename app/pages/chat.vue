<script setup lang="ts">
const {
  messages,
  prompt,
  status,
  lastError,
  sendPrompt,
  stopResponse,
  retryLastResponse
} = useCortexChat()
const { config, loadConfig } = useCortexConfig()

const isLiveMode = computed(() => {
  return config.value.provider.toLowerCase().replace(/\s+/g, '') === 'openai' && Boolean(config.value.apiKey.trim())
})

const submitPrompt = async () => {
  const didSend = await sendPrompt(prompt.value)

  if (didSend) {
    prompt.value = ''
  }
}

const onSubmitPrompt = (event: Event) => {
  event.preventDefault()
  void submitPrompt()
}

const onRetryLastResponse = () => {
  void retryLastResponse()
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <UContainer class="py-6 md:py-8">
    <div class="flex h-[calc(100dvh-9rem)] min-h-[32rem] flex-col gap-4">
      <div class="flex items-start justify-between gap-4">
        <UBadge
          :label="isLiveMode ? 'Mode: Live OpenAI' : 'Mode: Mock'"
          :color="isLiveMode ? 'success' : 'warning'"
          variant="subtle"
          class="mt-1"
        />
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-default bg-default">
        <UChatMessages
          :messages="messages"
          :status="status"
          :assistant="{ variant: 'outline', avatar: { src: '/cortex_avatar.png' } }"
          should-auto-scroll
          :spacing-offset="104"
          class="min-h-0 flex-1 p-4"
        />

        <div class="border-t border-default p-3 md:p-4">
          <UAlert
            v-if="status === 'error'"
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            title="Assistant response failed."
            :description="lastError || 'Check provider, model, and API key, then use reload to retry.'"
            class="mb-3"
          />

          <UChatPrompt
            v-model="prompt"
            placeholder="Ask Cortex anything..."
            variant="subtle"
            autofocus
            @submit="onSubmitPrompt"
          >
            <UChatPromptSubmit
              :status="status"
              @stop="stopResponse"
              @reload="onRetryLastResponse"
            />
          </UChatPrompt>
        </div>
      </div>
    </div>
  </UContainer>
</template>
