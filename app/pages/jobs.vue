<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()

const subNav = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Dashboard',
    icon: 'i-lucide-layout-dashboard',
    to: '/jobs',
    active: route.path === '/jobs'
  },
  {
    label: 'Logs',
    icon: 'i-lucide-scroll-text',
    to: '/jobs/logs',
    active: route.path === '/jobs/logs'
  },
  {
    label: 'Crons',
    icon: 'i-lucide-clock',
    to: '/jobs/crons',
    active: route.path === '/jobs/crons'
  }
])
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="shrink-0 px-4">
      <UNavigationMenu
        :items="subNav"
        orientation="horizontal"
        highlight
        highlight-color="primary"
        class="w-full border-b border-default"
      />
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <NuxtPage />
    </div>
  </div>
</template>
