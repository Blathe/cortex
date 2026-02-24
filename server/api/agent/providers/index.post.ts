import { createError, defineEventHandler, readBody } from 'h3'
import { readProviders, writeProviders } from '../../../utils/providerConfig'

interface ProviderPostBody {
  id?: unknown
  name?: unknown
  baseUrl?: unknown
  apiKey?: unknown
  models?: unknown
  setActive?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ProviderPostBody>(event)

  if (typeof body?.name !== 'string' || !body.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required.' })
  }
  if (body.name.trim().length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'name is too long.' })
  }

  if (typeof body?.baseUrl !== 'string' || !body.baseUrl.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'baseUrl is required.' })
  }
  if (body.baseUrl.trim().length > 2048) {
    throw createError({ statusCode: 400, statusMessage: 'baseUrl is too long.' })
  }

  let normalizedBaseUrl = ''
  try {
    const parsed = new URL(body.baseUrl.trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol')
    }
    normalizedBaseUrl = body.baseUrl.trim()
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'baseUrl must be a valid http(s) URL.' })
  }

  if (body.id !== undefined && (typeof body.id !== 'string' || !body.id.trim())) {
    throw createError({ statusCode: 400, statusMessage: 'id must be a non-empty string when provided.' })
  }

  if (body.setActive !== undefined && typeof body.setActive !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'setActive must be a boolean when provided.' })
  }

  if (body.apiKey !== undefined && typeof body.apiKey !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'apiKey must be a string when provided.' })
  }
  if (typeof body.apiKey === 'string' && /[\r\n]/.test(body.apiKey)) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey must not contain newline characters.' })
  }
  if (typeof body.apiKey === 'string' && body.apiKey.length > 8192) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey is too long.' })
  }

  if (!Array.isArray(body.models) || body.models.some(m => typeof m !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'models must be an array of strings.' })
  }

  const cleanModels = body.models.map(m => m.trim()).filter(Boolean)
  if (cleanModels.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'At least one model is required.' })
  }
  if (cleanModels.length > 50) {
    throw createError({ statusCode: 400, statusMessage: 'Too many models provided.' })
  }
  if (cleanModels.some(m => m.length > 200)) {
    throw createError({ statusCode: 400, statusMessage: 'Model name is too long.' })
  }

  const config = await readProviders()
  const id = typeof body.id === 'string' ? body.id : `provider-${Date.now()}`
  const existing = config.providers.find(p => p.id === id)

  const updated = {
    id,
    name: body.name.trim(),
    baseUrl: normalizedBaseUrl,
    // Empty apiKey means "keep existing"; only update if a new value is provided
    apiKey: (typeof body.apiKey === 'string' ? body.apiKey.trim() : '') || existing?.apiKey || '',
    models: cleanModels
  }

  if (existing) {
    config.providers = config.providers.map(p => p.id === id ? updated : p)
  } else {
    config.providers = [...config.providers, updated]
  }

  if (body.setActive === true) {
    config.activeId = id
  }

  await writeProviders(config)
  return { ok: true, id }
})
