<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const pin = ref<number[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const lockedUntil = ref<string | null>(null)

const isComplete = computed(() => pin.value.length === 6)

const submit = async () => {
  error.value = null
  lockedUntil.value = null

  const code = pin.value.join('')
  if (!/^\d{6}$/.test(code)) return

  isLoading.value = true
  try {
    await $fetch('/api/agent/auth/login', { method: 'POST', body: { pin: code } })
    await navigateTo('/')
  } catch (e) {
    const err = e as { statusCode?: number, statusMessage?: string }
    pin.value = [] as number[]
    if (err.statusCode === 429) {
      lockedUntil.value = err.statusMessage ?? 'Too many attempts.'
    } else if (err.statusCode === 401) {
      error.value = 'Incorrect PIN. Please try again.'
    } else {
      error.value = err.statusMessage ?? 'Something went wrong.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <UCard>
    <h2 class="mb-1 text-xl font-semibold text-highlighted">
      Enter your PIN
    </h2>
    <p class="mb-6 text-sm text-muted">
      Enter your 6-digit PIN to access Cortex.
    </p>

    <UAlert
      v-if="lockedUntil"
      color="error"
      variant="subtle"
      icon="i-lucide-lock"
      title="Account locked"
      :description="lockedUntil"
      class="mb-4"
    />

    <form
      class="space-y-4"
      @submit.prevent="submit"
    >
      <UFormField label="PIN">
        <UPinInput
          v-model="pin"
          type="number"
          mask
          otp
          :length="6"
          autofocus
          size="xl"
          :disabled="isLoading || !!lockedUntil"
          :highlight="!!error"
          @complete="submit"
        />
      </UFormField>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-x"
        :title="error"
      />

      <UButton
        type="submit"
        class="w-full"
        :loading="isLoading"
        :disabled="!isComplete || !!lockedUntil"
        icon="i-lucide-log-in"
        trailing
      >
        Sign in
      </UButton>
    </form>

    <template #footer>
      <div class="text-center">
        <UButton
          variant="link"
          color="neutral"
          size="sm"
          @click="navigateTo('/recover')"
        >
          Forgot PIN?
        </UButton>
      </div>
    </template>
  </UCard>
</template>
