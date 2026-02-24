<script setup lang="ts">
import type { AgentConfigProposal } from '~/types/cortex'

const props = defineProps<{
  messageId: string
  proposal: AgentConfigProposal
}>()

const emit = defineEmits<{
  dismiss: [messageId: string]
}>()

const toast = useToast()
const isPending = ref(false)

const riskColor = computed(() => props.proposal.riskLevel === 'low' ? 'success' : 'warning')

const flattenPatch = (obj: Record<string, unknown>, prefix = ''): Array<{ path: string, value: unknown }> => {
  const result: Array<{ path: string, value: unknown }> = []
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key
    const val = obj[key]
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      result.push(...flattenPatch(val as Record<string, unknown>, full))
    } else {
      result.push({ path: full, value: val })
    }
  }
  return result
}

const patchFields = computed(() => flattenPatch(props.proposal.patch))

const confirm = async () => {
  isPending.value = true
  try {
    await $fetch('/api/agent/config', {
      method: 'POST',
      body: {
        patch: props.proposal.patch,
        reason: props.proposal.reason,
        source: 'agent'
      }
    })
    toast.add({
      title: 'Config updated',
      description: 'Agent settings have been applied.',
      color: 'success'
    })
    emit('dismiss', props.messageId)
  } catch (error) {
    const fetchError = error as { statusMessage?: string, data?: { message?: string } }
    toast.add({
      title: 'Config update failed',
      description: fetchError.data?.message || fetchError.statusMessage || 'Failed to apply config change.',
      color: 'error'
    })
  } finally {
    isPending.value = false
  }
}

const dismiss = () => {
  emit('dismiss', props.messageId)
}
</script>

<template>
  <div class="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 text-sm space-y-3">
    <div class="flex items-center gap-2">
      <UIcon
        name="i-lucide-settings-2"
        class="text-slate-500 size-4 shrink-0"
      />
      <span class="font-medium text-slate-700 dark:text-slate-200">Proposed config change</span>
      <UBadge
        :label="proposal.riskLevel"
        :color="riskColor"
        variant="subtle"
        size="sm"
        class="ml-auto"
      />
    </div>

    <div
      v-if="patchFields.length"
      class="space-y-1"
    >
      <div
        v-for="field in patchFields"
        :key="field.path"
        class="flex items-center gap-2 font-mono text-xs text-slate-600 dark:text-slate-300"
      >
        <span class="text-slate-400">{{ field.path }}</span>
        <span class="text-slate-400">→</span>
        <span class="font-semibold">{{ String(field.value) }}</span>
      </div>
    </div>

    <p
      v-if="proposal.reason"
      class="text-slate-500 dark:text-slate-400 italic"
    >
      {{ proposal.reason }}
    </p>

    <div class="flex gap-2 pt-1">
      <UButton
        label="Confirm"
        color="primary"
        variant="solid"
        size="sm"
        :loading="isPending"
        icon="i-lucide-check"
        @click="confirm"
      />
      <UButton
        label="Dismiss"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="isPending"
        icon="i-lucide-x"
        @click="dismiss"
      />
    </div>
  </div>
</template>
