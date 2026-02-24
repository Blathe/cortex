<script setup lang="ts">
</script>

<template>
  <UContainer class="py-6 md:py-8">
    <PageHeader
      title="Sources"
      description="Manage data sources available to the agent."
    />

    <UCard>
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <UIcon
          name="i-lucide-database"
          class="mb-3 size-8 text-muted"
        />
        <p class="text-sm font-medium text-highlighted">
          No sources configured
        </p>
        <p class="mt-1 text-sm text-muted">
          Source integrations will appear here.
        </p>
      </div>
    </UCard>
  </UContainer>
</template>
