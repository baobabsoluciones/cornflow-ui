<!--
/**
 * CoreConfirmDialog component
 *
 * A reusable confirmation dialog component that maintains consistent look and feel with CoreModal.
 *
 * Features:
 * - Consistent header styling with close button
 * - Customizable title and message
 * - Configurable action buttons
 * - Loading states for actions
 * - Responsive layout
 * - i18n support
 *
 * Props:
 * - modelValue (Boolean): Controls dialog visibility
 * - title (String): Dialog title
 * - message (String): Confirmation message
 * - confirmText (String): Confirm button text
 * - cancelText (String): Cancel button text
 * - confirmColor (String): Confirm button color
 * - loading (Boolean): Loading state for confirm button
 * - persistent (Boolean): Prevent closing by clicking outside
 *
 * Usage examples:
 *
 * Basic confirmation:
 * <CoreConfirmDialog
 *   v-model="showDialog"
 *   title="Confirm Delete"
 *   message="Are you sure you want to delete this item?"
 *   confirm-text="Delete"
 *   cancel-text="Cancel"
 *   confirm-color="var(--danger)"
 *   @confirm="handleConfirm"
 *   @cancel="handleCancel"
 * />
 *
 * With loading state:
 * <CoreConfirmDialog
 *   v-model="showDialog"
 *   title="Confirm Action"
 *   message="This action cannot be undone."
 *   :loading="processing"
 *   @confirm="handleConfirm"
 *   @cancel="handleCancel"
 * />
 *
 * Events:
 * - @confirm: Emitted when confirm button is clicked
 * - @cancel: Emitted when cancel button is clicked or dialog is closed
 * - @update:modelValue: Emitted when dialog visibility changes
 */
-->

<template>
  <v-dialog
    :model-value="modelValue && modelValue === true"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="480px"
    :persistent="persistent"
    class="core-confirm-dialog"
  >
    <v-card class="core-modal-base__card core-confirm-dialog__card">
      <!-- Header -->
      <v-card-title class="core-modal-base__header core-confirm-dialog__header">
        <span class="core-modal-base__title core-confirm-dialog__title">{{
          title
        }}</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          class="core-modal-base__close core-confirm-dialog__close"
          @click="handleCancel"
        />
      </v-card-title>

      <!-- Content -->
      <v-card-text
        class="core-modal-base__content core-confirm-dialog__content"
      >
        <p class="core-confirm-dialog__message">{{ message }}</p>
      </v-card-text>

      <!-- Actions -->
      <v-card-actions
        class="core-modal-base__actions core-confirm-dialog__actions"
      >
        <v-spacer />
        <CoreButton
          :text="cancelText"
          variant="text"
          color="grey"
          size="small"
          @click="handleCancel"
        />
        <CoreButton
          :text="confirmText"
          variant="filled"
          :background-color="confirmColor"
          :loading="loading"
          size="small"
          @click="handleConfirm"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import CoreButton from '@/components/core/CoreButton.vue'

// Props
interface Props {
  modelValue: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
  loading?: boolean
  persistent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmColor: 'var(--primary)',
  loading: false,
  persistent: true,
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

// Methods
const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style>
@import '@/assets/styles/components/core/CoreModalBase.css';
@import '@/assets/styles/components/core/CoreConfirmDialog.css';
</style>
