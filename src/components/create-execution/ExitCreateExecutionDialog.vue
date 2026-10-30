<!--
  ExitCreateExecutionDialog: leaving a new execution half done. Save it as a draft and leave,
  leave without saving, or stay.
-->
<template>
  <CoreDialog
    :model-value="modelValue"
    :title="$t('createExecution.exit.title')"
    :width="460"
    :persistent="saving"
    @update:model-value="!$event && $emit('cancel')"
  >
    <p class="exit-dialog__message">{{ $t('createExecution.exit.message') }}</p>
    <template #actions>
      <CoreButton
        variant="text"
        color="danger"
        :text="$t('createExecution.exit.leave')"
        :disabled="saving"
        data-testid="exit-leave"
        @click="$emit('leave')"
      />
      <CoreButton
        variant="text"
        :text="$t('createExecution.exit.cancel')"
        :disabled="saving"
        @click="$emit('cancel')"
      />
      <CoreButton
        icon="mdi-content-save-outline"
        :text="$t('createExecution.exit.saveAndLeave')"
        :loading="saving"
        data-testid="exit-save"
        @click="$emit('save')"
      />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'

defineOptions({ name: 'ExitCreateExecutionDialog' })

withDefaults(defineProps<{ modelValue: boolean; saving?: boolean }>(), { saving: false })

defineEmits<{ save: []; leave: []; cancel: [] }>()
</script>

<style scoped>
.exit-dialog__message {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text-muted);
  text-wrap: pretty;
}
</style>
