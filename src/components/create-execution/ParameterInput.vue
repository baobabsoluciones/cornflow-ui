<!--
  ParameterInput: the control of one execution parameter. A choice of three options or fewer is a
  row of buttons, more is a dropdown; yes/no is a switch; numbers, dates and text are a field with
  an optional suffix (e.g. "sec").
-->
<template>
  <div
    v-if="field.type === 'options' && field.options.length <= MAX_BUTTONS"
    class="parameter-input__segments"
    role="radiogroup"
    :aria-label="field.label"
  >
    <button
      v-for="option in field.options"
      :key="String(option.value)"
      type="button"
      role="radio"
      class="parameter-input__segment"
      :class="{ 'is-on': option.value === value, 'is-invalid': invalid, 'is-compact': compact }"
      :aria-checked="option.value === value"
      :title="option.label"
      @click="$emit('change', option.value)"
    >
      {{ option.label }}
    </button>
  </div>

  <CoreSelect
    v-else-if="field.type === 'options'"
    :id="inputId"
    :model-value="value"
    :options="field.options"
    :placeholder="$t('createExecution.parameters.choose')"
    :invalid="invalid"
    @update:model-value="$emit('change', $event)"
  />

  <button
    v-else-if="field.type === 'boolean'"
    :id="inputId"
    type="button"
    role="switch"
    class="parameter-input__switch"
    :aria-checked="Boolean(value)"
    @click="$emit('change', !value)"
  >
    <span class="parameter-input__track" :class="{ 'is-on': value }">
      <span class="parameter-input__knob" />
    </span>
    {{ value ? $t('createExecution.parameters.yes') : $t('createExecution.parameters.no') }}
  </button>

  <CoreTextField
    v-else
    :id="inputId"
    :type="field.type === 'date' ? 'date' : field.type === 'text' ? 'text' : 'number'"
    :integer="field.type === 'number'"
    :model-value="value as string | number | null | undefined"
    :suffix="field.suffix"
    :invalid="invalid"
    lazy
    @update:model-value="$emit('change', $event)"
  />
</template>

<script setup lang="ts">
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'

defineOptions({ name: 'ParameterInput' })

export interface ParameterFieldView {
  key: string
  label: string
  type: 'options' | 'boolean' | 'number' | 'float' | 'date' | 'text'
  options: { value: unknown; label: string }[]
  suffix: string
  required: boolean
  default?: unknown
}

withDefaults(
  defineProps<{
    field: ParameterFieldView
    value: unknown
    invalid?: boolean
    inputId?: string
    /** Smaller text in the buttons (the "Advanced" fields). */
    compact?: boolean
  }>(),
  { invalid: false, inputId: undefined, compact: false },
)

defineEmits<{ change: [value: unknown] }>()

const MAX_BUTTONS = 3

</script>

<style scoped>
.parameter-input__segments {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: calc(var(--spacing) * 1.5);
}

.parameter-input__segment {
  height: 32px;
  padding: 0 calc(var(--spacing) * 2);
  overflow: hidden;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font: inherit;
  font-size: var(--text-md);
  color: var(--color-text);
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.parameter-input__segment.is-compact {
  font-size: var(--text-sm);
}

.parameter-input__segment:hover {
  background: var(--color-surface-hover);
}

.parameter-input__segment.is-invalid {
  border-color: var(--color-danger-border);
}

.parameter-input__segment.is-on {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.parameter-input__switch {
  display: flex;
  align-self: flex-start;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-md);
  color: var(--color-text-muted);
  cursor: pointer;
}

.parameter-input__track {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
  transition: background-color var(--duration-base) var(--ease-standard);
}

.parameter-input__track.is-on {
  background: var(--color-primary);
}

.parameter-input__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: left var(--duration-base) var(--ease-standard);
}

.parameter-input__track.is-on .parameter-input__knob {
  left: 16px;
}
</style>
