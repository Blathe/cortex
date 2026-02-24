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

export type JobStatus = 'running' | 'completed' | 'failed' | 'pending'
export type JobType = 'task' | 'scrape' | 'analysis' | 'sync'
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface CortexJob {
  id: string
  name: string
  type: JobType
  status: JobStatus
  startedAt: string | null
  completedAt: string | null
  durationSecs: number | null
  progress: number | null
}

export interface CortexJobLog {
  id: string
  jobId: string
  jobName: string
  level: LogLevel
  message: string
  timestamp: string
}

export interface CortexCron {
  id: string
  name: string
  schedule: string
  description: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string
  lastStatus: 'success' | 'failed' | null
}
