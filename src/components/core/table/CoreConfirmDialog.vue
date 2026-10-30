<!--
  CoreConfirmDialog: asks the user to confirm an action, with a cancel and a confirm button.

  - `confirmColor`: a CSS colour for the confirm button; a danger colour (`var(--danger)`) makes it
    the destructive button and tints the icon.
  - `loading`: the confirm button shows a spinner and `loadingMessage` appears under the message.
  - `persistent` (default): Escape and a click outside do not close it.

  <CoreConfirmDialog v-model="open" :title="$t('table.confirmDelete')" :message="$t('table.deleteMessage')"
    :confirm-text="$t('table.delete')" confirm-color="var(--danger)" icon="mdi-delete-outline"
    :loading="deleting" @confirm="remove" @cancel="open = false" />
-->
<template>
  <CoreDialog
    :model-value="modelValue === true"
    :title="title"
    :icon="icon"
    :tone="isDanger ? 'danger' : 'primary'"
    :width="480"
    :persistent="persistent || loading"
    closable
    @update:model-value="!$event && handleCancel()"
  >
    <p class="core-confirm-dialog__message">{{ message }}</p>
    <p
      v-if="loading && loadingMessage"
      class="core-confirm-dialog__loading-message"
    >
      {{ loadingMessage }}
    </p>
    <template #actions>
      <CoreButton
        :text="cancelText"
        variant="outlined"
        size="small"
        :disabled="loading"
        @click="handleCancel"
      />
      <CoreButton
        :text="confirmText"
        variant="filled"
        size="small"
        :icon="icon || null"
        :color="isDanger ? 'danger' : 'primary'"
        :background-color="isDanger ? null : confirmColor"
        :loading="loading"
        @click="handleConfirm"
      />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'

interface Props {
  modelValue: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
  /** Icon of the title and the confirm button (e.g. `mdi-delete-outline`). */
  icon?: string
  loading?: boolean
  /** Shown below the message when loading is true (e.g. "Deleting, please wait...") */
  loadingMessage?: string
  persistent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmColor: 'var(--primary)',
  icon: '',
  loading: false,
  loadingMessage: '',
  persistent: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const isDanger = computed(() => /danger|error/.test(props.confirmColor))

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.core-confirm-dialog__message {
  margin: 0;
}

.core-confirm-dialog__loading-message {
  margin: calc(var(--spacing) * 2) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}
</style>
