<script setup lang="ts">
import type { CortexChatMessage } from '~/types/cortex'

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
const toast = useToast()

const isLiveMode = computed(() => {
  return config.value.provider.toLowerCase().replace(/\s+/g, '') === 'openai' && Boolean(config.value.apiKey.trim())
})

const promptError = computed<Error | undefined>(() => {
  return lastError.value ? new Error(lastError.value) : undefined
})

const isSubmitDisabled = computed(() => {
  return status.value === 'ready' && !prompt.value.trim()
})

const getMessageText = (message: CortexChatMessage) => {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text.trim())
    .filter(Boolean)
    .join('\n')
}

const copyMessageText = async (message: CortexChatMessage) => {
  if (!import.meta.client) {
    return
  }

  const text = getMessageText(message)
  if (!text) {
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    toast.add({
      title: 'Message copied',
      description: 'Copied message text to clipboard.',
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Copy failed',
      description: 'Clipboard access was not available.',
      color: 'error'
    })
  }
}

const chatMessages = computed(() => {
  return messages.value.map(message => ({
    ...message,
    actions: [
      {
        label: 'Copy',
        icon: 'i-lucide-copy',
        color: 'neutral' as const,
        variant: 'ghost' as const,
        onClick: () => {
          void copyMessageText(message)
        }
      }
    ]
  }))
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

<template class="flex flex-col">
  <UContainer>
    <UChatMessages
      class="h-full"
      :messages="chatMessages"
      :status="status"
      :assistant="{ avatar: { src: '/cortex_avatar.png' }, variant: 'outline' }"
      should-auto-scroll
    />

    <UChatPrompt
      v-model="prompt"
      variant="soft"
      :placeholder="isLiveMode ? 'Message Cortex' : 'Message Cortex (mock mode)'"
      :error="promptError"
      @submit="onSubmitPrompt"
    >
      <UChatPromptSubmit
        :status="status"
        icon="i-lucide-send"
        :disabled="isSubmitDisabled"
        @stop="stopResponse"
        @reload="onRetryLastResponse"
      />
    </UChatPrompt>
  </UContainer>
</template>
