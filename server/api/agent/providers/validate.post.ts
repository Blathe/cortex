import { createError, defineEventHandler, readBody } from 'h3'
import { isKeylessProvider, isModelAllowed, isProviderId, type ProviderId } from '../../../utils/providerCatalog'
import { readProviders } from '../../../utils/providerConfig'
import { validateProviderCredentials } from '../../../utils/providerRuntime'

interface ValidatePostBody {
  providerId?: unknown
  modelId?: unknown
  apiKey?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ValidatePostBody>(event)

  if (typeof body.providerId !== 'string' || !isProviderId(body.providerId)) {
    throw createError({ statusCode: 400, statusMessage: 'providerId must be one of: openai, anthropic, groq, ollama.' })
  }
  if (typeof body.modelId !== 'string' || !body.modelId.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'modelId is required.' })
  }
  if (body.apiKey !== undefined && typeof body.apiKey !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'apiKey must be a string when provided.' })
  }

  const providerId = body.providerId as ProviderId
  const modelId = body.modelId.trim()
  if (!isModelAllowed(providerId, modelId)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Model "${modelId}" is not valid for provider "${providerId}".`
    })
  }

  if (isKeylessProvider(providerId)) {
    await validateProviderCredentials(providerId, modelId)
    return { ok: true, mode: 'live' }
  }

  const config = await readProviders()
  const providedApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  if (/[\r\n]/.test(providedApiKey)) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey must not contain newline characters.' })
  }
  if (providedApiKey.length > 8192) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey is too long.' })
  }
  const apiKey = providedApiKey || config.credentials[providerId]?.apiKey || ''

  if (!apiKey) {
    return {
      ok: true,
      mode: 'mock',
      message: 'No API key configured for this provider.'
    }
  }

  await validateProviderCredentials(providerId, modelId, apiKey)
  return {
    ok: true,
    mode: 'live'
  }
})
