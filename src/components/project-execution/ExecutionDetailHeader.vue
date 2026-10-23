<!--
  ExecutionDetailHeader: the top of an execution's detail: the name with its quick actions (mark as
  current plan, delete), its tags and description, the execution and solution states with their
  explanation, the server's message when it failed, and the main actions (load, download Excel).
-->
<template>
  <div class="execution-detail-header">
    <button
      v-if="showBack"
      type="button"
      class="execution-detail-header__back"
      @click="emit('back')"
    >
      <CoreIcon name="mdi-arrow-left" :size="18" />
      {{ $t('versionHistory.detail.backToList') }}
    </button>

    <div class="execution-detail-header__title-row">
      <h2 class="execution-detail-header__name">{{ execution.name }}</h2>
      <CoreButton
        v-if="canSetCurrentPlan"
        variant="icon"
        size="small"
        color="grey"
        icon="mdi-star-outline"
        :aria-label="$t('latestPlan.actions.setAsCurrent')"
        :title="$t('latestPlan.actions.setAsCurrent')"
        data-testid="history-detail-set-current"
        @click="emit('set-current-plan')"
      />
      <CoreButton
        variant="icon"
        size="small"
        color="danger"
        icon="mdi-delete-outline"
        :loading="deleting"
        :aria-label="$t('executionTable.deleteExecution')"
        :title="$t('executionTable.deleteExecution')"
        data-testid="history-detail-delete"
        @click="emit('delete')"
      />
    </div>

    <div v-if="currentPlan || replanning" class="execution-detail-header__tags">
      <CoreBadge
        v-if="currentPlan"
        tone="warning"
        icon="mdi-star"
        :label="$t('latestPlan.chip.current')"
        :title="$t('latestPlan.actions.isCurrentPlan')"
      />
      <CoreBadge
        v-if="replanning"
        tone="info"
        icon="mdi-calendar-sync"
        :label="$t('executionTable.replanning')"
      />
    </div>

    <p
      v-if="execution.description"
      class="execution-detail-header__description"
    >
      {{ execution.description }}
    </p>

    <div class="execution-detail-header__state">
      <span class="execution-detail-header__caption">{{
        $t('versionHistory.detail.executionState')
      }}</span>
      <ExecutionStateBadge
        kind="execution"
        :code="execution.state"
        show-message
      />
    </div>
    <div class="execution-detail-header__state">
      <span class="execution-detail-header__caption">{{
        $t('versionHistory.detail.solutionState')
      }}</span>
      <ExecutionStateBadge
        kind="solution"
        :code="execution.solution_state?.status_code"
        show-message
      />
    </div>

    <CoreAlert
      v-if="errorMessage"
      tone="error"
      :title="$t('versionHistory.detail.serverMessage')"
      :message="errorMessage"
    />

    <div class="execution-detail-header__actions">
      <CoreButton
        icon="mdi-open-in-app"
        :text="$t('executionTable.loadExecution')"
        :loading="loading"
        :loading-text="$t('versionHistory.detail.loading')"
        data-testid="history-detail-load"
        @click="emit('load')"
      />
      <CoreButton
        variant="outlined"
        icon="mdi-microsoft-excel"
        :text="$t('versionHistory.detail.downloadExcel')"
        :loading="downloading"
        :loading-text="$t('versionHistory.detail.downloading')"
        data-testid="history-detail-excel"
        @click="emit('excel')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import ExecutionStateBadge from '@cornflow-ui/core/components/project-execution/ExecutionStateBadge.vue'
import type { HistoryExecution } from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'
import { FAILED_STATES } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'

defineOptions({ name: 'ExecutionDetailHeader' })

const props = withDefaults(
  defineProps<{
    execution: HistoryExecution
    currentPlan?: boolean
    /** The "mark as current plan" action applies (feature on, execution finished, not current). */
    canSetCurrentPlan?: boolean
    loading?: boolean
    downloading?: boolean
    deleting?: boolean
    /** Shows "Back to the list" (narrow screens, where the detail replaces the list). */
    showBack?: boolean
  }>(),
  {
    currentPlan: false,
    canSetCurrentPlan: false,
    loading: false,
    downloading: false,
    deleting: false,
    showBack: false,
  },
)

const emit = defineEmits<{
  load: []
  excel: []
  'set-current-plan': []
  delete: []
  back: []
}>()

const replanning = computed(() => props.execution.config?.replanning === true)

/** What the server said about a failed execution. */
const errorMessage = computed(() =>
  FAILED_STATES.includes(props.execution.state)
    ? props.execution.message?.trim() || ''
    : '',
)
</script>

<style scoped>
.execution-detail-header {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  font-family: var(--font-sans);
}

.execution-detail-header__back {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  margin: -4px 0 0 -4px;
  padding: calc(var(--spacing) * 1);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  font: inherit;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  cursor: pointer;
}

.execution-detail-header__back:hover {
  background: var(--color-surface-hover);
}

.execution-detail-header__title-row {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--spacing) * 1);
}

.execution-detail-header__name {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-weight-medium);
  line-height: 30px;
  color: var(--color-primary);
  text-wrap: pretty;
}

.execution-detail-header__tags {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 2);
}

.execution-detail-header__description {
  margin: 0;
  font-size: var(--text-md);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.execution-detail-header__state {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
  margin-top: calc(var(--spacing) * 1);
}

.execution-detail-header__caption {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.execution-detail-header__actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: calc(var(--spacing) * 2);
  margin-top: calc(var(--spacing) * 1);
}
</style>
