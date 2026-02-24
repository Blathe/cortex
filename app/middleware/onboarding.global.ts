export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/onboarding') return

  // Cache onboarding status in shared state so subsequent navigations are synchronous.
  // The page itself updates this to `true` immediately after a successful finish,
  // so the middleware never needs to re-fetch within the same session.
  const onboarded = useState<boolean | null>('onboarded', () => null)

  if (onboarded.value === null) {
    const data = await $fetch<{ onboarded: boolean }>('/api/agent/onboarding-status').catch(() => null)
    onboarded.value = data?.onboarded ?? false
  }

  if (!onboarded.value) {
    return navigateTo('/onboarding')
  }
})
