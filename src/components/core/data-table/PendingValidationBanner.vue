<!--
  PendingValidationBanner: why the edited data does not match the schema, over the pending changes,
  with a cross to close it.

  <PendingValidationBanner :message="validationError" @close="clearError" />
-->
<template>
  <div class="pending-banner">
    <CoreAlert tone="danger" :title="$t('dataTable.pending.validationTitle')" :message="message" />
    <CoreButton
      variant="icon"
      size="xs"
      icon="mdi-close"
      class="pending-banner__close"
      :aria-label="$t('dataTable.pending.closeBanner')"
      :title="$t('dataTable.pending.closeBanner')"
      @click="$emit('close')"
    />
  </div>
</template>

<script setup lang="ts">
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'

defineOptions({ name: 'PendingValidationBanner' })

defineProps<{ message: string }>()

defineEmits<{ close: [] }>()
</script>

<style scoped>
.pending-banner {
  position: relative;
}

.pending-banner :deep(.core-alert) {
  padding-right: calc(var(--spacing) * 9);
}

.pending-banner__close {
  position: absolute;
  top: calc(var(--spacing) * 2);
  right: calc(var(--spacing) * 2);
}
</style>
