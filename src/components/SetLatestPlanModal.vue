<template>
  <MBaseModal
    :model-value="modelValue"
    @update:model-value="(val) => emit('update:modelValue', val)"
    :closeOnOutsideClick="false"
    :title="t('latestPlan.modal.title')"
    :buttons="modalButtons"
    @confirm="handleConfirm"
    @cancel="handleCancel"
    @close="handleClose"
  >
    <template #content>
      <div class="modal-content">
        <div class="modal-icon-container">
          <v-icon class="modal-icon" size="48">mdi-star</v-icon>
        </div>
        
        <p class="modal-message">
          {{ t('latestPlan.modal.message') }}
        </p>

        <div v-if="executionName" class="execution-info">
          <div class="execution-info-label">
            {{ t('latestPlan.modal.executionLabel') }}
          </div>
          <div class="execution-info-value">
            {{ executionName }}
          </div>
        </div>

        <div v-if="currentLatestPlanName" class="current-plan-warning">
          <v-icon size="18" class="warning-icon">mdi-information-outline</v-icon>
          <span>
            {{ t('latestPlan.modal.replaceWarning', { name: currentLatestPlanName }) }}
          </span>
        </div>

        <v-progress-linear
          v-if="isLoading"
          indeterminate
          color="primary"
          class="mt-4"
        />
      </div>
    </template>
  </MBaseModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'

const { t } = useI18n()
const generalStore = useGeneralStore()

interface Props {
  modelValue: boolean
  executionId: string
  executionName?: string
}

const props = withDefaults(defineProps<Props>(), {
  executionName: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', executionId: string): void
  (e: 'cancel'): void
  (e: 'success'): void
  (e: 'error', message: string): void
}>()

const isLoading = ref(false)

const currentLatestPlanName = computed(() => {
  const latestPlanExecution = generalStore.getLatestPlanExecution
  if (!latestPlanExecution || latestPlanExecution.executionId === props.executionId) {
    return null
  }
  return latestPlanExecution.name
})

const modalButtons = computed(() => [
  {
    text: t('latestPlan.modal.confirmButton'),
    action: 'confirm',
    class: 'primary-btn',
    disabled: isLoading.value,
  },
  {
    text: t('latestPlan.modal.cancelButton'),
    action: 'cancel',
    class: 'secondary-btn',
    disabled: isLoading.value,
  },
])

const handleConfirm = async () => {
  isLoading.value = true
  
  try {
    const success = await generalStore.setLatestPlan(props.executionId)
    
    if (success) {
      emit('success')
      emit('update:modelValue', false)
    } else {
      emit('error', t('latestPlan.modal.errorMessage'))
    }
  } catch (error) {
    console.error('Error setting latest plan:', error)
    emit('error', t('latestPlan.modal.errorMessage'))
  } finally {
    isLoading.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}

const handleClose = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.modal-content {
  padding: 16px 24px 24px;
  text-align: center;
}

.modal-icon-container {
  margin-bottom: 16px;
}

.modal-icon {
  color: var(--primary);
  background: var(--primary-light);
  border-radius: 50%;
  padding: 16px;
}

.modal-message {
  font-size: 15px;
  color: var(--subtitle);
  margin-bottom: 20px;
  line-height: 1.5;
}

.execution-info {
  background: var(--primary-light-variant);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.execution-info-label {
  font-size: 12px;
  color: var(--subtitle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.execution-info-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--title);
}

.current-plan-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #fff8e1;
  border-radius: 8px;
  text-align: left;
  font-size: 13px;
  color: #5d4037;
}

.warning-icon {
  color: var(--warning);
  flex-shrink: 0;
  margin-top: 2px;
}

/* Ensure primary-btn and secondary-btn styles are consistent */
:deep(.primary-btn) {
  background-color: var(--primary) !important;
  color: white !important;
}

:deep(.secondary-btn) {
  color: var(--subtitle) !important;
}
</style>

