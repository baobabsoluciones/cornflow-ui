<!--
  CoreSwitch: an on/off switch, with an optional label beside it.

  - `v-model`: whether it is on.
  - `disabled` greys it and stops clicks; give it a `title` saying why.
  - The default slot (or `label`) is the text after the track: "Yes", "From the database"…

  <CoreSwitch v-model="pinned" :label="pinned ? $t('table.yes') : $t('table.no')" />
-->
<template>
  <button
    type="button"
    role="switch"
    class="core-switch"
    :class="{ 'is-on': modelValue, 'is-disabled': disabled }"
    :aria-checked="modelValue"
    :disabled="disabled"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="core-switch__track">
      <span class="core-switch__knob" />
    </span>
    <span v-if="label || $slots.default" class="core-switch__label">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
defineOptions({ name: 'CoreSwitch' })

withDefaults(
  defineProps<{
    modelValue?: boolean
    label?: string
    disabled?: boolean
  }>(),
  { modelValue: false, label: '', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<style scoped>
.core-switch {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text-muted);
  cursor: pointer;
}

.core-switch:focus-visible {
  outline: none;
}

.core-switch:focus-visible .core-switch__track {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.core-switch__track {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
  transition: background-color var(--duration-base) var(--ease-standard);
}

.core-switch.is-on .core-switch__track {
  background: var(--color-primary);
}

.core-switch__knob {
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

.core-switch.is-on .core-switch__knob {
  left: 16px;
}

.core-switch.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
