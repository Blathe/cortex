import { createError } from 'h3'
import { getProviderById, type ProviderId } from './providerCatalog'

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string, text?: string }>
    }
  }>
}

interface AnthropicMessageResponse {
  content?: Array<{
    type?: string
    text?: string
  }>
}

interface ProviderRequestOptions {
  providerId: ProviderId
  modelId: string
  apiKey: string
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

type OpenAIMessageContent = string | Array<{ type?: string, text?: string }> | undefined

const getTextFromOpenAIContent = (content: OpenAIMessageContent): string => {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .filter(part => part?.type === 'text' && typeof part.text === 'string')
    .map(part => part.text?.trim())
    .filter(Boolean)
    .join('\n')
}

const getTextFromAnthropicContent = (content: AnthropicMessageResponse['content']): string => {
  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .filter(part => part?.type === 'text' && typeof part.text === 'string')
    .map(part => part.text?.trim())
    .filter(Boolean)
    .join('\n')
}

const mapProviderError = (providerLabel: string, error: unknown): never => {
  const fetchError = error as {
    statusCode?: number
    status?: number
    statusMessage?: string
    data?: {
      error?: {
        message?: string
      }
      message?: string
    }
    message?: string
  }

  const message = fetchError?.data?.error?.message
    || fetchError?.data?.message
    || fetchError?.statusMessage
    || fetchError?.message
    || `Failed to contact ${providerLabel}.`

  throw createError({
    statusCode: fetchError.statusCode || fetchError.status || 502,
    statusMessage: message
  })
}

const requestOpenAICompatible = async (opts: ProviderRequestOptions): Promise<string> => {
  const provider = getProviderById(opts.providerId)

  try {
    const response = await $fetch<OpenAIChatCompletionResponse>(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${opts.apiKey}`,
        'content-type': 'application/json'
      },
      body: {
        model: opts.modelId,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 1,
        messages: [
          ...(opts.systemPrompt ? [{ role: 'system', content: opts.systemPrompt }] : []),
          { role: 'user', content: opts.prompt }
        ]
      }
    })

    const content = response?.choices?.[0]?.message?.content
    const text = getTextFromOpenAIContent(content)
    if (!text) {
      throw createError({ statusCode: 502, statusMessage: `${provider.label} returned an empty response.` })
    }
    return text
  } catch (error) {
    return mapProviderError(provider.label, error)
  }
}

const requestAnthropic = async (opts: ProviderRequestOptions): Promise<string> => {
  const provider = getProviderById(opts.providerId)

  try {
    const response = await $fetch<AnthropicMessageResponse>(`${provider.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: {
        model: opts.modelId,
        max_tokens: opts.maxTokens ?? 1,
        temperature: opts.temperature ?? 0,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: opts.prompt }]
      }
    })

    const text = getTextFromAnthropicContent(response.content)
    if (!text) {
      throw createError({ statusCode: 502, statusMessage: `${provider.label} returned an empty response.` })
    }
    return text
  } catch (error) {
    return mapProviderError(provider.label, error)
  }
}

export const validateProviderCredentials = async (
  providerId: ProviderId,
  modelId: string,
  apiKey: string
): Promise<void> => {
  const prompt = 'Respond with the single word "ok".'

  if (providerId === 'anthropic') {
    await requestAnthropic({
      providerId,
      modelId,
      apiKey,
      prompt,
      maxTokens: 16,
      temperature: 0
    })
    return
  }

  await requestOpenAICompatible({
    providerId,
    modelId,
    apiKey,
    prompt,
    maxTokens: 16,
    temperature: 0
  })
}

export const requestProviderChatCompletion = async (opts: ProviderRequestOptions): Promise<string> => {
  if (opts.providerId === 'anthropic') {
    return requestAnthropic(opts)
  }

  return requestOpenAICompatible(opts)
}
