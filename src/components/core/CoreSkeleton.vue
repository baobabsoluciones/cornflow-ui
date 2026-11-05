<!--
  CoreSkeleton: a grey placeholder of the shape of what is loading. Hidden from screen readers:
  the loading area says it is loading (e.g. with a CoreSpinner label or an aria-busy container).

  <CoreSkeleton width="40%" :height="20" />
  <CoreSkeleton :width="18" :height="18" shape="circle" />
-->
<template>
  <span
    :class="['core-skeleton', `core-skeleton--${shape}`]"
    :style="{ width: toCssSize(width), height: toCssSize(height) }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
defineOptions({ name: 'CoreSkeleton' })

withDefaults(
  defineProps<{
    /** px, or any CSS length. */
    width?: number | string
    height?: number | string
    shape?: 'line' | 'pill' | 'circle' | 'block'
  }>(),
  { width: '100%', height: 12, shape: 'line' },
)

const toCssSize = (size: number | string): string =>
  typeof size === 'number' ? `${size}px` : size
</script>

<style scoped>
.core-skeleton {
  display: block;
  flex: none;
  background: var(--color-neutral-soft);
  animation: core-skeleton-pulse 1.4s ease-in-out infinite;
}

.core-skeleton--line {
  border-radius: var(--radius-sm);
}

.core-skeleton--block {
  border-radius: var(--radius-lg);
}

.core-skeleton--pill,
.core-skeleton--circle {
  border-radius: var(--radius-full);
}

@keyframes core-skeleton-pulse {
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .core-skeleton {
    animation: none;
  }
}
</style>
