<!--
/**
 * CoreCheckbox component
 *
 * A reusable checkbox component that maintains consistent look and feel across the application.
 *
 * Features:
 * - Custom styling with outlined design
 * - Support for indeterminate state
 * - Disabled state support
 * - Customizable color
 * - Smooth animations
 * - Accessibility support
 *
 * Props:
 * - modelValue (Boolean): Checkbox state
 * - indeterminate (Boolean): Indeterminate state
 * - disabled (Boolean): Disabled state
 * - color (String): Custom color for the checkbox
 *
 * Usage examples:
 *
 * Basic checkbox:
 * <CoreCheckbox
 *   v-model="isChecked"
 *   @update:model-value="handleChange"
 * />
 *
 * Indeterminate checkbox:
 * <CoreCheckbox
 *   :model-value="false"
 *   :indeterminate="true"
 *   @update:model-value="handleSelectAll"
 * />
 *
 * Disabled checkbox:
 * <CoreCheckbox
 *   v-model="isChecked"
 *   :disabled="true"
 * />
 *
 * Custom color:
 * <CoreCheckbox
 *   v-model="isChecked"
 *   color="var(--success)"
 * />
 *
 * Events:
 * - @update:modelValue: Emitted when checkbox state changes
 */
-->

<template>
  <div
    class="core-checkbox"
    :class="{
      'core-checkbox--checked': modelValue,
      'core-checkbox--indeterminate': indeterminate,
      'core-checkbox--disabled': disabled,
    }"
    :style="{ '--checkbox-color': color }"
    @click="handleClick"
  >
    <div class="core-checkbox__input">
      <v-icon
        v-if="modelValue"
        icon="mdi-check"
        size="12"
        class="core-checkbox__icon core-checkbox__icon--checked"
      />
      <v-icon
        v-else-if="indeterminate"
        icon="mdi-minus"
        size="12"
        class="core-checkbox__icon core-checkbox__icon--indeterminate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Props
interface Props {
  modelValue: boolean
  indeterminate?: boolean
  disabled?: boolean
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  indeterminate: false,
  disabled: false,
  color: 'var(--primary)',
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// Methods
const handleClick = () => {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<style src="@/assets/styles/components/core/CoreCheckbox.css"></style>
