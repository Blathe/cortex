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

export type ProviderId = 'openai' | 'anthropic' | 'groq' | 'ollama'

export interface ProviderModelEntry {
  id: string
  label: string
}

export interface ProviderCatalogEntry {
  providerId: ProviderId
  label: string
  baseUrl: string
  authStrategy: 'bearer' | 'x-api-key' | 'none'
  defaultModel: string
  models: ProviderModelEntry[]
}

export interface ProviderRuntimeState {
  providerId: ProviderId
  modelId: string
}

export interface ProviderCredentialStatus {
  configured: boolean
  tokenPreview: string | null
}

export interface ProviderMigrationWarning {
  legacyId: string
  legacyName: string
  reason: string
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
    onboarded?: boolean
    updatedAt: string
    updatedBy: string
    revision: number
  }
}

export interface DashboardPrefs {
  primaryColor: string
  timezone: string
  dateFormat: 'relative' | 'absolute'
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
