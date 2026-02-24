<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Cortex'
const description = 'Interface for the Cortex autonomous AI agent.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

const route = useRoute()

const routeLabelMap: Record<string, string> = {
  '/': 'Home',
  '/chat': 'Chat',
  '/config': 'Config',
  '/jobs': 'Jobs'
}

const currentPageLabel = computed(() => {
  if (route.path === '/') {
    return routeLabelMap['/']
  }

  const match = Object.keys(routeLabelMap).find(path => path !== '/' && route.path.startsWith(path))
  return match ? routeLabelMap[match] : 'Cortex'
})

const isActiveRoute = (to: string) => {
  if (to === '/') {
    return route.path === '/'
  }

  return route.path === to || route.path.startsWith(`${to}/`)
}

const navigationItems = computed(() => {
  return [[
    {
      label: 'Home',
      to: '/',
      icon: 'i-lucide-house',
      active: isActiveRoute('/')
    },
    {
      label: 'Chat',
      to: '/chat',
      icon: 'i-lucide-messages-square',
      active: isActiveRoute('/chat')
    },
    {
      label: 'Config',
      icon: 'i-lucide-sliders-horizontal',
      active: isActiveRoute('/config'),
      defaultOpen: isActiveRoute('/config'),
      children: [
        { label: 'Agent', to: '/config', icon: 'i-lucide-bot', active: route.path === '/config' },
        { label: 'Sources', to: '/config/sources', icon: 'i-lucide-database', active: route.path === '/config/sources' }
      ]
    },
    {
      label: 'Jobs',
      icon: 'i-lucide-workflow',
      active: isActiveRoute('/jobs'),
      defaultOpen: isActiveRoute('/jobs'),
      children: [
        { label: 'Dashboard', to: '/jobs', icon: 'i-lucide-layout-dashboard', active: route.path === '/jobs' },
        { label: 'Logs', to: '/jobs/logs', icon: 'i-lucide-scroll-text', active: route.path === '/jobs/logs' },
        { label: 'Crons', to: '/jobs/crons', icon: 'i-lucide-clock', active: route.path === '/jobs/crons' }
      ]
    }
  ]]
})
</script>

<template>
  <UApp>
    <UDashboardGroup
      class="min-h-dvh bg-elevated/20"
      :persistent="false"
      unit="rem"
    >
      <UDashboardSidebar
        collapsible
        :default-size="18"
        :collapsed-size="5"
      >
        <template #header="{ collapsed }">
          <NuxtLink
            to="/"
            class="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated"
          >
            <UIcon
              name="i-lucide-brain-circuit"
              class="size-5 text-primary"
            />

            <div v-if="!collapsed">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Cortex
              </p>
              <p class="text-sm font-semibold text-highlighted">
                Agent Console
              </p>
            </div>
          </NuxtLink>
        </template>

        <template #default="{ collapsed }">
          <UNavigationMenu
            :items="navigationItems"
            :collapsed="collapsed"
            orientation="vertical"
            highlight
            class="w-full"
          />
        </template>

        <template #footer="{ collapsed }">
          <div class="flex items-center justify-between gap-2">
            <span
              v-if="!collapsed"
              class="text-xs text-muted"
            >
              Cortex Dashboard - v0.1
            </span>
          </div>
        </template>
      </UDashboardSidebar>

      <UDashboardPanel
        id="cortex-main"
        :ui="{ body: 'p-0' }"
      >
        <template #header>
          <UDashboardNavbar
            :title="currentPageLabel"
            class="flex flex-row justify-between"
          >
            <template #leading>
              <UDashboardSidebarCollapse class="hidden md:inline-flex" />
              <UDashboardSidebarToggle class="md:hidden" />
            </template>

            <template #right>
              <UColorModeButton />
            </template>
          </UDashboardNavbar>
        </template>

        <template #body>
          <div class="h-full overflow-y-auto overflow-x-hidden">
            <NuxtPage />
          </div>
        </template>
      </UDashboardPanel>
    </UDashboardGroup>
  </UApp>
</template>
