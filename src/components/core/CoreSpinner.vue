<!--
  CoreSpinner: an indeterminate loading ring, in the current text colour.

  <CoreSpinner />
  <CoreSpinner :size="32" label="Loading executions" />
-->
<template>
  <span
    class="core-spinner"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      borderWidth: `${thickness}px`,
    }"
    :role="label ? 'status' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'CoreSpinner' })

const props = withDefaults(
  defineProps<{
    /** Diameter in px. */
    size?: number
    /** Accessible name; without it the spinner is decorative (the surrounding text says it). */
    label?: string
  }>(),
  { size: 18, label: '' },
)

const thickness = computed(() => (props.size >= 28 ? 3 : 2))
</script>

<style scoped>
.core-spinner {
  display: inline-block;
  flex: none;
  box-sizing: border-box;
  border-style: solid;
  border-color: currentColor;
  border-right-color: transparent;
  border-radius: var(--radius-full);
  animation: core-spinner-spin 0.8s linear infinite;
}

@keyframes core-spinner-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .core-spinner {
    animation-duration: 2.4s;
  }
}
</style>
