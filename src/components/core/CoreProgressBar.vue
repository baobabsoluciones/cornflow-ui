<!--
  CoreProgressBar: how much of something is done (0–100).

  <CoreProgressBar :value="42" label="Time used of the solver's limit" />
-->
<template>
  <div
    :class="['core-progress-bar', `core-progress-bar--${tone}`]"
    role="progressbar"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label || undefined"
    :title="label || undefined"
  >
    <div class="core-progress-bar__fill" :style="{ width: `${clamped}%` }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CoreTone } from '@cornflow-ui/core/types/ui'

defineOptions({ name: 'CoreProgressBar' })

const props = withDefaults(
  defineProps<{
    value: number
    tone?: CoreTone
    label?: string
  }>(),
  { tone: 'primary', label: '' },
)

const clamped = computed(() =>
  Math.min(100, Math.max(0, Math.round(props.value))),
)
</script>

<style scoped>
.core-progress-bar {
  --progress-fill: var(--color-primary);

  height: 4px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--color-neutral-soft);
}

.core-progress-bar--neutral {
  --progress-fill: var(--color-neutral);
}

.core-progress-bar--info {
  --progress-fill: var(--color-info);
}

.core-progress-bar--success {
  --progress-fill: var(--color-success);
}

.core-progress-bar--warning {
  --progress-fill: var(--color-warning);
}

.core-progress-bar--danger {
  --progress-fill: var(--color-danger);
}

.core-progress-bar__fill {
  height: 100%;
  border-radius: inherit;
  background: var(--progress-fill);
  transition: width var(--duration-base) var(--ease-standard);
}
</style>
