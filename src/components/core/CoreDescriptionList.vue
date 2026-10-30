<!--
  CoreDescriptionList: label/value pairs in a grid of as many columns as fit. Pairs without a
  value are left out, so a field nobody filled in takes no room.

  <CoreDescriptionList title="Execution data" :items="[
    { label: 'User', value: 'Ana García' },
    { label: 'Finished', value: '—', muted: true },
  ]" />
-->
<template>
  <section class="core-description-list">
    <h3 v-if="title" class="core-description-list__title">{{ title }}</h3>
    <dl
      class="core-description-list__grid"
      :style="{
        gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`,
      }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.label"
        class="core-description-list__item"
      >
        <dt class="core-description-list__label">{{ item.label }}</dt>
        <dd
          :class="['core-description-list__value', { 'is-muted': item.muted }]"
        >
          {{ item.value }}
        </dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'CoreDescriptionList' })

export interface DescriptionItem {
  label: string
  value: string | number | null | undefined
  /** Greyed out: a placeholder such as "—" for something that has not happened yet. */
  muted?: boolean
}

const props = withDefaults(
  defineProps<{
    title?: string
    items: DescriptionItem[]
    minColumnWidth?: number
  }>(),
  { title: '', minColumnWidth: 160 },
)

const visibleItems = computed(() =>
  props.items.filter(
    (item) =>
      item.value !== null && item.value !== undefined && item.value !== '',
  ),
)
</script>

<style scoped>
.core-description-list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3.5);
  font-family: var(--font-sans);
}

.core-description-list__title {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.core-description-list__grid {
  display: grid;
  gap: calc(var(--spacing) * 4) calc(var(--spacing) * 6);
  margin: 0;
}

.core-description-list__item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.core-description-list__label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.core-description-list__value {
  margin: 0;
  font-size: var(--text-md);
  line-height: 18px;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.core-description-list__value.is-muted {
  color: var(--color-text-subtle);
}
</style>
