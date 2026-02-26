export default defineNuxtRouteMiddleware(async (to) => {
  // Auth pages never redirect
  if (to.path === '/onboarding' || to.path === '/login' || to.path === '/recover') return

  const headers = useRequestHeaders(['cookie'])
  const data = await $fetch<{
    onboarded: boolean
    authenticated: boolean
    pinConfigured: boolean
  }>('/api/agent/auth/status', { headers }).catch(() => null)

  // If the API is unreachable, use session storage hint as optimistic fallback (client only)
  if (!data) {
    if (import.meta.client) {
      const hint = sessionStorage.getItem('cortex.onboarded')
      if (hint !== 'true') return navigateTo('/onboarding')
    } else {
      return navigateTo('/onboarding')
    }
    return
  }

  if (!data.onboarded || !data.pinConfigured) {
    return navigateTo('/onboarding')
  }

  if (!data.authenticated) {
    return navigateTo('/login')
  }

  // Cache the onboarded flag so the app can reference it synchronously
  if (import.meta.client) {
    sessionStorage.setItem('cortex.onboarded', 'true')
  }

  // Keep the shared state in sync so pages can read it without an extra fetch
  const onboarded = useState<boolean | null>('onboarded')
  onboarded.value = true
})
