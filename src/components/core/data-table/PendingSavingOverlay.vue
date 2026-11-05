<!--
  PendingSavingOverlay: covers the pending changes while they are saved, with "Processing the
  changes…" in a pill. Its container needs `position: relative`.
-->
<template>
  <div class="pending-saving" role="status">
    <span class="pending-saving__pill">
      <CoreSpinner :size="spinnerSize" />
      {{ $t('dataTable.pending.processing') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'

defineOptions({ name: 'PendingSavingOverlay' })

withDefaults(defineProps<{ spinnerSize?: number }>(), { spinnerSize: 18 })
</script>

<style scoped>
.pending-saving {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-surface) 75%, transparent);
}

.pending-saving__pill {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3.5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-md);
}
</style>
