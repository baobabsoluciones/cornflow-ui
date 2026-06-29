<!--
/**
 * CoreButton component
 * 
 * A reusable button component that maintains consistent look and feel across the application.
 * 
 * Features:
 * - 4 variants: filled, outlined, text, icon
 * - Flexible icons: before or after text
 * - Customizable colors: using CSS variables or custom colors
 * - States: loading, disabled, hover, focus
 * - Sizes: xs, small, default, large, xl
 * - Accessibility: focus visible and ARIA support
 * 
 * Props:
 * - text (String): Button text
 * - icon (String): MDI icon (e.g. 'mdi-plus')
 * - iconPosition (String): Icon position 'before' or 'after'
 * - variant (String): Style 'filled', 'outlined', 'text', 'icon'
 * - color (String): Predefined color 'primary', 'warning', 'danger', 'success'
 * - backgroundColor (String): Custom background color (overrides color)
 * - textColor (String): Custom text color
 * - size (String): Size 'xs', 'small', 'default', 'large', 'xl'
 * 
 * Usage examples:
 * 
 * Basic filled button:
 * <CoreButton
 *   text="Save"
 *   icon="mdi-content-save"
 *   variant="filled"
 *   color="primary"
 *   @click="save"
 * />
 * 
 * Outlined button with icon after:
 * <CoreButton
 *   text="Next"
 *   icon="mdi-arrow-right"
 *   icon-position="after"
 *   variant="outlined"
 *   color="primary"
 *   @click="next"
 * />
 * 
 * Text button:
 * <CoreButton
 *   text="Cancel"
 *   variant="text"
 *   color="primary"
 *   @click="cancel"
 * />
 * 
 * Icon-only button:
 * <CoreButton
 *   icon="mdi-pencil"
 *   variant="icon"
 *   color="primary"
 *   @click="edit"
 * />
 * 
 * Different sizes:
 * <CoreButton text="XS" size="xs" variant="filled" color="primary" />
 * <CoreButton text="Small" size="small" variant="filled" color="primary" />
 * <CoreButton text="Default" size="default" variant="filled" color="primary" />
 * <CoreButton text="Large" size="large" variant="filled" color="primary" />
 * <CoreButton text="XL" size="xl" variant="filled" color="primary" />
 * 
 * Size specifications:
 * - xs: 28px height, 6px 12px padding, 12px font, 8px border radius
 * - small: 36px height, 8px 16px padding, 13px font, 10px border radius
 * - default: 44px height, 12px 20px padding, 14px font, 12px border radius
 * - large: 52px height, 16px 24px padding, 16px font, 14px border radius
 * - xl: 60px height, 20px 32px padding, 18px font, 16px border radius
 * 
 * Icon variant size specifications:
 * - xs: 24px height, 4px padding, 6px border radius
 * - small: 28px height, 6px padding, 8px border radius
 * - default: 32px height, 8px padding, 10px border radius
 * - large: 40px height, 10px padding, 12px border radius
 * - xl: 44px height, 12px padding, 14px border radius
 * 
 * Available colors (from variables.css):
 * - primary: var(--primary) - #0984c6
 * - warning: var(--warning) - #dea727
 * - danger: var(--danger) - #f44336
 * - success: var(--success) - #3ba780
 * 
 * Events:
 * - @click: Emitted when button is clicked
 * 
 * Slots:
 * - default: Button content (alternative to text prop)
 * 
 * Accessibility features:
 * - Focus visible with outline
 * - Screen reader support
 * - Proper disabled states
 * - Smooth transitions
 */
-->

<template>
  <button
    :class="['core-button', `core-button--${variant}`, `core-button--${size}`]"
    :style="buttonStyles"
    v-bind="$attrs"
    @click="$emit('click', $event)"
  >
    <i
      v-if="icon && iconPosition === 'before'"
      :class="['mdi', icon, 'core-button__icon', 'core-button__icon--before']"
    />

    <span v-if="$slots.default || text" class="core-button__text">
      <slot>{{ text }}</slot>
    </span>

    <i
      v-if="icon && iconPosition === 'after'"
      :class="['mdi', icon, 'core-button__icon', 'core-button__icon--after']"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props
interface Props {
  text?: string
  icon?: string | null
  iconPosition?: 'before' | 'after'
  variant?: 'filled' | 'outlined' | 'text' | 'icon'
  color?: 'primary' | 'warning' | 'danger' | 'success'
  backgroundColor?: string | null
  textColor?: string | null
  size?: 'xs' | 'small' | 'default' | 'large' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  icon: null,
  iconPosition: 'before',
  variant: 'filled',
  color: 'primary',
  backgroundColor: null,
  textColor: null,
  size: 'default',
})

// Emits
defineEmits<{
  click: [event: Event]
}>()

// Color mapping from variables.css
const colorMap = {
  primary: 'var(--primary)', // #0984c6
  warning: 'var(--warning)', // #dea727
  danger: 'var(--danger)', // #f44336
  success: 'var(--success)', // #3ba780
}

// Compute button styles based on variant and props
const buttonStyles = computed(() => {
  const styles: Record<string, string> = {}

  const selectedColor = colorMap[props.color]

  switch (props.variant) {
    case 'filled':
      // Filled: solid background with white text
      styles.backgroundColor = props.backgroundColor || selectedColor
      styles.color = props.textColor || 'white'
      styles.border = 'none'
      break

    case 'outlined':
      // Outlined: white background with border
      styles.backgroundColor = props.backgroundColor || 'white'
      styles.color = props.textColor || '#333333'
      styles.border = `1px solid ${selectedColor}`
      break

    case 'text':
    case 'icon':
      // Text / Icon: transparent background
      styles.backgroundColor = props.backgroundColor || 'transparent'
      styles.color = props.textColor || selectedColor
      styles.border = 'none'
      break
  }

  return styles
})
</script>

<style src="@/assets/styles/components/core/CoreButton.css"></style>
