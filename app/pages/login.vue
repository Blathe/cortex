<script setup lang="ts">
definePageMeta({ layout: false })

const pin = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const lockedUntil = ref<string | null>(null)

const pinInput = ref<HTMLInputElement | null>(null)

const onSubmit = async () => {
  error.value = null
  lockedUntil.value = null

  if (!/^\d{6}$/.test(pin.value)) {
    error.value = 'PIN must be exactly 6 digits.'
    return
  }

  isLoading.value = true
  try {
    await $fetch('/api/agent/auth/login', { method: 'POST', body: { pin: pin.value } })
    await navigateTo('/')
  } catch (e) {
    const err = e as { statusCode?: number, statusMessage?: string }
    pin.value = ''
    if (err.statusCode === 429) {
      lockedUntil.value = err.statusMessage ?? 'Too many attempts.'
    } else if (err.statusCode === 401) {
      error.value = 'Incorrect PIN. Please try again.'
    } else {
      error.value = err.statusMessage ?? 'Something went wrong.'
    }
    await nextTick()
    pinInput.value?.focus()
  } finally {
    isLoading.value = false
  }
}

const onForgotPin = () => {
  navigateTo('/recover')
}

onMounted(() => {
  pinInput.value?.focus()
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-default p-6">
    <div class="w-full max-w-sm">
      <div class="mb-8 flex items-center gap-3">
        <UIcon
          name="i-lucide-brain-circuit"
          class="size-8 text-primary"
        />
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Cortex
          </p>
          <p class="text-lg font-semibold text-highlighted">
            Agent Console
          </p>
        </div>
      </div>

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
          @submit.prevent="onSubmit"
        >
          <UFormField label="PIN">
            <UInput
              ref="pinInput"
              v-model="pin"
              type="password"
              inputmode="numeric"
              autocomplete="current-password"
              placeholder="••••••"
              maxlength="6"
              class="w-full font-mono tracking-widest"
              :disabled="isLoading || !!lockedUntil"
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
            :disabled="!!lockedUntil"
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
              @click="onForgotPin"
            >
              Forgot PIN?
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
