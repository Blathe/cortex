export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'

export type CortexChatRole = 'user' | 'assistant' | 'system'

export interface CortexChatPart {
  type: 'text'
  text: string
}

export interface CortexChatMessage {
  id: string
  role: CortexChatRole
  parts: CortexChatPart[]
  createdAt: string
}

export interface CortexConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
  systemPrompt: string
  updatedAt: string
}
