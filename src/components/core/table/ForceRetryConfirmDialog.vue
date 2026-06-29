<!--
/**
 * ForceRetryConfirmDialog
 *
 * Shown when the backend returns offer_force_retry (e.g. overwrite blocked by dependent items).
 * Displays the error message and offers Accept (retry with force=true) or Reject (cancel).
 *
 * Props:
 * - modelValue: boolean – visibility
 * - message: string – error message (already localized by caller)
 * - loading: boolean – optional loading state while retrying
 *
 * Events: confirm (user accepted), cancel (user rejected), update:modelValue
 */
-->
<template>
  <v-dialog
    :model-value="modelValue && modelValue === true"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="480px"
    persistent
    class="force-retry-confirm-dialog"
  >
    <v-card class="core-modal-base__card force-retry-confirm-dialog__card">
      <v-card-title class="core-modal-base__header force-retry-confirm-dialog__header">
        <span class="core-modal-base__title force-retry-confirm-dialog__title">
          {{ title }}
        </span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          class="core-modal-base__close force-retry-confirm-dialog__close"
          @click="handleCancel"
        />
      </v-card-title>

      <v-card-text class="core-modal-base__content force-retry-confirm-dialog__content">
        <p class="force-retry-confirm-dialog__message">{{ message }}</p>
      </v-card-text>

      <v-card-actions class="core-modal-base__actions force-retry-confirm-dialog__actions">
        <v-spacer />
        <CoreButton
          :text="rejectText"
          variant="text"
          color="grey"
          size="small"
          :disabled="loading"
          @click="handleCancel"
        />
        <CoreButton
          :text="acceptText"
          variant="filled"
          background-color="var(--primary)"
          :loading="loading"
          :disabled="loading"
          size="small"
          @click="handleConfirm"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'

interface Props {
  modelValue: boolean
  message: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const { t } = useI18n()

const title = computed(() => t('table.forceRetry.title'))
const acceptText = computed(() => t('table.forceRetry.accept'))
const rejectText = computed(() => t('table.forceRetry.reject'))

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.force-retry-confirm-dialog__message {
  white-space: pre-wrap;
  margin: 0;
}
</style>

<style>
@import '@cornflow-ui/core/assets/styles/components/core/CoreModalBase.css';
</style>
