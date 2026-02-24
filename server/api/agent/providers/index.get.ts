import { defineEventHandler } from 'h3'
import { readProviders } from '../../../utils/providerConfig'
import { PROVIDER_IDS, getProviderById, type ProviderId } from '../../../utils/providerCatalog'

export default defineEventHandler(async () => {
  const config = await readProviders()

  const credentials = Object.fromEntries(
    PROVIDER_IDS.map(providerId => [
      providerId,
      { configured: Boolean(config.credentials[providerId]?.apiKey) }
    ])
  ) as Record<ProviderId, { configured: boolean }>

  return {
    catalog: PROVIDER_IDS.map((providerId) => {
      const provider = getProviderById(providerId)
      return {
        providerId: provider.providerId,
        label: provider.label,
        baseUrl: provider.baseUrl,
        authStrategy: provider.authStrategy,
        defaultModel: provider.defaultModel,
        models: provider.models
      }
    }),
    credentials,
    active: config.active,
    migrationWarnings: config.migrationWarnings
  }
})
