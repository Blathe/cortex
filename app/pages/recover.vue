<script setup lang="ts">
definePageMeta({ layout: false })

const recoveryCode = ref('')
const newPin = ref('')
const confirmPin = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const newRecoveryCode = ref<string | null>(null)
const acknowledged = ref(false)

const onSubmit = async () => {
  error.value = null

  if (!recoveryCode.value.trim()) {
    error.value = 'Recovery code is required.'
    return
  }

  if (!/^\d{6}$/.test(newPin.value)) {
    error.value = 'New PIN must be exactly 6 digits.'
    return
  }

  if (newPin.value !== confirmPin.value) {
    error.value = 'PINs do not match.'
    return
  }

  isLoading.value = true
  try {
    const res = await $fetch<{ recoveryCode: string }>('/api/agent/auth/recovery', {
      method: 'POST',
      body: {
        recoveryCode: recoveryCode.value.trim().toUpperCase(),
        newPin: newPin.value,
        confirmNewPin: confirmPin.value
      }
    })
    newRecoveryCode.value = res.recoveryCode
  } catch (e) {
    const err = e as { statusCode?: number, statusMessage?: string }
    if (err.statusCode === 410) {
      error.value = 'Recovery code has already been used. Contact your server administrator.'
    } else if (err.statusCode === 401) {
      error.value = 'Invalid recovery code.'
    } else {
      error.value = err.statusMessage ?? 'Something went wrong.'
    }
  } finally {
    isLoading.value = false
  }
}

const onComplete = () => {
  navigateTo('/')
}
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
            PIN Recovery
          </p>
        </div>
      </div>

      <!-- New recovery code display (post-reset) -->
      <UCard v-if="newRecoveryCode">
        <div class="text-center">
          <UIcon
            name="i-lucide-shield-check"
            class="mx-auto mb-3 size-10 text-primary"
          />
          <h2 class="mb-2 text-xl font-semibold text-highlighted">
            PIN reset successfully
          </h2>
          <p class="mb-6 text-sm text-muted">
            Save your new recovery code in a secure place. It will not be shown again.
          </p>
        </div>

        <div class="mb-6 rounded-md bg-elevated p-4 text-center">
          <p class="mb-1 text-xs text-muted">
            New recovery code
          </p>
          <code class="text-lg font-mono font-bold tracking-widest text-highlighted">
            {{ newRecoveryCode }}
          </code>
        </div>

        <UCheckbox
          v-model="acknowledged"
          label="I have saved my recovery code"
          class="mb-4"
        />

        <UButton
          class="w-full"
          :disabled="!acknowledged"
          icon="i-lucide-arrow-right"
          trailing
          @click="onComplete"
        >
          Continue to Cortex
        </UButton>
      </UCard>

      <!-- Recovery form -->
      <UCard v-else>
        <h2 class="mb-1 text-xl font-semibold text-highlighted">
          Recover access
        </h2>
        <p class="mb-6 text-sm text-muted">
          Enter the recovery code you saved during setup, then choose a new PIN.
        </p>

        <form
          class="space-y-4"
          @submit.prevent="onSubmit"
        >
          <UFormField
            label="Recovery Code"
            description="The 16-character code shown during initial setup."
          >
            <UInput
              v-model="recoveryCode"
              placeholder="ABCD-EFGH-JKLM-NPQR"
              autocomplete="off"
              class="w-full font-mono uppercase"
            />
          </UFormField>

          <UFormField label="New PIN">
            <UInput
              v-model="newPin"
              type="password"
              inputmode="numeric"
              placeholder="••••••"
              maxlength="6"
              class="w-full font-mono tracking-widest"
            />
          </UFormField>

          <UFormField label="Confirm New PIN">
            <UInput
              v-model="confirmPin"
              type="password"
              inputmode="numeric"
              placeholder="••••••"
              maxlength="6"
              class="w-full font-mono tracking-widest"
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
            icon="i-lucide-key-round"
            trailing
          >
            Reset PIN
          </UButton>
        </form>

        <template #footer>
          <div class="text-center">
            <UButton
              variant="link"
              color="neutral"
              size="sm"
              to="/login"
            >
              Back to sign in
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
