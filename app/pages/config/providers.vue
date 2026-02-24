<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CortexProvider } from '~/types/cortex'

const { providers, activeProviderId, loadProviders, addProvider, updateProvider, deleteProvider, setActive } = useCortexProviders()
const toast = useToast()

onMounted(() => loadProviders())

// Modal state
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const isSaving = ref(false)

const formState = reactive({
  name: '',
  baseUrl: '',
  apiKey: '',
  models: [] as string[]
})

const modalTitle = computed(() => editingId.value ? 'Edit provider' : 'Add provider')

const openAdd = () => {
  editingId.value = null
  formState.name = ''
  formState.baseUrl = ''
  formState.apiKey = ''
  formState.models = ['']
  modalOpen.value = true
}

const openEdit = (provider: CortexProvider) => {
  editingId.value = provider.id
  formState.name = provider.name
  formState.baseUrl = provider.baseUrl
  formState.apiKey = '' // never pre-fill — leave blank to keep existing key on server
  formState.models = [...provider.models]
  modalOpen.value = true
}

const addModelEntry = () => {
  formState.models.push('')
}

const removeModelEntry = (index: number) => {
  formState.models.splice(index, 1)
}

const onSave = async () => {
  isSaving.value = true
  try {
    const cleanModels = formState.models.map(m => m.trim()).filter(Boolean)
    const payload = {
      name: formState.name.trim(),
      baseUrl: formState.baseUrl.trim(),
      apiKey: formState.apiKey.trim(), // empty = keep existing key on server
      models: cleanModels
    }

    if (editingId.value) {
      await updateProvider(editingId.value, payload)
      toast.add({ title: 'Provider updated', color: 'success' })
    } else {
      await addProvider(payload)
      toast.add({ title: 'Provider added', color: 'success' })
    }

    modalOpen.value = false
  } catch (e) {
    const err = e as { statusMessage?: string }
    toast.add({ title: 'Failed to save provider', description: err.statusMessage ?? 'Unknown error', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

const onDelete = async (provider: CortexProvider) => {
  try {
    await deleteProvider(provider.id)
    toast.add({
      title: 'Provider deleted',
      description: `"${provider.name}" has been removed.`,
      color: 'warning'
    })
  } catch (e) {
    const err = e as { statusMessage?: string }
    toast.add({ title: 'Failed to delete provider', description: err.statusMessage ?? 'Unknown error', color: 'error' })
  }
}

const onSetActive = async (provider: CortexProvider) => {
  try {
    await setActive(provider.id)
    toast.add({
      title: 'Active provider set',
      description: `"${provider.name}" is now active.`,
      color: 'success'
    })
  } catch (e) {
    const err = e as { statusMessage?: string }
    toast.add({ title: 'Failed to set active provider', description: err.statusMessage ?? 'Unknown error', color: 'error' })
  }
}

const columns: TableColumn<CortexProvider>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'baseUrl', header: 'Base URL' },
  { accessorKey: 'models', header: 'Models' },
  { accessorKey: 'apiKeySet', header: 'API Key' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <div>
    <UContainer class="py-6 md:py-8">
      <div class="space-y-6">
        <PageHeader
          title="Providers"
          description="Manage LLM provider endpoints. Set one active to use it in chat."
        />

        <div class="flex justify-end">
          <UButton
            icon="i-lucide-plus"
            @click="openAdd"
          >
            Add provider
          </UButton>
        </div>

        <UTable
          :data="providers"
          :columns="columns"
        >
          <template #name-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ row.original.name }}</span>
              <UBadge
                v-if="row.original.id === activeProviderId"
                label="active"
                color="primary"
                size="xs"
              />
            </div>
          </template>

          <template #baseUrl-cell="{ row }">
            <span class="max-w-xs truncate text-sm text-muted">{{ row.original.baseUrl || '—' }}</span>
          </template>

          <template #models-cell="{ row }">
            <UBadge
              :label="`${row.original.models.length} model${row.original.models.length === 1 ? '' : 's'}`"
              color="neutral"
              variant="subtle"
              size="xs"
            />
          </template>

          <template #apiKeySet-cell="{ row }">
            <UBadge
              :label="row.original.apiKeySet ? 'Set' : 'Not set'"
              :color="row.original.apiKeySet ? 'success' : 'neutral'"
              variant="subtle"
              size="xs"
            />
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <UButton
                v-if="row.original.id !== activeProviderId"
                label="Set active"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="onSetActive(row.original)"
              />

              <UButton
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Edit"
                @click="openEdit(row.original)"
              />

              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Delete"
                :disabled="providers.length <= 1"
                @click="onDelete(row.original)"
              />
            </div>
          </template>
        </UTable>
      </div>
    </UContainer>

    <UModal
      v-model:open="modalOpen"
      :title="modalTitle"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField
            label="Name"
            required
          >
            <UInput
              v-model="formState.name"
              placeholder="OpenAI"
            />
          </UFormField>

          <UFormField
            label="Base URL"
            required
          >
            <UInput
              v-model="formState.baseUrl"
              placeholder="https://api.openai.com/v1"
            />
          </UFormField>

          <UFormField
            label="API Key"
            :hint="editingId ? 'Leave blank to keep existing key' : 'Optional'"
          >
            <UInput
              v-model="formState.apiKey"
              type="password"
              autocomplete="off"
              placeholder="sk-..."
            />
          </UFormField>

          <UFormField label="Models">
            <div class="space-y-2">
              <div
                v-for="(_, i) in formState.models"
                :key="i"
                class="flex items-center gap-2"
              >
                <UInput
                  v-model="formState.models[i]"
                  placeholder="gpt-4o"
                  class="flex-1"
                />
                <UButton
                  icon="i-lucide-x"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  aria-label="Remove model"
                  :disabled="formState.models.length <= 1"
                  @click="removeModelEntry(i)"
                />
              </div>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-plus"
                @click="addModelEntry"
              >
                Add model
              </UButton>
            </div>
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="modalOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            :loading="isSaving"
            @click="onSave"
          >
            Save
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
