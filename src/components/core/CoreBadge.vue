<!--
  CoreBadge: a short status or tag ("Success", "Current plan", "Replanning").

  Variants:
  - soft (default): a pill with a soft background in the tone, icon optional.
  - dot: a coloured dot and the text, for dense rows.

  <CoreBadge tone="success" icon="mdi-check-circle" label="Success" />
  <CoreBadge tone="warning" icon="mdi-star" label="Current plan" size="sm" />
  <CoreBadge tone="danger" variant="dot" label="Infeasible" />
  <CoreBadge tone="primary" spin label="Running" />
-->
<template>
  <span
    :class="[
      'core-badge',
      `core-badge--${variant}`,
      `core-badge--${size}`,
      `core-badge--${tone}`,
    ]"
  >
    <span v-if="variant === 'dot'" class="core-badge__dot" />
    <CoreSpinner
      v-else-if="spin"
      :size="size === 'sm' ? 10 : 12"
      class="core-badge__icon"
    />
    <CoreIcon v-else-if="icon" :name="icon" class="core-badge__icon" />
    <span class="core-badge__label"
      ><slot>{{ label }}</slot></span
    >
  </span>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import type { CoreTone } from '@cornflow-ui/core/types/ui'

defineOptions({ name: 'CoreBadge' })

withDefaults(
  defineProps<{
    label?: string
    tone?: CoreTone
    icon?: string
    /** Something in progress: a spinner instead of the icon. */
    spin?: boolean
    variant?: 'soft' | 'dot'
    size?: 'sm' | 'md'
  }>(),
  {
    label: '',
    tone: 'neutral',
    icon: undefined,
    spin: false,
    variant: 'soft',
    size: 'md',
  },
)
</script>

<style scoped>
.core-badge {
  --badge-base: var(--color-neutral);
  --badge-soft: var(--color-neutral-soft);
  --badge-strong: var(--color-neutral-strong);

  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.25);
  min-width: 0;
  max-width: 100%;
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  color: var(--badge-strong);
}

.core-badge--primary {
  --badge-base: var(--color-primary);
  --badge-soft: var(--color-primary-subtle);
  --badge-strong: var(--color-primary);
}

.core-badge--info {
  --badge-base: var(--color-info);
  --badge-soft: var(--color-info-soft);
  --badge-strong: var(--color-info-strong);
}

.core-badge--success {
  --badge-base: var(--color-success);
  --badge-soft: var(--color-success-soft);
  --badge-strong: var(--color-success-strong);
}

.core-badge--warning {
  --badge-base: var(--color-warning);
  --badge-soft: var(--color-warning-soft);
  --badge-strong: var(--color-warning-strong);
}

.core-badge--danger {
  --badge-base: var(--color-danger);
  --badge-soft: var(--color-danger-soft);
  --badge-strong: var(--color-danger-strong);
}

.core-badge--soft {
  border-radius: var(--radius-full);
  background: var(--badge-soft);
}

.core-badge--soft.core-badge--md {
  padding: 3px 10px 3px 7px;
  font-size: var(--text-sm);
  line-height: 16px;
}

.core-badge--soft.core-badge--sm {
  gap: calc(var(--spacing) * 0.75);
  padding: 1px 6px 1px 4px;
  font-size: var(--text-xs);
  line-height: 14px;
}

.core-badge--soft:not(:has(.core-badge__icon)) {
  padding-inline: 8px;
}

.core-badge--md .core-badge__icon {
  font-size: 15px;
}

.core-badge--sm .core-badge__icon {
  font-size: 12px;
}

.core-badge--dot {
  font-size: var(--text-sm);
}

.core-badge__dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: var(--radius-full);
  background: var(--badge-base);
}

.core-badge__label {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
