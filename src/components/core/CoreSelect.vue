<!--
  CoreSelect: a dropdown to pick one of a list of options, of any type (numbers, ids, true/false).

  - `v-model`: the value of the picked option.
  - `placeholder` is the text while nothing is picked; with `clearable` it can also be picked back,
    which gives `null`.
  - Sizes: small (32px), default (36px), large (44px). `invalid` marks it in the danger tone.
  - The other attributes (`id`, `name`, `aria-*`, `data-*`…) go to the `select` itself; `class` and
    `style`, to the box.

  <CoreSelect v-model="solver" :options="[{ value: 'mip', label: 'MIP' }]" placeholder="Choose…" />
-->
<template>
  <div
    :class="[
      'core-select',
      `core-select--${size}`,
      { 'is-empty': selected === '' },
      $attrs.class,
    ]"
    :style="$attrs.style as StyleValue"
  >
    <select
      v-bind="controlAttrs"
      :class="['core-select__control', 'core-field', { 'is-invalid': invalid }]"
      :value="selected"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      @change="pick"
    >
      <option v-if="placeholder || clearable" value="" :disabled="!clearable">{{ placeholder }}</option>
      <option v-for="(option, index) in options" :key="index" :value="String(index)">
        {{ option.label }}
      </option>
    </select>
    <CoreIcon name="mdi-chevron-down" :size="18" class="core-select__chevron" />
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs, type StyleValue } from 'vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'CoreSelect', inheritAttrs: false })

export interface CoreSelectOption {
  value: unknown
  label: string
}

interface Props {
  modelValue?: unknown
  options: CoreSelectOption[]
  placeholder?: string
  /** The placeholder can be picked back, leaving the value `null`. */
  clearable?: boolean
  size?: 'small' | 'default' | 'large'
  invalid?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  placeholder: '',
  clearable: false,
  size: 'default',
  invalid: false,
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const attrs = useAttrs()
const controlAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

/** The `select` works with the position of the option, so the values can be of any type. */
const selected = computed(() => {
  const index = props.options.findIndex((option) => option.value === props.modelValue)
  return index === -1 ? '' : String(index)
})

function pick(event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  emit('update:modelValue', raw === '' ? null : props.options[Number(raw)]?.value)
}
</script>

<style scoped>
.core-select {
  position: relative;
  box-sizing: border-box;
  display: flex;
  min-width: 0;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
}

.core-select--small {
  height: 32px;
}

.core-select--default {
  height: 36px;
}

.core-select--large {
  height: 44px;
  font-size: var(--text-base);
}

.core-select__control {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 calc(var(--spacing) * 8) 0 calc(var(--spacing) * 2.5);
  font: inherit;
  color: inherit;
  text-overflow: ellipsis;
  appearance: none;
  outline: none;
  cursor: pointer;
}

.core-select.is-empty .core-select__control {
  color: var(--color-text-subtle);
}

.core-select__control:disabled {
  cursor: default;
}

.core-select__control option {
  color: var(--color-text);
}

.core-select__chevron {
  position: absolute;
  top: 50%;
  right: calc(var(--spacing) * 2);
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}
</style>
