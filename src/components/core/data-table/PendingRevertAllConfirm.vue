<!--
  PendingRevertAllConfirm: the inline confirmation of "Revert all": how many changes go, "No" and
  the destructive confirm.

  <PendingRevertAllConfirm :count="totalChanges" size="small" @cancel="confirming = false" @confirm="revertAll" />
-->
<template>
  <span class="pending-revert-all__text">
    <CoreIcon name="mdi-alert-outline" :size="16" />
    {{ $t('dataTable.pending.confirmRevertAll', count) }}
  </span>
  <div class="pending-revert-all__buttons">
    <CoreButton variant="text" :size="size" :text="$t('dataTable.pending.no')" @click="$emit('cancel')" />
    <CoreButton
      tone="danger"
      :size="size"
      :text="$t('dataTable.pending.revertAllConfirm')"
      data-testid="pending-revert-all-confirm"
      @click="$emit('confirm')"
    />
  </div>
</template>

<script setup lang="ts">
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'PendingRevertAllConfirm' })

withDefaults(defineProps<{ count: number; size?: 'small' | 'default' }>(), { size: 'default' })

defineEmits<{ cancel: []; confirm: [] }>()
</script>

<style scoped>
.pending-revert-all__text {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
  color: var(--color-danger-strong);
}

.pending-revert-all__buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: calc(var(--spacing) * 2);
}
</style>
