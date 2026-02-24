export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/onboarding') return

  // Cache onboarding status in shared state so subsequent navigations are synchronous.
  // The page itself updates this to `true` immediately after a successful finish,
  // so the middleware never needs to re-fetch within the same session.
  const onboarded = useState<boolean | null>('onboarded', () => null)

  if (onboarded.value === null) {
    const data = await $fetch<{ onboarded: boolean }>('/api/agent/onboarding-status').catch(() => null)
    if (typeof data?.onboarded === 'boolean') {
      onboarded.value = data.onboarded
      if (import.meta.client) {
        if (data.onboarded) {
          sessionStorage.setItem('cortex.onboarded', 'true')
        } else {
          sessionStorage.removeItem('cortex.onboarded')
        }
      }
    } else if (import.meta.client) {
      // Fetch failed (typically transient during local dev reload). Use the optimistic
      // session hint if present; otherwise default to not onboarded.
      onboarded.value = sessionStorage.getItem('cortex.onboarded') === 'true'
    } else {
      onboarded.value = false
    }
  }

  if (onboarded.value === false) {
    return navigateTo('/onboarding')
  }
})
