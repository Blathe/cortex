export const useCortexAuth = () => {
  /** Re-authenticate with PIN to elevate to sudo mode. */
  const confirmPin = async (pin: string) => {
    await $fetch('/api/agent/auth/verify', { method: 'POST', body: { pin } })
  }

  return { confirmPin }
}
