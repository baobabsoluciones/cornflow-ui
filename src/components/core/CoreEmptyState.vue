<!--
  CoreEmptyState: what a list or panel shows when it has nothing to show (no data yet, no results
  for the filters, nothing selected), with an optional way out.

  <CoreEmptyState icon="mdi-filter-remove-outline" title="No execution matches the filters"
    text="Change the search or widen the dates." action-label="Clear filters" @action="clear" />
-->
<template>
  <div class="core-empty-state">
    <CoreIcon
      v-if="icon"
      :name="icon"
      :size="32"
      class="core-empty-state__icon"
    />
    <span class="core-empty-state__title">{{ title }}</span>
    <span v-if="text || $slots.default" class="core-empty-state__text">
      <slot>{{ text }}</slot>
    </span>
    <button
      v-if="actionLabel"
      type="button"
      class="core-empty-state__action"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'CoreEmptyState' })

withDefaults(
  defineProps<{
    title: string
    text?: string
    icon?: string
    actionLabel?: string
  }>(),
  { text: '', icon: '', actionLabel: '' },
)

const emit = defineEmits<{ action: [] }>()
</script>

<style scoped>
.core-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 12) calc(var(--spacing) * 6);
  font-family: var(--font-sans);
  text-align: center;
  color: var(--color-text-muted);
}

.core-empty-state__icon {
  color: var(--color-border-strong);
}

.core-empty-state__title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.core-empty-state__text {
  max-width: 360px;
  font-size: var(--text-md);
  text-wrap: pretty;
}

.core-empty-state__action {
  margin-top: calc(var(--spacing) * 1);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  cursor: pointer;
}

.core-empty-state__action:hover {
  text-decoration: underline;
}

.core-empty-state__action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
</style>
