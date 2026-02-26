import { createError, defineEventHandler, readBody } from 'h3'
import { isProviderId, type ProviderId } from '../../../utils/providerCatalog'
import { readProviders, writeProviders } from '../../../utils/providerConfig'

interface CredentialsPostBody {
  providerId?: unknown
  apiKey?: unknown
}

const toTokenPreview = (apiKey: string): string | null => {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return null
  }
  return `${trimmed.slice(0, 5)}...`
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CredentialsPostBody>(event)

  if (typeof body.providerId !== 'string' || !isProviderId(body.providerId)) {
    throw createError({ statusCode: 400, statusMessage: 'providerId must be one of: openai, anthropic, groq, ollama.' })
  }

  if (body.apiKey === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey is required.' })
  }

  if (typeof body.apiKey !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'apiKey must be a string when provided.' })
  }

  const apiKey = body.apiKey.trim()
  if (/[\r\n]/.test(apiKey)) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey must not contain newline characters.' })
  }
  if (apiKey.length > 8192) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey is too long.' })
  }

  const providerId = body.providerId as ProviderId
  const config = await readProviders()
  config.credentials[providerId].apiKey = apiKey
  await writeProviders(config)

  return {
    ok: true,
    providerId,
    configured: Boolean(apiKey),
    tokenPreview: toTokenPreview(apiKey)
  }
})
