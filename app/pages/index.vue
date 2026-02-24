<template>
  <UContainer class="py-6 md:py-8">
    <div class="mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col justify-center">
      <UPageHero
        title="Welcome to Cortex"
        description="This is a mock landing screen for the autonomous agent interface."
        class="pb-8"
      />

      <div class="grid gap-4 md:grid-cols-3">
        <UButton
          to="/chat"
          label="Open Chat"
          icon="i-lucide-messages-square"
          color="primary"
          variant="solid"
          size="xl"
          class="h-24 justify-center text-base"
          block
        />
        <UButton
          to="/config"
          label="Open Config"
          icon="i-lucide-sliders-horizontal"
          color="neutral"
          variant="soft"
          size="xl"
          class="h-24 justify-center text-base"
          block
        />
        <UButton
          to="/jobs"
          label="Open Jobs"
          icon="i-lucide-workflow"
          color="neutral"
          variant="outline"
          size="xl"
          class="h-24 justify-center text-base"
          block
        />
      </div>
    </div>
  </UContainer>
</template>
