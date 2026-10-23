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

  <select
    v-else-if="field.type === 'options'"
    :id="inputId"
    class="parameter-input__control parameter-input__select"
    :class="{ 'is-invalid': invalid, 'is-empty': value === undefined || value === null || value === '' }"
    :value="selectValue"
    @change="onSelect"
  >
    <option value="" disabled>{{ $t('createExecution.parameters.choose') }}</option>
    <option v-for="(option, index) in field.options" :key="String(option.value)" :value="String(index)">
      {{ option.label }}
    </option>
  </select>

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

  <div
    v-else
    class="parameter-input__control parameter-input__field"
    :class="{ 'is-invalid': invalid }"
  >
    <input
      :id="inputId"
      class="parameter-input__input"
      :type="field.type === 'date' ? 'date' : field.type === 'text' ? 'text' : 'number'"
      :step="field.type === 'float' ? 'any' : field.type === 'number' ? '1' : undefined"
      :value="value ?? ''"
      @change="onInput"
    />
    <span v-if="field.suffix" class="parameter-input__suffix">{{ field.suffix }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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

const props = withDefaults(
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

const emit = defineEmits<{ change: [value: unknown] }>()

const MAX_BUTTONS = 3

/** Options can be numbers or ids: the select works with their position. */
const selectValue = computed(() => {
  const index = props.field.options.findIndex((o) => o.value === props.value)
  return index === -1 ? '' : String(index)
})

function onSelect(event: Event) {
  const index = Number((event.target as HTMLSelectElement).value)
  emit('change', props.field.options[index]?.value)
}

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (props.field.type === 'number') emit('change', raw === '' ? null : Number.parseInt(raw, 10))
  else if (props.field.type === 'float') emit('change', raw === '' ? null : Number.parseFloat(raw))
  else emit('change', raw)
}
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

.parameter-input__control {
  box-sizing: border-box;
  height: 34px;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
}

.parameter-input__control.is-invalid {
  border-color: var(--color-danger-border);
}

.parameter-input__select {
  padding: 0 calc(var(--spacing) * 2);
}

.parameter-input__select.is-empty {
  color: var(--color-text-subtle);
}

.parameter-input__field {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  padding: 0 calc(var(--spacing) * 2.5);
}

.parameter-input__field:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.parameter-input__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: inherit;
}

.parameter-input__suffix {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
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
