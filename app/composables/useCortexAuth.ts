export const useCortexAuth = () => {
  // Bearer token is stored in an HttpOnly cookie set by the server.
  // JS never reads or writes it — authHeaders is empty and the browser
  // sends the cookie automatically with every same-origin request.
  const authHeaders = computed((): Record<string, string> => ({}))

  // Called from the onboarding "paste existing token" flow.
  // Sends the token to the server for validation; the server sets the cookie.
  const saveToken = async (t: string) => {
    await $fetch('/api/agent/auth/login', { method: 'POST', body: { token: t } })
  }

  return { saveToken, authHeaders }
}
