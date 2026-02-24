import type { AgentConfigProposal, ChatStatus, CortexChatMessage, CortexChatRole } from '~/types/cortex'

const INITIAL_MESSAGE = 'Welcome to Cortex. Ask a question to start a mock agent conversation.'

const quickReplies = [
  'I can help you orchestrate tasks, inspect state, and summarize outcomes.',
  'For now this is a mocked assistant response while backend wiring is in progress.',
  'Once the API is connected, I will stream real agent output and tool execution logs.'
]

const createId = () => {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

const buildMessage = (role: CortexChatRole, text: string, configProposal?: AgentConfigProposal): CortexChatMessage => {
  return {
    id: createId(),
    role,
    parts: [{ type: 'text', text }],
    createdAt: new Date().toISOString(),
    ...(configProposal ? { configProposal } : {})
  }
}

interface ChatApiResponse {
  text: string
  configProposal?: AgentConfigProposal
}

const pickReply = (prompt: string): string => {
  const normalized = prompt.toLowerCase()

  if (normalized.includes('job') || normalized.includes('log')) {
    return 'Jobs and logs UI is scaffolded. In v1, responses are mocked and no job runner is attached yet.'
  }

  if (normalized.includes('config') || normalized.includes('model')) {
    return 'Configuration fields are editable and saved locally. Backend config sync is planned for a future PR.'
  }

  return quickReplies[Math.floor(Math.random() * quickReplies.length)]
    ?? quickReplies[0]
    ?? 'Mock response unavailable.'
}

const getFetchErrorMessage = (error: unknown, fallback: string) => {
  const fetchError = error as {
    data?: {
      message?: string
      error?: {
        message?: string
      }
    }
    statusMessage?: string
    message?: string
  }

  return fetchError?.data?.message
    || fetchError?.data?.error?.message
    || fetchError?.statusMessage
    || fetchError?.message
    || fallback
}

export const useCortexChat = () => {
  const { active, isLiveMode, loadProviders, loaded } = useCortexProviders()
  const messages = useState<CortexChatMessage[]>('cortex.chat.messages', () => [
    buildMessage('assistant', INITIAL_MESSAGE)
  ])
  const prompt = useState<string>('cortex.chat.prompt', () => '')
  const status = useState<ChatStatus>('cortex.chat.status', () => 'ready')
  const failNextResponse = useState<boolean>('cortex.chat.fail-next', () => false)
  const lastUserPrompt = useState<string>('cortex.chat.last-user-prompt', () => '')
  const lastError = useState<string | null>('cortex.chat.last-error', () => null)

  let submittedTimer: ReturnType<typeof setTimeout> | null = null
  let responseTimer: ReturnType<typeof setTimeout> | null = null
  let activeRequestController: AbortController | null = null

  const clearTimers = () => {
    if (submittedTimer) {
      clearTimeout(submittedTimer)
      submittedTimer = null
    }

    if (responseTimer) {
      clearTimeout(responseTimer)
      responseTimer = null
    }
  }

  const abortActiveRequest = () => {
    if (activeRequestController) {
      activeRequestController.abort()
      activeRequestController = null
    }
  }

  const appendUserMessage = (text: string) => {
    messages.value = [...messages.value, buildMessage('user', text)]
    lastUserPrompt.value = text
  }

  const appendAssistantMessage = (text: string) => {
    messages.value = [...messages.value, buildMessage('assistant', text)]
  }

  const setStreamingState = () => {
    clearTimers()
    status.value = 'submitted'

    submittedTimer = setTimeout(() => {
      status.value = 'streaming'
      submittedTimer = null
    }, 250)
  }

  const simulateAssistantReply = (promptText: string) => {
    lastError.value = null
    setStreamingState()
    responseTimer = setTimeout(() => {
      if (failNextResponse.value) {
        status.value = 'error'
        failNextResponse.value = false
        responseTimer = null
        return
      }

      appendAssistantMessage(pickReply(promptText))
      status.value = 'ready'
      responseTimer = null
    }, 550)
  }

  const ensureProviderState = async () => {
    if (loaded.value) {
      return
    }

    try {
      await loadProviders()
    } catch {
      // Keep mock mode when provider state cannot be loaded.
    }
  }

  const shouldUseLiveApi = async () => {
    await ensureProviderState()
    if (!active.value) {
      return false
    }
    return isLiveMode.value
  }

  const requestAssistantReply = async (promptText: string) => {
    if (!await shouldUseLiveApi()) {
      simulateAssistantReply(promptText)
      return
    }

    lastError.value = null
    setStreamingState()
    abortActiveRequest()
    activeRequestController = new AbortController()

    try {
      const response = await $fetch<ChatApiResponse>('/api/chat', {
        method: 'POST',
        signal: activeRequestController.signal,
        body: { prompt: promptText }
      })

      messages.value = [...messages.value, buildMessage('assistant', response.text, response.configProposal)]
      status.value = 'ready'
    } catch (error) {
      const fetchError = error as {
        name?: string
      }

      if (fetchError?.name === 'AbortError') {
        status.value = 'ready'
        return
      }

      lastError.value = getFetchErrorMessage(error, 'Failed to contact provider API.')
      status.value = 'error'
    } finally {
      clearTimers()
      activeRequestController = null
    }
  }

  const sendPrompt = async (promptText: string) => {
    const trimmedPrompt = promptText.trim()

    if (!trimmedPrompt || status.value === 'submitted' || status.value === 'streaming') {
      return false
    }

    appendUserMessage(trimmedPrompt)
    await requestAssistantReply(trimmedPrompt)
    return true
  }

  const retryLastResponse = async () => {
    if (!lastUserPrompt.value || status.value !== 'error') {
      return false
    }

    await requestAssistantReply(lastUserPrompt.value)
    return true
  }

  const clearProposal = (messageId: string) => {
    messages.value = messages.value.map(msg =>
      msg.id === messageId ? { ...msg, configProposal: undefined } : msg
    )
  }

  const stopResponse = () => {
    clearTimers()
    abortActiveRequest()
    status.value = 'ready'
  }

  onBeforeUnmount(() => {
    clearTimers()
    abortActiveRequest()
  })

  return {
    messages,
    prompt,
    status,
    failNextResponse,
    lastError,
    sendPrompt,
    stopResponse,
    retryLastResponse,
    clearProposal
  }
}
