<template>
  <div class="flex h-dvh items-center justify-center overflow-hidden bg-default p-6">
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
      <slot />
    </div>
  </div>
</template>
