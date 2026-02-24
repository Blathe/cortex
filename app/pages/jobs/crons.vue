<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { CortexCron } from '~/types/cortex'

const { crons } = useCortexJobs()

const UBadge = resolveComponent('UBadge')

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  })
}

const columns: TableColumn<CortexCron>[] = [
  {
    accessorKey: 'name',
    header: 'Name'
  },
  {
    accessorKey: 'schedule',
    header: 'Schedule',
    cell: ({ row }) => h('code', { class: 'text-xs font-mono bg-elevated px-1.5 py-0.5 rounded' }, row.getValue('schedule'))
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, row.getValue('description'))
  },
  {
    accessorKey: 'enabled',
    header: 'Status',
    cell: ({ row }) => {
      const enabled = row.getValue('enabled') as boolean
      return h(UBadge, { variant: 'subtle', color: enabled ? 'success' as const : 'neutral' as const }, () => enabled ? 'Active' : 'Disabled')
    }
  },
  {
    accessorKey: 'lastRunAt',
    header: 'Last Run',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDate(row.getValue('lastRunAt')))
  },
  {
    accessorKey: 'nextRunAt',
    header: 'Next Run',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDate(row.getValue('nextRunAt')))
  },
  {
    accessorKey: 'lastStatus',
    header: 'Last Result',
    cell: ({ row }) => {
      const status = row.getValue('lastStatus') as 'success' | 'failed' | null
      if (!status) return h('span', { class: 'text-sm text-muted' }, '—')
      return h(UBadge, {
        variant: 'subtle',
        color: status === 'success' ? 'success' as const : 'error' as const,
        class: 'capitalize'
      }, () => status)
    }
  }
]
</script>

<template>
  <UContainer class="py-6">
    <PageHeader
      title="Crons"
      description="Scheduled jobs and their run history."
    />

    <UCard>
      <UTable
        :data="crons"
        :columns="columns"
      />
    </UCard>
  </UContainer>
</template>
