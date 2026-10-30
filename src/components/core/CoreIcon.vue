<!--
  CoreIcon: a Material Design Icons glyph (`mdi-*`, the names the app config and the projects
  already use).

  Decorative by default (hidden from screen readers). Give it a `label` when the icon is the only
  thing that says what it means.

  <CoreIcon name="mdi-history" :size="22" />
  <CoreIcon name="mdi-loading" spin label="Loading" />
-->
<template>
  <i
    :class="['mdi', name, 'core-icon', { 'core-icon--spin': spin }]"
    :style="size === undefined ? undefined : { fontSize: toCssSize(size) }"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  />
</template>

<script setup lang="ts">
defineOptions({ name: 'CoreIcon' })

withDefaults(
  defineProps<{
    /** Icon name, e.g. `mdi-history`. */
    name: string
    /** Size in px, or any CSS length. Without it the icon takes the surrounding font size. */
    size?: number | string
    /** Turns the icon continuously (for loading glyphs such as `mdi-loading`). */
    spin?: boolean
    /** Accessible name; without it the icon is decorative. */
    label?: string
  }>(),
  { size: undefined, spin: false, label: '' },
)

const toCssSize = (size: number | string): string =>
  typeof size === 'number' ? `${size}px` : size
</script>

<style scoped>
.core-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  line-height: 1;
  font-style: normal;
}

.core-icon--spin {
  animation: core-icon-spin 0.9s linear infinite;
}

@keyframes core-icon-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .core-icon--spin {
    animation-duration: 2.4s;
  }
}
</style>
