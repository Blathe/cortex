<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-highlighted">
      {{ title }}
    </h1>
    <p
      v-if="description"
      class="mt-1 text-sm text-muted"
    >
      {{ description }}
    </p>
  </div>
</template>
