<!--
  CoreSegmentedControl: a row of joined buttons where one is picked, for switching between views
  or modes ("Summary | Side by side | Changes", "Excel | Database").

  - `v-model`: the value of the picked option.
  - Each option has a `label`, and optionally a `count` (shown after it), an `icon`, a `title`
    (tooltip) and `disabled`.
  - `variant`: `solid` (the picked one filled in the primary) or `soft` (a white pill on a grey
    track, for groups of tabs).

  <CoreSegmentedControl v-model="view" :options="[{ value: 'summary', label: 'Summary' }]" />
-->
<template>
  <div
    class="core-segmented"
    :class="[`core-segmented--${variant}`, `core-segmented--${size}`]"
    role="radiogroup"
  >
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      role="radio"
      class="core-segmented__option"
      :class="{ 'is-on': option.value === modelValue }"
      :aria-checked="option.value === modelValue"
      :disabled="option.disabled"
      :title="option.title"
      @click="emit('update:modelValue', option.value)"
    >
      <CoreIcon v-if="option.icon" :name="option.icon" :size="15" />
      <span>{{ option.label }}</span>
      <span v-if="option.count !== undefined" class="core-segmented__count">{{
        option.count
      }}</span>
      <slot name="after" :option="option" />
    </button>
  </div>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'CoreSegmentedControl' })

export interface CoreSegmentedOption {
  value: unknown
  label: string
  count?: number | string
  icon?: string
  title?: string
  disabled?: boolean
}

withDefaults(
  defineProps<{
    modelValue?: unknown
    options: CoreSegmentedOption[]
    variant?: 'solid' | 'soft'
    size?: 'small' | 'default'
  }>(),
  { modelValue: undefined, variant: 'solid', size: 'default' },
)

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
</script>

<style scoped>
.core-segmented {
  display: inline-flex;
  flex: none;
  font-family: var(--font-sans);
}

.core-segmented__option {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  border: 0;
  background: transparent;
  font: inherit;
  font-size: var(--text-md);
  color: var(--color-text-muted);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.core-segmented__option:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.core-segmented__count {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}

/* Solid: joined buttons with a border; the picked one filled. */
.core-segmented--solid {
  overflow: hidden;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.core-segmented--solid .core-segmented__option {
  height: 30px;
  padding: 0 calc(var(--spacing) * 3);
}

.core-segmented--solid .core-segmented__option + .core-segmented__option {
  border-left: 1px solid var(--color-border-input);
}

.core-segmented--solid .core-segmented__option:not(.is-on):hover {
  background: var(--color-surface-hover);
}

.core-segmented--solid .core-segmented__option.is-on {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.core-segmented--solid .core-segmented__option.is-on .core-segmented__count {
  color: inherit;
  opacity: 0.8;
}

/* Soft: a grey track with the picked one as a raised white pill. */
.core-segmented--soft {
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.core-segmented--soft .core-segmented__option {
  height: 30px;
  padding: 0 calc(var(--spacing) * 3);
  border-radius: var(--radius-md);
}

.core-segmented--soft .core-segmented__option:not(.is-on):hover {
  color: var(--color-text);
}

.core-segmented--soft .core-segmented__option.is-on {
  background: var(--color-surface);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  box-shadow: var(--shadow-sm);
}

.core-segmented--small .core-segmented__option {
  height: 26px;
  padding: 0 calc(var(--spacing) * 2.5);
  font-size: var(--text-sm);
}
</style>
