<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { CortexJob, JobStatus, JobType } from '~/types/cortex'

const { jobs } = useCortexJobs()

const UBadge = resolveComponent('UBadge')

const stats = computed(() => ({
  total: jobs.value.length,
  running: jobs.value.filter(j => j.status === 'running').length,
  completed: jobs.value.filter(j => j.status === 'completed').length,
  failed: jobs.value.filter(j => j.status === 'failed').length
}))

const statusColor = (status: JobStatus) => ({
  running: 'info' as const,
  completed: 'success' as const,
  failed: 'error' as const,
  pending: 'neutral' as const
}[status])

const typeLabel = (type: JobType): string => ({
  task: 'Task',
  scrape: 'Scrape',
  analysis: 'Analysis',
  sync: 'Sync'
}[type])

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  })
}

const formatDuration = (secs: number | null) => {
  if (secs === null) return '—'
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

const columns: TableColumn<CortexJob>[] = [
  {
    accessorKey: 'name',
    header: 'Job'
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted capitalize' }, typeLabel(row.getValue('type')))
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as JobStatus
      return h(UBadge, { variant: 'subtle', color: statusColor(status), class: 'capitalize' }, () => status)
    }
  },
  {
    accessorKey: 'progress',
    header: 'Progress',
    cell: ({ row }) => {
      const progress = row.getValue('progress') as number | null
      if (progress === null) return h('span', { class: 'text-sm text-muted' }, '—')
      return h('span', { class: 'text-sm font-mono' }, `${progress}%`)
    }
  },
  {
    accessorKey: 'startedAt',
    header: 'Started',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDate(row.getValue('startedAt')))
  },
  {
    accessorKey: 'durationSecs',
    header: 'Duration',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDuration(row.getValue('durationSecs')))
  }
]
</script>

<template>
  <UContainer class="py-6">
    <!-- Stats row -->
    <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <UCard>
        <p class="text-2xl font-bold text-highlighted">
          {{ stats.total }}
        </p>
        <p class="text-sm text-muted">
          Total
        </p>
      </UCard>
      <UCard>
        <p class="text-2xl font-bold text-info">
          {{ stats.running }}
        </p>
        <p class="text-sm text-muted">
          Running
        </p>
      </UCard>
      <UCard>
        <p class="text-2xl font-bold text-success">
          {{ stats.completed }}
        </p>
        <p class="text-sm text-muted">
          Completed
        </p>
      </UCard>
      <UCard>
        <p class="text-2xl font-bold text-error">
          {{ stats.failed }}
        </p>
        <p class="text-sm text-muted">
          Failed
        </p>
      </UCard>
    </div>

    <!-- Jobs table -->
    <UCard>
      <UTable
        :data="jobs"
        :columns="columns"
      />
    </UCard>
  </UContainer>
</template>
