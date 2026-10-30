<!--
  CoreCheckbox: a checkbox, with an optional label beside it.

  - `v-model`: whether it is ticked.
  - `indeterminate` shows a dash: some of what it stands for is ticked (a "select all" over a
    partial selection). Clicking it ticks it.
  - `disabled` greys it and stops clicks.

  <CoreCheckbox v-model="selected" :aria-label="$t('dataTable.grid.selectRow')" />
  <CoreCheckbox :model-value="allSelected" :indeterminate="someSelected" @update:model-value="selectAll" />
-->
<template>
  <button
    type="button"
    role="checkbox"
    class="core-checkbox"
    :class="{
      'is-checked': modelValue,
      'is-indeterminate': indeterminate && !modelValue,
      'is-disabled': disabled,
    }"
    :aria-checked="indeterminate && !modelValue ? 'mixed' : modelValue"
    :disabled="disabled"
    @click.stop="emit('update:modelValue', !modelValue)"
  >
    <span class="core-checkbox__box">
      <CoreIcon v-if="modelValue" name="mdi-check-bold" :size="12" />
      <CoreIcon v-else-if="indeterminate" name="mdi-minus" :size="12" />
    </span>
    <span v-if="label || $slots.default" class="core-checkbox__label">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'CoreCheckbox' })

withDefaults(
  defineProps<{
    modelValue?: boolean
    indeterminate?: boolean
    label?: string
    disabled?: boolean
  }>(),
  { modelValue: false, indeterminate: false, label: '', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<style scoped>
.core-checkbox {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.core-checkbox__box {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 1.5px solid var(--color-text-subtle);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-on-primary);
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}

.core-checkbox:hover .core-checkbox__box {
  border-color: var(--color-primary);
}

.core-checkbox.is-checked .core-checkbox__box,
.core-checkbox.is-indeterminate .core-checkbox__box {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.core-checkbox:focus-visible {
  outline: none;
}

.core-checkbox:focus-visible .core-checkbox__box {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.core-checkbox.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
