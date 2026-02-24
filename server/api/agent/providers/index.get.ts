import { defineEventHandler } from 'h3'
import { readProviders } from '../../../utils/providerConfig'

export default defineEventHandler(async () => {
  const config = await readProviders()
  return {
    providers: config.providers.map(p => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      apiKeySet: Boolean(p.apiKey),
      models: p.models
    })),
    activeId: config.activeId
  }
})
