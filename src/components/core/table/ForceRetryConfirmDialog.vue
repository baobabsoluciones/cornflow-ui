<!--
  ForceRetryConfirmDialog: what the server answers when an operation would break data that
  depends on it (`offer_force_retry`, e.g. an overwrite that other tables reference). Shows the
  server's message and offers to go ahead anyway (`confirm`, the caller retries with force) or
  not (`cancel`).

  <ForceRetryConfirmDialog :model-value="!!offer" :message="offer.message" :loading="retrying"
    @confirm="retryWithForce" @cancel="offer = null" />
-->
<template>
  <CoreConfirmDialog
    :model-value="modelValue"
    :title="$t('table.forceRetry.title')"
    :message="message"
    :confirm-text="$t('table.forceRetry.accept')"
    :cancel-text="$t('table.forceRetry.reject')"
    confirm-color="var(--color-danger)"
    icon="mdi-alert-outline"
    :loading="loading"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'

defineOptions({ name: 'ForceRetryConfirmDialog' })

withDefaults(
  defineProps<{
    modelValue: boolean
    /** The server's message, already in the user's language. */
    message: string
    loading?: boolean
  }>(),
  { loading: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()
</script>
