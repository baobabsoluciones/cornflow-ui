<template>
  <div v-if="shouldShow" class="set-current-plan-fab">
    <v-tooltip location="left">
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          icon
          size="large"
          :color="isCurrentPlan ? 'primary' : 'primary'"
          :class="['fab-button', { 'is-current': isCurrentPlan }]"
          :elevation="isCurrentPlan ? 2 : 4"
          @click="isCurrentPlan ? null : openModal()"
          :style="isCurrentPlan ? 'cursor: default;' : ''"
        >
          <v-icon>{{ isCurrentPlan ? 'mdi-star' : 'mdi-star-plus-outline' }}</v-icon>
        </v-btn>
      </template>
      <span>{{ isCurrentPlan ? t('latestPlan.fab.isCurrentPlan') : t('latestPlan.fab.tooltip') }}</span>
    </v-tooltip>

    <!-- Confirmation Modal -->
    <SetLatestPlanModal
      v-if="selectedExecution && !isCurrentPlan"
      v-model="showModal"
      :execution-id="selectedExecution.executionId"
      :execution-name="selectedExecution.name"
      @success="handleSuccess"
      @error="handleError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import SetLatestPlanModal from '@/components/SetLatestPlanModal.vue'

const { t } = useI18n()
const generalStore = useGeneralStore()
const showSnackbar = inject<(message: string, type: string) => void>('showSnackbar')

const showModal = ref(false)

// Get the currently selected execution
const selectedExecution = computed(() => generalStore.selectedExecution)

// Check if the selected execution is the current latest plan
const isCurrentPlan = computed(() => {
  if (!selectedExecution.value) return false
  return generalStore.isLatestPlan(selectedExecution.value.executionId)
})

// Check if the feature is available and if we should show the FAB
const shouldShow = computed(() => {
  // Must have set latest plan available
  if (!generalStore.isSetLatestPlanAvailable()) return false
  
  // Must have a selected execution
  if (!selectedExecution.value) return false
  
  // The execution must be finished (can be set as latest or is already the current)
  if (!generalStore.canSetAsLatestPlan(selectedExecution.value.state)) return false
  
  return true
})

const openModal = () => {
  showModal.value = true
}

const handleSuccess = () => {
  showSnackbar?.(t('latestPlan.snackbar.success'), 'success')
}

const handleError = (message: string) => {
  showSnackbar?.(message || t('latestPlan.snackbar.error'), 'error')
}
</script>

<style scoped>
.set-current-plan-fab {
  position: fixed;
  bottom: 80px; /* Above the tab bar */
  right: 24px;
  z-index: 850;
  display: flex;
  align-items: center;
}

.fab-button {
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.4) !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.fab-button:hover:not(.is-current) {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(var(--v-theme-primary), 0.5) !important;
}

.fab-button.is-current {
  cursor: default !important;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.3) !important;
}

.fab-button.is-current:hover {
  transform: none;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .set-current-plan-fab {
    bottom: 70px;
    right: 16px;
  }
}
</style>

