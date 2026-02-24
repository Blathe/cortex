<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { CortexJobLog, LogLevel } from '~/types/cortex'

const { logs } = useCortexJobs()

const UBadge = resolveComponent('UBadge')

const levelColor = (level: LogLevel) => ({
  info: 'primary' as const,
  warn: 'warning' as const,
  error: 'error' as const,
  debug: 'neutral' as const
}[level])

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

const columns: TableColumn<CortexJobLog>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => h('span', { class: 'text-sm font-mono text-muted' }, formatDate(row.getValue('timestamp')))
  },
  {
    accessorKey: 'level',
    header: 'Level',
    cell: ({ row }) => {
      const level = row.getValue('level') as LogLevel
      return h(UBadge, { variant: 'subtle', color: levelColor(level), class: 'uppercase text-xs' }, () => level)
    }
  },
  {
    accessorKey: 'jobName',
    header: 'Job',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, row.getValue('jobName'))
  },
  {
    accessorKey: 'message',
    header: 'Message',
    cell: ({ row }) => h('span', { class: 'text-sm font-mono' }, row.getValue('message'))
  }
]

// Sorted newest-first
const sortedLogs = computed(() => {
  return [...logs.value].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
})
</script>

<template>
  <UContainer class="py-6">
    <PageHeader
      title="Logs"
      description="A stream of log output from all agent jobs, sorted newest first."
    />

    <UCard>
      <UTable
        :data="sortedLogs"
        :columns="columns"
      />
    </UCard>
  </UContainer>
</template>
