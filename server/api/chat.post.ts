import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createError, defineEventHandler, readBody } from 'h3'
import { readSettings } from '../utils/agentConfig'
import { isModelAllowed, isProviderId } from '../utils/providerCatalog'
import { readProviders } from '../utils/providerConfig'
import { requestProviderChatCompletion } from '../utils/providerRuntime'

interface ChatRequestBody {
  prompt?: string
}

interface AgentConfigProposalRaw {
  reason?: string
  patch?: Record<string, unknown>
}

const parseConfigProposal = (rawText: string) => {
  const markerIndex = rawText.indexOf('CONFIG_PROPOSAL:')
  if (markerIndex === -1) {
    return { text: rawText, configProposal: undefined }
  }

  const visibleText = rawText.slice(0, markerIndex).trimEnd()
  const afterMarker = rawText.slice(markerIndex + 'CONFIG_PROPOSAL:'.length)

  const codeBlockMatch = afterMarker.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonString = (codeBlockMatch?.[1] ?? afterMarker).trim()

  try {
    const parsed = JSON.parse(jsonString) as AgentConfigProposalRaw
    const patch = parsed.patch
    const reason = parsed.reason ?? ''

    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return { text: rawText, configProposal: undefined }
    }

    const LOW_RISK = new Set(['persona.tone', 'persona.verbosity', 'reasoning.temperature', 'reasoning.maxTokens'])
    const getDotPaths = (obj: Record<string, unknown>, prefix = ''): string[] => {
      const paths: string[] = []
      for (const key of Object.keys(obj)) {
        const full = prefix ? `${prefix}.${key}` : key
        const val = obj[key]
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          paths.push(...getDotPaths(val as Record<string, unknown>, full))
        } else {
          paths.push(full)
        }
      }
      return paths
    }

    const paths = getDotPaths(patch)
    const riskLevel: 'low' | 'high' = paths.every(p => LOW_RISK.has(p)) ? 'low' : 'high'

    return {
      text: visibleText,
      configProposal: { patch, reason, riskLevel }
    }
  } catch {
    return { text: rawText, configProposal: undefined }
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatRequestBody>(event)
  const prompt = body.prompt?.trim()

  if (!prompt) {
    throw createError({ statusCode: 400, statusMessage: 'Prompt is required.' })
  }

  const providersConfig = await readProviders()
  if (!providersConfig.active) {
    throw createError({ statusCode: 400, statusMessage: 'No active provider/model configured.' })
  }

  const { providerId, modelId } = providersConfig.active
  if (!isProviderId(providerId)) {
    throw createError({ statusCode: 400, statusMessage: 'Active provider is invalid.' })
  }
  if (!isModelAllowed(providerId, modelId)) {
    throw createError({ statusCode: 400, statusMessage: 'Active model is invalid for the selected provider.' })
  }

  const apiKey = providersConfig.credentials[providerId]?.apiKey?.trim() || ''
  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: `No API key configured for active provider "${providerId}".` })
  }

  const settings = await readSettings()
  const rawPrompt = readFileSync(resolve(process.cwd(), 'agent/prompts/SYSTEM_PROMPT.md'), 'utf-8').trim()
  const systemPrompt = `[tone: ${settings.persona.tone}, verbosity: ${settings.persona.verbosity}]\n\n${rawPrompt}`

  const rawText = await requestProviderChatCompletion({
    providerId,
    modelId,
    apiKey,
    prompt,
    systemPrompt,
    temperature: settings.reasoning.temperature,
    maxTokens: settings.reasoning.maxTokens
  })

  if (!rawText) {
    throw createError({ statusCode: 502, statusMessage: `${providerId} returned an empty response.` })
  }

  const { text, configProposal } = parseConfigProposal(rawText)
  return { text, configProposal }
})
