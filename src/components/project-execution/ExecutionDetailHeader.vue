<!--
  ExecutionDetailHeader: the top of an execution's detail: name and description with its tags, the
  execution and solution states with their explanation, the server's message when it failed, and
  the actions (load, download Excel, mark as current plan, delete).
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

    <div class="execution-detail-header__title-block">
      <div class="execution-detail-header__title-row">
        <h2 class="execution-detail-header__name">{{ execution.name }}</h2>
        <CoreBadge
          v-if="currentPlan"
          tone="warning"
          icon="mdi-star"
          :label="$t('latestPlan.chip.current')"
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
    </div>

    <div class="execution-detail-header__states">
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
      <CoreButton
        v-if="canSetCurrentPlan"
        variant="outlined"
        icon="mdi-star-outline"
        :text="$t('latestPlan.actions.setAsCurrent')"
        data-testid="history-detail-set-current"
        @click="emit('set-current-plan')"
      />
      <span v-if="currentPlan" class="execution-detail-header__is-current">
        <CoreIcon name="mdi-star" :size="18" />
        {{ $t('latestPlan.actions.isCurrentPlan') }}
      </span>
      <span class="execution-detail-header__spacer" />
      <CoreButton
        variant="text"
        color="danger"
        icon="mdi-delete-outline"
        :text="$t('executionTable.deleteExecution')"
        :loading="deleting"
        data-testid="history-detail-delete"
        @click="emit('delete')"
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
  gap: calc(var(--spacing) * 3.5);
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

.execution-detail-header__title-block {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
}

.execution-detail-header__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2);
}

.execution-detail-header__name {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-weight-medium);
  line-height: 26px;
  color: var(--color-primary);
  text-wrap: pretty;
}

.execution-detail-header__description {
  margin: 0;
  font-size: var(--text-md);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.execution-detail-header__states {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 3) calc(var(--spacing) * 8);
}

.execution-detail-header__state {
  display: flex;
  flex: 1 1 200px;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
  max-width: 340px;
}

.execution-detail-header__caption {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.execution-detail-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  margin-top: 2px;
}

.execution-detail-header__is-current {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  height: 36px;
  padding: 0 calc(var(--spacing) * 3);
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-warning-strong);
}

.execution-detail-header__is-current :deep(.core-icon) {
  color: var(--color-warning);
}

.execution-detail-header__spacer {
  flex: 1;
}
</style>
