export const useCortexAuth = () => {
  // Called from the onboarding "paste existing token" flow.
  // Sends the token to the server for validation; the server sets the cookie.
  const saveToken = async (t: string) => {
    await $fetch('/api/agent/auth/login', { method: 'POST', body: { token: t } })
  }

  return { saveToken }
}
