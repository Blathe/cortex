export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/onboarding') return
  if (!import.meta.client) return

  const onboarded = localStorage.getItem('cortex.onboarded')
  if (!onboarded) {
    return navigateTo('/onboarding')
  }
})
