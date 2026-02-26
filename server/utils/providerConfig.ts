import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  getDefaultModel,
  getProviderById,
  isModelAllowed,
  type ProviderId,
  PROVIDER_IDS
} from './providerCatalog'

const PROVIDERS_PATH = resolve(process.cwd(), 'agent/config/providers.json')
const PROVIDERS_TMP_PATH = `${PROVIDERS_PATH}.tmp`

interface LegacyStoredProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
}

interface LegacyProvidersConfig {
  providers: LegacyStoredProvider[]
  activeId: string | null
}

export interface ProviderCredentials {
  apiKey: string
}

export interface ProviderRuntimeSelection {
  providerId: ProviderId
  modelId: string
}

export interface ProviderMigrationWarning {
  legacyId: string
  legacyName: string
  reason: string
}

export interface ProvidersConfigV2 {
  version: 2
  credentials: Record<ProviderId, ProviderCredentials>
  active: ProviderRuntimeSelection | null
  migrationWarnings: ProviderMigrationWarning[]
}

const normalizeKey = (value: string): string => {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

const createEmptyCredentials = (): Record<ProviderId, ProviderCredentials> => ({
  openai: { apiKey: '' },
  anthropic: { apiKey: '' },
  groq: { apiKey: '' },
  ollama: { apiKey: '' }
})

const createEmptyConfig = (): ProvidersConfigV2 => ({
  version: 2,
  credentials: createEmptyCredentials(),
  active: null,
  migrationWarnings: []
})

const providerFromLegacyName = (name: string): ProviderId | null => {
  const normalized = normalizeKey(name)
  if (normalized.includes('openai')) return 'openai'
  if (normalized.includes('anthropic') || normalized.includes('claude')) return 'anthropic'
  if (normalized.includes('groq')) return 'groq'
  return null
}

const providerFromLegacyHost = (baseUrl: string): ProviderId | null => {
  try {
    const url = new URL(baseUrl)
    if (url.hostname === 'api.openai.com') return 'openai'
    if (url.hostname === 'api.anthropic.com') return 'anthropic'
    if (url.hostname === 'api.groq.com') return 'groq'
    return null
  } catch {
    return null
  }
}

const resolveLegacyProviderId = (provider: LegacyStoredProvider): ProviderId | null => {
  return providerFromLegacyName(provider.name) ?? providerFromLegacyHost(provider.baseUrl)
}

const ensureActiveIsValid = (config: ProvidersConfigV2): ProvidersConfigV2 => {
  if (!config.active) {
    return config
  }

  if (!isModelAllowed(config.active.providerId, config.active.modelId)) {
    const defaultModel = getDefaultModel(config.active.providerId)
    if (!defaultModel) {
      config.active = null
    } else {
      config.active = {
        providerId: config.active.providerId,
        modelId: defaultModel
      }
    }
  }

  return config
}

const sanitizeV2 = (value: Partial<ProvidersConfigV2>): ProvidersConfigV2 => {
  const next = createEmptyConfig()
  const incomingCreds = (value.credentials ?? {}) as Partial<Record<ProviderId, ProviderCredentials>>

  for (const providerId of PROVIDER_IDS) {
    const apiKey = incomingCreds[providerId]?.apiKey
    next.credentials[providerId].apiKey = typeof apiKey === 'string' ? apiKey.trim() : ''
  }

  const active = value.active
  if (
    active
    && typeof active.providerId === 'string'
    && typeof active.modelId === 'string'
    && PROVIDER_IDS.includes(active.providerId as ProviderId)
  ) {
    const providerId = active.providerId as ProviderId
    next.active = {
      providerId,
      modelId: active.modelId.trim() || getDefaultModel(providerId)
    }
  }

  if (Array.isArray(value.migrationWarnings)) {
    next.migrationWarnings = value.migrationWarnings
      .map(warning => ({
        legacyId: typeof warning.legacyId === 'string' ? warning.legacyId : 'unknown',
        legacyName: typeof warning.legacyName === 'string' ? warning.legacyName : 'unknown',
        reason: typeof warning.reason === 'string' ? warning.reason : 'Disabled during migration.'
      }))
  }

  return ensureActiveIsValid(next)
}

const migrateV1ToV2 = (value: LegacyProvidersConfig): ProvidersConfigV2 => {
  const migrated = createEmptyConfig()
  const mappedByLegacyId = new Map<string, ProviderId>()

  for (const legacy of value.providers ?? []) {
    const mappedProviderId = resolveLegacyProviderId(legacy)
    if (!mappedProviderId) {
      migrated.migrationWarnings.push({
        legacyId: legacy.id,
        legacyName: legacy.name || 'unknown',
        reason: 'Unrecognized provider; disabled and excluded from runtime selection.'
      })
      continue
    }

    mappedByLegacyId.set(legacy.id, mappedProviderId)

    const key = legacy.apiKey?.trim()
    if (!key) {
      continue
    }

    if (!migrated.credentials[mappedProviderId].apiKey) {
      migrated.credentials[mappedProviderId].apiKey = key
      continue
    }

    if (migrated.credentials[mappedProviderId].apiKey !== key) {
      migrated.migrationWarnings.push({
        legacyId: legacy.id,
        legacyName: legacy.name || getProviderById(mappedProviderId).label,
        reason: `Multiple legacy entries mapped to ${getProviderById(mappedProviderId).label}; kept first API key.`
      })
    }
  }

  const activeLegacy = value.providers?.find(p => p.id === value.activeId) ?? null
  if (activeLegacy) {
    const mappedProviderId = mappedByLegacyId.get(activeLegacy.id)
    if (mappedProviderId) {
      const candidateModel = activeLegacy.models?.[0]?.trim()
      const modelId = candidateModel && isModelAllowed(mappedProviderId, candidateModel)
        ? candidateModel
        : getDefaultModel(mappedProviderId)

      if (candidateModel && candidateModel !== modelId) {
        migrated.migrationWarnings.push({
          legacyId: activeLegacy.id,
          legacyName: activeLegacy.name || getProviderById(mappedProviderId).label,
          reason: `Model "${candidateModel}" is not supported for ${getProviderById(mappedProviderId).label}; defaulted to "${modelId}".`
        })
      }

      migrated.active = { providerId: mappedProviderId, modelId }
    } else {
      migrated.migrationWarnings.push({
        legacyId: activeLegacy.id,
        legacyName: activeLegacy.name || 'unknown',
        reason: 'Active legacy provider was not recognized; runtime left unset.'
      })
    }
  }

  if (!migrated.active) {
    const firstMapped = value.providers.find(p => mappedByLegacyId.has(p.id))
    if (firstMapped) {
      const providerId = mappedByLegacyId.get(firstMapped.id)!
      const candidateModel = firstMapped.models?.[0]?.trim()
      const modelId = candidateModel && isModelAllowed(providerId, candidateModel)
        ? candidateModel
        : getDefaultModel(providerId)
      migrated.active = { providerId, modelId }
    }
  }

  return migrated
}

const looksLikeV2 = (value: unknown): value is Partial<ProvidersConfigV2> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return (value as { version?: unknown }).version === 2
}

const looksLikeV1 = (value: unknown): value is LegacyProvidersConfig => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const v = value as { providers?: unknown }
  return Array.isArray(v.providers)
}

const writeProvidersInternal = async (config: ProvidersConfigV2): Promise<void> => {
  await mkdir(dirname(PROVIDERS_PATH), { recursive: true })
  const payload = JSON.stringify(config, null, 2) + '\n'
  await writeFile(PROVIDERS_TMP_PATH, payload, 'utf-8')
  await rename(PROVIDERS_TMP_PATH, PROVIDERS_PATH)
}

export const readProviders = async (): Promise<ProvidersConfigV2> => {
  try {
    const raw = await readFile(PROVIDERS_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as unknown

    if (looksLikeV2(parsed)) {
      return sanitizeV2(parsed)
    }

    if (looksLikeV1(parsed)) {
      const migrated = migrateV1ToV2(parsed)
      await writeProvidersInternal(migrated)
      return migrated
    }

    const empty = createEmptyConfig()
    await writeProvidersInternal(empty)
    return empty
  } catch {
    const empty = createEmptyConfig()
    await writeProvidersInternal(empty)
    return empty
  }
}

export const writeProviders = async (config: ProvidersConfigV2): Promise<void> => {
  const sanitized = sanitizeV2(config)
  await writeProvidersInternal(sanitized)
}
