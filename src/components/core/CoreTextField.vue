<!--
  CoreTextField: a text box, for text, numbers, dates, times and passwords, or several lines with
  `multiline`.

  - `v-model`: a number field gives a number, or `null` when empty (`integer` keeps it whole); the
    others give the text. With `lazy` the value is given when the field changes (on blur or Enter),
    not on every keystroke.
  - Sizes: small (32px), default (36px), large (44px).
  - `suffix` shows a unit after the value ("sec"); the `append` slot, a control at the end (a button
    to show a password).
  - `invalid` marks it in the danger tone.
  - The other attributes (`id`, `name`, `placeholder`, `autocomplete`, `min`, `aria-*`, `data-*`…) go
    to the `input` itself; `class` and `style`, to the box.

  <CoreTextField v-model="name" placeholder="Name of the execution" />
  <CoreTextField v-model="timeLimit" type="number" integer suffix="sec" lazy />
  <CoreTextField v-model="description" multiline :rows="3" />
-->
<template>
  <div
    :class="[
      'core-text-field',
      `core-text-field--${size}`,
      {
        'core-text-field--multiline': multiline,
        'is-invalid': invalid,
        'is-disabled': disabled,
      },
      $attrs.class,
    ]"
    :style="$attrs.style as StyleValue"
  >
    <textarea
      v-if="multiline"
      ref="control"
      v-bind="controlAttrs"
      class="core-text-field__input"
      :rows="rows"
      :value="text"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      @input="!lazy && commit($event)"
      @change="lazy && commit($event)"
    />
    <input
      v-else
      ref="control"
      v-bind="controlAttrs"
      class="core-text-field__input"
      :type="type"
      :step="type === 'number' ? (integer ? 1 : 'any') : undefined"
      :value="text"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      @input="!lazy && commit($event)"
      @change="lazy && commit($event)"
    />
    <span v-if="suffix" class="core-text-field__suffix">{{ suffix }}</span>
    <slot name="append" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs, type StyleValue } from 'vue'

defineOptions({ name: 'CoreTextField', inheritAttrs: false })

interface Props {
  modelValue?: string | number | null
  type?: 'text' | 'number' | 'date' | 'time' | 'datetime-local' | 'password' | 'email'
  /** A number field that takes whole numbers only. */
  integer?: boolean
  size?: 'small' | 'default' | 'large'
  multiline?: boolean
  rows?: number
  suffix?: string
  invalid?: boolean
  disabled?: boolean
  /** Gives the value when the field changes instead of on every keystroke. */
  lazy?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  type: 'text',
  integer: false,
  size: 'default',
  multiline: false,
  rows: 2,
  suffix: '',
  invalid: false,
  disabled: false,
  lazy: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>()

const attrs = useAttrs()
const controlAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const text = computed(() => (props.modelValue === null ? '' : String(props.modelValue)))

function commit(event: Event) {
  const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value
  if (props.type !== 'number' || props.multiline) emit('update:modelValue', raw)
  else if (raw === '') emit('update:modelValue', null)
  else emit('update:modelValue', props.integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw))
}

const control = ref<HTMLInputElement | HTMLTextAreaElement>()

defineExpose({ focus: () => control.value?.focus() })
</script>

<style scoped>
.core-text-field {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
  padding: 0 calc(var(--spacing) * 1) 0 calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}

.core-text-field--small {
  height: 32px;
}

.core-text-field--default {
  height: 36px;
}

.core-text-field--large {
  height: 44px;
  padding-left: calc(var(--spacing) * 3);
  font-size: var(--text-base);
}

.core-text-field--multiline {
  height: auto;
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 2.5);
}

.core-text-field:hover {
  border-color: var(--color-border-strong);
}

.core-text-field:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.core-text-field.is-invalid {
  border-color: var(--color-danger);
}

.core-text-field.is-invalid:focus-within {
  box-shadow: 0 0 0 2px var(--color-danger-soft);
}

.core-text-field.is-disabled {
  background: var(--color-disabled);
  opacity: 0.7;
}

.core-text-field__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  padding-right: calc(var(--spacing) * 1.5);
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  color: inherit;
}

.core-text-field__input[type='number'] {
  font-variant-numeric: tabular-nums;
}

.core-text-field__input::placeholder {
  color: var(--color-text-subtle);
}

textarea.core-text-field__input {
  padding-right: 0;
  resize: vertical;
}

.core-text-field__suffix {
  flex: none;
  padding-right: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}
</style>
