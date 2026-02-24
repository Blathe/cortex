export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'

export type CortexChatRole = 'user' | 'assistant' | 'system'

export interface CortexChatPart {
  type: 'text'
  text: string
}

export interface AgentConfigProposal {
  patch: Record<string, unknown>
  reason: string
  riskLevel: 'low' | 'high'
}

export interface CortexChatMessage {
  id: string
  role: CortexChatRole
  parts: CortexChatPart[]
  createdAt: string
  configProposal?: AgentConfigProposal
}

export interface CortexConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
  updatedAt: string
}

export interface CortexProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
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

export interface AgentSettings {
  version: number
  persona: {
    name: string
    tone: string
    verbosity: string
  }
  reasoning: {
    temperature: number
    maxTokens: number
  }
  git: {
    autoPush: boolean
    autoMerge: boolean
  }
  meta: {
    updatedAt: string
    updatedBy: string
  }
}

export interface AgentChangeLog {
  filename: string
  timestamp: string
  changedBy: string
  patch: Record<string, unknown>
  reason: string
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
