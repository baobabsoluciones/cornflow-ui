<!--
  CoreStat: one figure with its label ("1,240 · Units short"). The value is given already
  formatted, so the page decides the number format and the unit.

  - `tone`: colours the value; leave it out for a plain figure. Keep it for what needs attention, so
    a coloured figure stands out.
  - `icon`: a small icon before the label.
  - `caption`: a short line under the value (the comparison, the unit).
  - `size`: `large` for the headline figures of a page, `default` inside a card or a panel.

  It is a term and its description: it goes inside a `<dl>`, one per group of figures.

  <CoreStat value="1,240" label="Units short" tone="danger" />
  <CoreStat value="96%" label="Capacity used" caption="of 2,200 a week" size="large" />
-->
<template>
  <div
    class="core-stat"
    :class="[`core-stat--${size}`, tone ? `core-tone--${tone} core-stat--toned` : '']"
  >
    <dt class="core-stat__label">
      <CoreIcon v-if="icon" :name="icon" :size="14" class="core-stat__icon" />
      <span>{{ label }}</span>
    </dt>
    <dd class="core-stat__value">{{ value }}</dd>
    <dd v-if="caption" class="core-stat__caption">{{ caption }}</dd>
  </div>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import type { CoreTone } from '@cornflow-ui/core/types/ui'

defineOptions({ name: 'CoreStat' })

/** A figure as the components that show several of them take it. */
export interface CoreStatItem {
  value: string
  label: string
  tone?: CoreTone
  icon?: string
  caption?: string
}

withDefaults(
  defineProps<{
    value: string
    label: string
    tone?: CoreTone
    icon?: string
    caption?: string
    size?: 'default' | 'large'
  }>(),
  { tone: undefined, icon: '', caption: '', size: 'default' },
)
</script>

<style scoped>
.core-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  margin: 0;
  font-family: var(--font-sans);
}

.core-stat__label {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  order: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.core-stat__icon {
  color: var(--color-text-subtle);
}

.core-stat__value {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-weight-medium);
  line-height: var(--leading-tight);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.core-stat__caption {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}

.core-stat--large .core-stat__value {
  font-size: 1.75rem;
}

.core-stat--toned .core-stat__value,
.core-stat--toned .core-stat__icon {
  color: var(--tone-strong);
}
</style>
