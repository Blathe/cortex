<script setup lang="ts">
import type { DashboardPrefs } from '~/types/cortex'

const { save, loadAndApply } = useCortexDashboard()
const colorMode = useColorMode()
const toast = useToast()

const state = reactive<DashboardPrefs>({
  primaryColor: 'green',
  timezone: 'UTC',
  dateFormat: 'absolute'
})

const colorOptions = [
  { label: 'Green', value: 'green', hex: '#22c55e' },
  { label: 'Blue', value: 'blue', hex: '#3b82f6' },
  { label: 'Violet', value: 'violet', hex: '#8b5cf6' },
  { label: 'Red', value: 'red', hex: '#ef4444' },
  { label: 'Orange', value: 'orange', hex: '#f97316' },
  { label: 'Pink', value: 'pink', hex: '#ec4899' },
  { label: 'Teal', value: 'teal', hex: '#14b8a6' },
  { label: 'Sky', value: 'sky', hex: '#0ea5e9' },
  { label: 'Amber', value: 'amber', hex: '#f59e0b' },
  { label: 'Rose', value: 'rose', hex: '#f43f5e' }
]

const colorModeItems = [
  { label: 'System', value: 'system', icon: 'i-lucide-monitor' },
  { label: 'Light', value: 'light', icon: 'i-lucide-sun' },
  { label: 'Dark', value: 'dark', icon: 'i-lucide-moon' }
]

const timezoneItems = [
  { label: 'UTC', value: 'UTC' },
  { label: 'New York (ET)', value: 'America/New_York' },
  { label: 'Chicago (CT)', value: 'America/Chicago' },
  { label: 'Denver (MT)', value: 'America/Denver' },
  { label: 'Los Angeles (PT)', value: 'America/Los_Angeles' },
  { label: 'Anchorage (AKT)', value: 'America/Anchorage' },
  { label: 'Honolulu (HT)', value: 'Pacific/Honolulu' },
  { label: 'Toronto', value: 'America/Toronto' },
  { label: 'São Paulo', value: 'America/Sao_Paulo' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
  { label: 'Berlin', value: 'Europe/Berlin' },
  { label: 'Moscow', value: 'Europe/Moscow' },
  { label: 'Cairo', value: 'Africa/Cairo' },
  { label: 'Dubai', value: 'Asia/Dubai' },
  { label: 'Mumbai', value: 'Asia/Kolkata' },
  { label: 'Bangkok', value: 'Asia/Bangkok' },
  { label: 'Shanghai', value: 'Asia/Shanghai' },
  { label: 'Tokyo', value: 'Asia/Tokyo' },
  { label: 'Seoul', value: 'Asia/Seoul' },
  { label: 'Sydney', value: 'Australia/Sydney' },
  { label: 'Auckland', value: 'Pacific/Auckland' }
]

const dateFormatItems = [
  { label: 'Absolute  —  Jan 24, 2026, 2:30 PM', value: 'absolute' },
  { label: 'Relative  —  3 hours ago', value: 'relative' }
]

const now = ref(new Date())
let ticker: ReturnType<typeof setInterval>

const previewDate = computed(() => {
  const tz = state.timezone
  if (state.dateFormat === 'relative') {
    return 'just now'
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(now.value)
})

const onSave = () => {
  save({ ...state })
  toast.add({ title: 'Dashboard preferences saved', color: 'success' })
}

const syncFromPrefs = (p: DashboardPrefs) => {
  state.primaryColor = p.primaryColor
  state.timezone = p.timezone
  state.dateFormat = p.dateFormat
}

onMounted(() => {
  const loaded = loadAndApply()
  syncFromPrefs(loaded)
  ticker = setInterval(() => {
    now.value = new Date()
  }, 30_000)
})

onUnmounted(() => clearInterval(ticker))
</script>

<template>
  <UContainer class="py-6 md:py-8">
    <div class="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Customize appearance and display preferences."
      />

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div class="space-y-6">
          <!-- Appearance -->
          <UCard>
            <template #header>
              <div class="space-y-1">
                <p class="text-sm font-medium text-highlighted">
                  Appearance
                </p>
                <p class="text-xs text-muted">
                  Choose a color scheme and light/dark mode.
                </p>
              </div>
            </template>

            <div class="space-y-6">
              <section class="space-y-3">
                <h3 class="text-sm font-semibold text-highlighted">
                  Color mode
                </h3>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="item in colorModeItems"
                    :key="item.value"
                    :icon="item.icon"
                    :label="item.label"
                    :color="colorMode.preference === item.value ? 'primary' : 'neutral'"
                    :variant="colorMode.preference === item.value ? 'solid' : 'outline'"
                    size="sm"
                    @click="colorMode.preference = item.value"
                  />
                </div>
              </section>

              <USeparator />

              <section class="space-y-3">
                <h3 class="text-sm font-semibold text-highlighted">
                  Primary color
                </h3>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="color in colorOptions"
                    :key="color.value"
                    type="button"
                    class="relative size-8 rounded-full ring-offset-2 transition-all focus:outline-none"
                    :class="state.primaryColor === color.value ? 'ring-2 ring-offset-[var(--ui-bg)]' : 'hover:scale-110'"
                    :style="{ 'backgroundColor': color.hex, '--tw-ring-color': color.hex }"
                    :aria-label="color.label"
                    :title="color.label"
                    @click="state.primaryColor = color.value"
                  >
                    <UIcon
                      v-if="state.primaryColor === color.value"
                      name="i-lucide-check"
                      class="absolute inset-0 m-auto size-4 text-white"
                    />
                  </button>
                </div>
                <p class="text-xs text-muted">
                  Selected: <span class="font-medium text-highlighted capitalize">{{ state.primaryColor }}</span>
                </p>
              </section>
            </div>
          </UCard>

          <!-- Date & Time -->
          <UCard>
            <template #header>
              <div class="space-y-1">
                <p class="text-sm font-medium text-highlighted">
                  Date &amp; Time
                </p>
                <p class="text-xs text-muted">
                  Control how dates and times are displayed across the dashboard.
                </p>
              </div>
            </template>

            <div class="space-y-6">
              <section class="space-y-3">
                <UFormField
                  label="Timezone"
                  name="timezone"
                >
                  <USelect
                    v-model="state.timezone"
                    :items="timezoneItems"
                    value-key="value"
                  />
                </UFormField>
              </section>

              <section class="space-y-3">
                <UFormField
                  label="Date format"
                  name="dateFormat"
                >
                  <USelect
                    v-model="state.dateFormat"
                    :items="dateFormatItems"
                    value-key="value"
                  />
                </UFormField>
              </section>
            </div>
          </UCard>

          <div class="flex justify-end">
            <UButton @click="onSave">
              Save preferences
            </UButton>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-4">
          <UCard>
            <template #header>
              <p class="text-sm font-medium text-highlighted">
                Preview
              </p>
            </template>
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">Current time</span>
                <span class="text-xs font-medium text-highlighted">{{ previewDate }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">Timezone</span>
                <UBadge
                  :label="state.timezone"
                  color="neutral"
                  variant="subtle"
                />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">Color mode</span>
                <UBadge
                  :label="colorMode.preference"
                  color="neutral"
                  variant="subtle"
                />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted">Primary color</span>
                <div class="flex items-center gap-2">
                  <span
                    class="inline-block size-3 rounded-full"
                    :style="{ backgroundColor: colorOptions.find(c => c.value === state.primaryColor)?.hex ?? '#22c55e' }"
                  />
                  <span class="text-xs font-medium text-highlighted capitalize">{{ state.primaryColor }}</span>
                </div>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <p class="text-sm font-medium text-highlighted">
                Notes
              </p>
            </template>
            <div class="space-y-2 text-sm text-muted">
              <p>Preferences are stored in browser local storage under <code>cortex.dashboard.v1</code>.</p>
              <p>Color mode follows the system setting when set to "System".</p>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </UContainer>
</template>
