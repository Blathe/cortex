<script setup lang="ts">
import { marked } from 'marked'

const props = defineProps<{ content: string }>()

const html = computed(() => marked.parse(props.content) as string)
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    class="prose prose-sm dark:prose-invert max-w-none"
    v-html="html"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>
