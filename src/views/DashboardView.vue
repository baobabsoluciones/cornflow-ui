<template>
  <div class="view-container">
    <CoreTitleView icon="mdi-table-arrow-left" title="Dashboard">
      <template v-if="selectedExecution" #actions>
        <CoreExecutionSummary />
      </template>
    </CoreTitleView>
    <CoreEmptyState
      v-if="!selectedExecution"
      class="dashboard-view__empty"
      icon="mdi-alert-circle-outline"
      :title="$t('projectExecution.infoCard.noExecutionSelected')"
      :text="$t('projectExecution.infoCard.loadExecutionMessage')"
      :action-label="$t('projectExecution.infoCard.loadFromHistory')"
      data-testid="dashboard-no-execution"
      @action="router.push('/history-execution')"
    />
    <CoreEmptyState
      v-else-if="isExecutionActive(selectedExecution.state)"
      class="dashboard-view__empty"
      icon="mdi-progress-clock"
      :title="$t('projectExecution.infoCard.executionCreated')"
      :text="$t('projectExecution.infoCard.solutionWillLoadMessage')"
      data-testid="dashboard-running"
    />
    <DashboardMain
      v-if="selectedExecution"
      :execution="selectedExecution"
      :dashboard-type="dashboardType"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import CoreExecutionSummary from '@cornflow-ui/core/components/ExecutionSummary.vue'
import { isExecutionActive } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'
import { getSectionType } from '@cornflow-ui/core/services/FrontendAutomationService'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import DashboardMain from '@/app/components/DashboardMain.vue'

defineOptions({ name: 'DashboardView' })

const generalStore = useGeneralStore()
const route = useRoute()
const router = useRouter()

const selectedExecution = computed(() => generalStore.selectedExecution)

/** The input data's dashboard or the results', by the route. */
const dashboardType = computed(() =>
  getSectionType(route.path) === 'input-data' ? 'instance' : 'solution',
)
</script>

<style scoped>
.dashboard-view__empty {
  margin-top: calc(var(--spacing) * 6);
}

:deep(.v-table) {
  height: 55vh;
}
</style>
