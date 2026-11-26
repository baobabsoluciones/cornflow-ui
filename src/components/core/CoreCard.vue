<!--
  CoreCard: a block of a page (a chart, a table, a group of figures) on a white surface, with its
  title, an optional subtitle (the unit or the scope of what it shows) and an optional icon.

  - `actions` slot: buttons or controls beside the title.
  - `flush`: the body goes edge to edge, for a table that draws its own padding.
  - `footer` slot: a line under the body (a legend, a total).

  <CoreCard title="Production per day" subtitle="Units" icon="mdi-chart-bar">
    <template #actions><CoreSegmentedControl … /></template>
    …
  </CoreCard>
-->
<template>
  <section class="core-card" :class="{ 'core-card--flush': flush }">
    <header v-if="title || $slots.actions" class="core-card__header">
      <span v-if="icon" class="core-card__icon">
        <CoreIcon :name="icon" :size="18" />
      </span>
      <div class="core-card__heading">
        <h2 v-if="title" class="core-card__title">{{ title }}</h2>
        <p v-if="subtitle" class="core-card__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="core-card__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="core-card__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="core-card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'CoreCard' })

withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    icon?: string
    flush?: boolean
  }>(),
  { title: '', subtitle: '', icon: '', flush: false },
)
</script>

<style scoped>
.core-card {
  --core-card-padding: calc(var(--spacing) * 5);
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  color: var(--color-text);
  font-family: var(--font-sans);
}

.core-card__header {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  padding: var(--core-card-padding) var(--core-card-padding) 0;
}

.core-card__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.core-card__heading {
  flex: 1;
  min-width: 0;
}

.core-card__title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  line-height: var(--leading-tight);
}

.core-card__subtitle {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.core-card__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: calc(var(--spacing) * 2);
}

.core-card__body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: calc(var(--spacing) * 4) var(--core-card-padding) var(--core-card-padding);
}

.core-card--flush .core-card__body {
  padding: calc(var(--spacing) * 4) 0 0;
}

.core-card__footer {
  padding: calc(var(--spacing) * 3) var(--core-card-padding);
  border-top: 1px solid var(--color-divider);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
