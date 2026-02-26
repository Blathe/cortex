import { createError, defineEventHandler, readBody } from 'h3'
import { isModelAllowed, isProviderId, type ProviderId } from '../../../utils/providerCatalog'
import { readProviders, writeProviders } from '../../../utils/providerConfig'

interface ActivePostBody {
  providerId?: unknown
  modelId?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ActivePostBody>(event)

  if (typeof body.providerId !== 'string' || !isProviderId(body.providerId)) {
    throw createError({ statusCode: 400, statusMessage: 'providerId must be one of: openai, anthropic, groq, ollama.' })
  }

  if (typeof body.modelId !== 'string' || !body.modelId.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'modelId is required.' })
  }

  const providerId = body.providerId as ProviderId
  const modelId = body.modelId.trim()

  if (!isModelAllowed(providerId, modelId)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Model "${modelId}" is not valid for provider "${providerId}".`
    })
  }

  const config = await readProviders()
  config.active = { providerId, modelId }
  await writeProviders(config)

  return { ok: true, active: config.active }
})
