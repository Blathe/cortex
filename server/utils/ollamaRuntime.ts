import { createError } from 'h3'
import { Ollama } from 'ollama'

const getOllamaClient = () => {
  return new Ollama({ host: process.env.OLLAMA_HOST ?? 'http://localhost:11434' })
}

export const listOllamaModels = async (): Promise<{ id: string, label: string }[]> => {
  const client = getOllamaClient()
  try {
    const response = await client.list()
    return response.models.map(model => ({
      id: model.model,
      label: model.name
    }))
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Ollama is not reachable. Is it running? Try: ollama serve' })
  }
}

export const requestOllamaCompletion = async (opts: {
  modelId: string
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}): Promise<string> => {
  const client = getOllamaClient()
  try {
    const messages: Array<{ role: string, content: string }> = []
    if (opts.systemPrompt) {
      messages.push({ role: 'system', content: opts.systemPrompt })
    }
    messages.push({ role: 'user', content: opts.prompt })

    const response = await client.chat({
      model: opts.modelId,
      messages,
      options: {
        temperature: opts.temperature ?? 0,
        num_predict: opts.maxTokens ?? 1024
      }
    })

    const text = response.message?.content?.trim() ?? ''
    if (!text) {
      throw createError({ statusCode: 502, statusMessage: 'Ollama returned an empty response.' })
    }
    return text
  } catch (error) {
    const h3Error = error as { statusCode?: number }
    if (h3Error.statusCode) throw error
    throw createError({ statusCode: 502, statusMessage: 'Ollama request failed. Is the daemon running?' })
  }
}
