export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/onboarding') return

  // Cache onboarding status in shared state so subsequent navigations are synchronous.
  // The page itself updates this to `true` immediately after a successful finish,
  // so the middleware never needs to re-fetch within the same session.
  const onboarded = useState<boolean | null>('onboarded', () => null)

  // Client-only optimistic cache to prevent false redirects during transient
  // dev-server restarts immediately after finishing onboarding.
  if (import.meta.client && onboarded.value === null) {
    const cached = sessionStorage.getItem('cortex.onboarded')
    if (cached === 'true') {
      onboarded.value = true
    }
  }

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
    }
  }

  if (onboarded.value === false) {
    return navigateTo('/onboarding')
  }
})
