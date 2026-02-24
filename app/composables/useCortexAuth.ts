const STORAGE_KEY = 'cortex.auth.token'

export const useCortexAuth = () => {
  const token = useState<string | null>('cortex.auth.token', () => null)

  // Hydrate from localStorage on the client whenever the state is empty
  if (import.meta.client && token.value === null) {
    token.value = localStorage.getItem(STORAGE_KEY)
  }

  const saveToken = (t: string) => {
    token.value = t
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, t)
    }
  }

  const authHeaders = computed((): Record<string, string> => {
    if (!token.value) return {}
    return { Authorization: `Bearer ${token.value}` }
  })

  return { token, saveToken, authHeaders }
}
