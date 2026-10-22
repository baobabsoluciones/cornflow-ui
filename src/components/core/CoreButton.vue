<!--
  CoreButton: the app's button.

  Variants:
  - filled: solid, for the main action of a view or dialog (with color="danger", a destructive one).
  - outlined: white with a neutral border, for the other actions; with a tone colour
    (danger, warning, success) the text and border take that tone.
  - text: no background, for low-emphasis actions ("Cancel", "Clear filters", "Delete" in a header).
  - icon: square, icon only; give it an `aria-label`.

  Sizes: xs (26px), small (30px), default (36px), large (44px), xl (52px).

  `loading` shows a spinner instead of the icon, optionally with `loadingText`, and stops clicks.
  `backgroundColor` / `textColor` override the colour of the variant with any CSS colour.

  <CoreButton text="Load execution" icon="mdi-open-in-app" @click="load" />
  <CoreButton text="Download Excel" icon="mdi-microsoft-excel" variant="outlined" />
  <CoreButton text="Delete" icon="mdi-delete-outline" variant="text" color="danger" />
  <CoreButton text="Delete" variant="filled" color="danger" :loading="deleting" loading-text="Deleting…" />
  <CoreButton icon="mdi-pencil" variant="icon" aria-label="Edit" />
-->
<template>
  <button
    :type="type"
    :class="[
      'core-button',
      `core-button--${variant}`,
      `core-button--${size}`,
      `core-button--tone-${tone}`,
      { 'core-button--block': block, 'core-button--loading': loading },
    ]"
    :style="customColors"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="$emit('click', $event)"
  >
    <CoreSpinner v-if="loading" :size="iconSize" class="core-button__icon" />
    <CoreIcon
      v-else-if="icon && iconPosition === 'before'"
      :name="icon"
      :size="iconSize"
      class="core-button__icon"
    />

    <span v-if="hasText" class="core-button__text">
      <template v-if="loading && loadingText">{{ loadingText }}</template>
      <slot v-else>{{ text }}</slot>
    </span>

    <CoreIcon
      v-if="!loading && icon && iconPosition === 'after'"
      :name="icon"
      :size="iconSize"
      class="core-button__icon"
    />
  </button>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'

defineOptions({ name: 'CoreButton' })

interface Props {
  text?: string
  icon?: string | null
  iconPosition?: 'before' | 'after'
  variant?: 'filled' | 'outlined' | 'text' | 'icon'
  color?: 'primary' | 'warning' | 'danger' | 'success' | 'error' | 'grey'
  backgroundColor?: string | null
  textColor?: string | null
  size?: 'xs' | 'small' | 'default' | 'large' | 'xl'
  loading?: boolean
  /** Text while `loading`; without it the button keeps its text. */
  loadingText?: string
  disabled?: boolean
  /** Takes the full width of its container. */
  block?: boolean
  type?: 'button' | 'submit' | 'reset'
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
  loading: false,
  loadingText: '',
  disabled: false,
  block: false,
  type: 'button',
})

defineEmits<{
  click: [event: Event]
}>()

const slots = useSlots()

/** `error` is the same tone as `danger`. */
const tone = computed(() => (props.color === 'error' ? 'danger' : props.color))

const hasText = computed(
  () => props.variant !== 'icon' && Boolean(slots.default || props.text),
)

const ICON_SIZES: Record<NonNullable<Props['size']>, number> = {
  xs: 14,
  small: 16,
  default: 18,
  large: 20,
  xl: 22,
}
const iconSize = computed(() => ICON_SIZES[props.size])

const customColors = computed(() => {
  const styles: Record<string, string> = {}
  if (props.backgroundColor) styles['--button-bg'] = props.backgroundColor
  if (props.textColor) styles['--button-fg'] = props.textColor
  return styles
})
</script>

<style scoped>
.core-button {
  /* Tone of the variant; the tone classes below set them. */
  --button-tone: var(--color-primary);
  --button-tone-strong: var(--color-primary);
  --button-tone-soft: var(--color-primary-subtle);
  --button-tone-border: var(--color-border-input);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--spacing) * 2);
  box-sizing: border-box;
  margin: 0;
  border: 1px solid transparent;
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: 0;
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--duration-base) var(--ease-standard),
    border-color var(--duration-base) var(--ease-standard),
    box-shadow var(--duration-base) var(--ease-standard),
    filter var(--duration-base) var(--ease-standard);
}

.core-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.core-button:disabled {
  cursor: default;
}

.core-button:disabled:not(.core-button--loading) {
  opacity: 0.45;
}

.core-button--block {
  width: 100%;
}

/* The text box clips to cut long text with an ellipsis, so it has to be tall
   enough for the descenders (g, p, y): the button's line-height of 1 is not. */
.core-button__text {
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

/* Tones */
.core-button--tone-warning {
  --button-tone: var(--color-warning);
  --button-tone-strong: var(--color-warning-strong);
  --button-tone-soft: var(--color-warning-soft);
  --button-tone-border: var(--color-warning-border);
}

.core-button--tone-danger {
  --button-tone: var(--color-danger-strong);
  --button-tone-strong: var(--color-danger-strong);
  --button-tone-soft: var(--color-danger-soft);
  --button-tone-border: var(--color-danger-border);
}

.core-button--tone-success {
  --button-tone: var(--color-success);
  --button-tone-strong: var(--color-success-strong);
  --button-tone-soft: var(--color-success-soft);
  --button-tone-border: var(--color-success-border);
}

.core-button--tone-grey {
  --button-tone: var(--color-neutral);
  --button-tone-strong: var(--color-text-muted);
  --button-tone-soft: var(--color-surface-hover);
}

/* Variants */
.core-button--filled {
  background: var(--button-bg, var(--button-tone));
  color: var(--button-fg, var(--color-on-primary));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
}

.core-button--filled:not(:disabled):hover {
  filter: brightness(0.92);
}

.core-button--outlined {
  background: var(--button-bg, var(--color-surface));
  color: var(--button-fg, var(--color-text));
  border-color: var(--color-border-input);
}

.core-button--outlined .core-button__icon {
  color: var(--color-text-muted);
}

.core-button--outlined:not(:disabled):hover {
  background: var(--button-bg, var(--color-surface-hover));
  border-color: var(--color-border-strong);
}

.core-button--outlined:is(
  .core-button--tone-danger,
  .core-button--tone-warning,
  .core-button--tone-success
) {
  color: var(--button-fg, var(--button-tone-strong));
  border-color: var(--button-tone-border);
}

.core-button--outlined:is(
    .core-button--tone-danger,
    .core-button--tone-warning,
    .core-button--tone-success
  )
  .core-button__icon {
  color: inherit;
}

.core-button--outlined:is(
    .core-button--tone-danger,
    .core-button--tone-warning,
    .core-button--tone-success
  ):not(:disabled):hover {
  background: var(--button-bg, var(--button-tone-soft));
  border-color: var(--button-tone-border);
}

.core-button--text,
.core-button--icon {
  background: var(--button-bg, transparent);
  color: var(--button-fg, var(--button-tone-strong));
}

.core-button--text:not(:disabled):hover,
.core-button--icon:not(:disabled):hover {
  background: var(--button-bg, var(--button-tone-soft));
}

/* Sizes */
.core-button--xs {
  height: 26px;
  padding: 0 calc(var(--spacing) * 2.5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.core-button--small {
  height: 30px;
  padding: 0 calc(var(--spacing) * 3);
  border-radius: var(--radius-md);
  font-size: var(--text-md);
}

.core-button--default {
  height: 36px;
  padding: 0 calc(var(--spacing) * 4);
  border-radius: var(--radius-lg);
  font-size: var(--text-md);
}

.core-button--large {
  height: 44px;
  padding: 0 calc(var(--spacing) * 5);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
}

.core-button--xl {
  height: 52px;
  padding: 0 calc(var(--spacing) * 6);
  border-radius: var(--radius-xl);
  font-size: var(--text-lg);
}

.core-button--text {
  padding-inline: calc(var(--spacing) * 2);
}

.core-button--icon {
  padding: 0;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
}
</style>
