import type { DashboardPrefs } from '~/types/cortex'

const STORAGE_KEY = 'cortex.dashboard.v1'

const DEFAULT_PREFS: DashboardPrefs = {
  primaryColor: 'green',
  timezone: 'UTC',
  dateFormat: 'absolute'
}

export const useCortexDashboard = () => {
  const appConfig = useAppConfig()
  const prefs = useState<DashboardPrefs>('cortex.dashboard', () => ({ ...DEFAULT_PREFS }))

  const load = (): DashboardPrefs => {
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DashboardPrefs>) }
        }
      } catch {
        // ignore parse errors
      }
    }
    return { ...DEFAULT_PREFS }
  }

  const apply = (p: DashboardPrefs) => {
    prefs.value = p
    appConfig.ui.colors.primary = p.primaryColor
  }

  const save = (p: DashboardPrefs): DashboardPrefs => {
    apply(p)
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    }
    return p
  }

  const loadAndApply = (): DashboardPrefs => {
    const loaded = load()
    apply(loaded)
    return loaded
  }

  return { prefs, load, apply, save, loadAndApply }
}
