import { createError, defineEventHandler, readBody } from 'h3'
import { readProviders, writeProviders } from '../../../utils/providerConfig'

interface ProviderPostBody {
  id?: string
  name: string
  baseUrl: string
  apiKey?: string
  models: string[]
  setActive?: boolean
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ProviderPostBody>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required.' })
  }
  if (!body?.baseUrl?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'baseUrl is required.' })
  }

  const config = await readProviders()
  const id = body.id ?? `provider-${Date.now()}`
  const existing = config.providers.find(p => p.id === id)

  const updated = {
    id,
    name: body.name.trim(),
    baseUrl: body.baseUrl.trim(),
    // Empty apiKey means "keep existing"; only update if a new value is provided
    apiKey: body.apiKey?.trim() || existing?.apiKey || '',
    models: body.models.map(m => m.trim()).filter(Boolean)
  }

  if (existing) {
    config.providers = config.providers.map(p => p.id === id ? updated : p)
  } else {
    config.providers = [...config.providers, updated]
  }

  if (body.setActive) {
    config.activeId = id
  }

  await writeProviders(config)
  return { ok: true, id }
})
