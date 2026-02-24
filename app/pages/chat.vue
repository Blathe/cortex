<script setup lang="ts">
import type { CortexChatMessage } from '~/types/cortex'

const {
  messages,
  prompt,
  status,
  lastError,
  sendPrompt,
  stopResponse,
  retryLastResponse,
  clearProposal
} = useCortexChat()
const { config, loadConfig } = useCortexConfig()
const toast = useToast()

const isLiveMode = computed(() => {
  return config.value.provider.toLowerCase().replace(/\s+/g, '') === 'openai' && Boolean(config.value.apiKey.trim())
})

const activeModel = computed(() => {
  return config.value.model.trim() || 'not set'
})

const chatRuntimeLabel = computed(() => {
  return `${activeModel.value}`
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

const proposalMessages = computed(() =>
  messages.value.filter(msg => msg.role === 'assistant' && msg.configProposal)
)

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

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Badge: shrink-0, never scrolls -->
    <div class="shrink-0 px-6 pt-4 pb-2">
      <UBadge
        :label="chatRuntimeLabel"
        :color="isLiveMode ? 'success' : 'warning'"
        variant="subtle"
      />
    </div>

    <!-- Messages: flex-1 + min-h-0 so it scrolls, not the page -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <UContainer class="py-4">
        <UChatMessages
          :messages="chatMessages"
          :status="status"
          :assistant="{ avatar: { src: '/cortex_avatar.png', size: '3xl' }, variant: 'outline' }"
          :spacing-offset="176"
          should-auto-scroll
        />
      </UContainer>
    </div>

    <!-- Prompt: shrink-0, always at the bottom of the panel -->
    <div class="shrink-0 py-4">
      <UContainer>
        <div
          v-if="proposalMessages.length"
          class="mb-3 space-y-3"
        >
          <ConfigProposalCard
            v-for="msg in proposalMessages"
            :key="msg.id"
            :message-id="msg.id"
            :proposal="msg.configProposal!"
            @dismiss="clearProposal"
          />
        </div>
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
    </div>
  </div>
</template>
