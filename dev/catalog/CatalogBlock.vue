<!-- One component of the catalog: its name, its props, and its variants and states. -->
<template>
  <section class="catalog-block">
    <header class="catalog-block__header">
      <h2 class="catalog-block__name">{{ name }}</h2>
      <code v-if="api" class="catalog-block__api">{{ api }}</code>
    </header>
    <p v-if="note" class="catalog-block__note">{{ note }}</p>
    <div
      class="catalog-block__body"
      :class="{ 'catalog-block__body--column': column }"
    >
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    /** The props and events, in short. */
    api?: string
    note?: string
    /** Stacks the examples instead of laying them in a row. */
    column?: boolean
  }>(),
  { api: '', note: '', column: false },
)
</script>

<style scoped>
.catalog-block {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 5) calc(var(--spacing) * 6);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.catalog-block__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: calc(var(--spacing) * 2.5);
}

.catalog-block__name {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.catalog-block__api {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}

.catalog-block__note {
  margin: 0;
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

.catalog-block__body {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: calc(var(--spacing) * 3);
}

.catalog-block__body--column {
  flex-direction: column;
  align-items: stretch;
}
</style>
