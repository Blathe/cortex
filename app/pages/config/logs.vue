<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { AgentChangeLog } from '~/types/cortex'

const { data: changeLogData, pending } = await useAsyncData(
  'agent-logs',
  () => $fetch('/api/agent/logs'),
  { server: false }
)
const changeLogs = computed<AgentChangeLog[]>(() => changeLogData.value?.logs ?? [])

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

function patchSummary(patch: Record<string, unknown>, prefix = ''): string {
  return Object.entries(patch).map(([key, val]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      return patchSummary(val as Record<string, unknown>, fullKey)
    }
    return `${fullKey} → ${JSON.stringify(val)}`
  }).join(', ')
}

const columns: TableColumn<AgentChangeLog>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => h('span', { class: 'text-sm font-mono text-muted' }, formatDate(row.getValue('timestamp')))
  },
  {
    accessorKey: 'changedBy',
    header: 'Changed By',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, row.getValue('changedBy'))
  },
  {
    accessorKey: 'patch',
    header: 'Change',
    cell: ({ row }) => h('span', { class: 'text-sm font-mono' }, patchSummary(row.getValue('patch')))
  },
  {
    accessorKey: 'reason',
    header: 'Reason',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.getValue('reason'))
  }
]
</script>

<template>
  <UContainer class="py-6">
    <PageHeader
      title="Config Changelogs"
      description="A history of agent configuration changes applied via chat."
    />

    <UCard>
      <template v-if="pending">
        <div class="flex items-center justify-center py-8 text-muted text-sm">
          Loading changelogs…
        </div>
      </template>
      <template v-else-if="changeLogs.length === 0">
        <div class="flex items-center justify-center py-8 text-muted text-sm">
          No changelogs yet.
        </div>
      </template>
      <UTable
        v-else
        :data="changeLogs"
        :columns="columns"
      />
    </UCard>
  </UContainer>
</template>
