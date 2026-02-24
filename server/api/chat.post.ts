import { createError, defineEventHandler, readBody } from 'h3'

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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

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

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatRequestBody>(event)

  const prompt = body.prompt?.trim()
  const provider = normalizeProvider(body.provider)
  const model = body.model?.trim()
  const baseUrl = (body.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')
  const apiKey = body.apiKey?.trim()
  // TODO: load system prompt from agent/prompts/ markdown file
  const systemPrompt = 'You are Cortex, an autonomous AI assistant.'

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

  try {
    const response = await $fetch<OpenAIChatCompletionResponse>(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      }
    })

    const content = response?.choices?.[0]?.message?.content
    const text = getTextContent(content)

    if (!text) {
      throw createError({
        statusCode: 502,
        statusMessage: 'OpenAI returned an empty response.'
      })
    }

    return { text }
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
