import { createError, defineEventHandler, getRouterParam } from 'h3'
import { readProviders, writeProviders } from '../../../utils/providerConfig'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required.' })
  }

  const config = await readProviders()
  if (!config.providers.some(p => p.id === id)) {
    throw createError({ statusCode: 404, statusMessage: 'Provider not found.' })
  }

  config.providers = config.providers.filter(p => p.id !== id)
  if (config.activeId === id) {
    config.activeId = config.providers[0]?.id ?? null
  }

  await writeProviders(config)
  return { ok: true }
})
