import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createError, defineEventHandler, readBody } from 'h3'
import { readSettings } from '../utils/agentConfig'

interface ChatRequestBody {
  prompt?: string
  provider?: string
  model?: string
  baseUrl?: string
  apiKey?: string
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string, text?: string }>
    }
  }>
}

interface AgentConfigProposalRaw {
  reason?: string
  patch?: Record<string, unknown>
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

const ALLOWED_HOSTS = new Set([
  'api.openai.com'
])

const validateBaseUrl = (raw: string): string => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid base URL.' })
  }
  if (url.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Base URL must use HTTPS.' })
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw createError({ statusCode: 400, statusMessage: `Base URL host "${url.hostname}" is not permitted.` })
  }
  return raw.replace(/\/$/, '')
}

type OpenAIMessageContent = string | Array<{ type?: string, text?: string }> | undefined

const normalizeProvider = (provider?: string) => {
  return provider?.trim().toLowerCase().replace(/\s+/g, '')
}

const getTextContent = (content: OpenAIMessageContent) => {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .filter(part => part?.type === 'text' && typeof part.text === 'string')
      .map(part => part.text?.trim())
      .filter(Boolean)
      .join('\n')
  }

  return ''
}

const parseConfigProposal = (rawText: string) => {
  const markerIndex = rawText.indexOf('CONFIG_PROPOSAL:')
  if (markerIndex === -1) {
    return { text: rawText, configProposal: undefined }
  }

  const visibleText = rawText.slice(0, markerIndex).trimEnd()
  const afterMarker = rawText.slice(markerIndex + 'CONFIG_PROPOSAL:'.length)

  // Extract JSON from code block or bare JSON
  const codeBlockMatch = afterMarker.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonString = (codeBlockMatch?.[1] ?? afterMarker).trim()

  try {
    const parsed = JSON.parse(jsonString) as AgentConfigProposalRaw
    const patch = parsed.patch
    const reason = parsed.reason ?? ''

    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return { text: rawText, configProposal: undefined }
    }

    // Determine risk level based on patch keys
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
  const provider = normalizeProvider(body.provider)
  const model = body.model?.trim()
  const baseUrl = validateBaseUrl(body.baseUrl?.trim() || DEFAULT_BASE_URL)
  const apiKey = body.apiKey?.trim()

  if (!prompt) {
    throw createError({ statusCode: 400, statusMessage: 'Prompt is required.' })
  }

  if (!provider || provider !== 'openai') {
    throw createError({ statusCode: 400, statusMessage: 'Only the OpenAI provider is currently supported.' })
  }

  if (!model) {
    throw createError({ statusCode: 400, statusMessage: 'Model is required.' })
  }

  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'API key is required.' })
  }

  const settings = readSettings()
  const rawPrompt = readFileSync(resolve(process.cwd(), 'agent/prompts/SYSTEM_PROMPT.md'), 'utf-8').trim()
  const systemPrompt = `[tone: ${settings.persona.tone}, verbosity: ${settings.persona.verbosity}]\n\n${rawPrompt}`

  try {
    const response = await $fetch<OpenAIChatCompletionResponse>(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        model,
        temperature: settings.reasoning.temperature,
        max_tokens: settings.reasoning.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      }
    })

    const content = response?.choices?.[0]?.message?.content
    const rawText = getTextContent(content)

    if (!rawText) {
      throw createError({
        statusCode: 502,
        statusMessage: 'OpenAI returned an empty response.'
      })
    }

    const { text, configProposal } = parseConfigProposal(rawText)
    return { text, configProposal }
  } catch (error) {
    const fetchError = error as {
      statusCode?: number
      statusMessage?: string
      data?: {
        error?: {
          message?: string
        }
      }
    }

    throw createError({
      statusCode: fetchError.statusCode || 500,
      statusMessage: fetchError.data?.error?.message || fetchError.statusMessage || 'Failed to contact OpenAI.'
    })
  }
})
