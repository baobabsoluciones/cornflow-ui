<!--
  ExecutionListItem: one execution in the history list: state icon, name with its "current plan"
  and "replanning" tags, time, description, and solution state · user. Loading it and downloading
  its Excel are at hand on the row (on hover, or always with `actionsAlways`).
-->
<template>
  <div
    :class="['execution-row', { 'is-selected': selected }]"
    data-testid="history-row"
  >
    <button
      type="button"
      class="execution-row__main"
      :aria-current="selected ? 'true' : undefined"
      @click="emit('select')"
    >
      <ExecutionStateBadge
        kind="execution"
        :code="execution.state"
        variant="icon"
        class="execution-row__state"
      />
      <span class="execution-row__body">
        <span class="execution-row__line">
          <span class="execution-row__name">{{ execution.name }}</span>
          <CoreBadge
            v-if="currentPlan"
            size="sm"
            tone="warning"
            icon="mdi-star"
            :label="$t('latestPlan.chip.current')"
          />
          <CoreBadge
            v-if="replanning"
            size="sm"
            tone="info"
            icon="mdi-calendar-sync"
            :label="$t('executionTable.replanning')"
          />
          <span class="execution-row__spacer" />
          <span class="execution-row__time">{{ time }}</span>
        </span>
        <span v-if="execution.description" class="execution-row__description">
          {{ execution.description }}
        </span>
        <span class="execution-row__meta">
          <ExecutionStateBadge
            kind="solution"
            :code="execution.solution_state?.status_code"
            variant="text"
          />
          <template v-if="user">
            <span aria-hidden="true">·</span>
            <span class="execution-row__user">{{ user }}</span>
          </template>
        </span>
      </span>
    </button>

    <div
      :class="[
        'execution-row__actions',
        { 'is-visible': actionsAlways || loading || downloading },
      ]"
    >
      <CoreButton
        variant="icon"
        size="small"
        icon="mdi-open-in-app"
        :loading="loading"
        :aria-label="$t('executionTable.loadExecution')"
        :title="$t('executionTable.loadExecution')"
        data-testid="history-row-load"
        @click="emit('load')"
      />
      <CoreButton
        variant="icon"
        size="small"
        icon="mdi-microsoft-excel"
        :loading="downloading"
        :aria-label="$t('versionHistory.detail.downloadExcel')"
        :title="$t('versionHistory.detail.downloadExcel')"
        data-testid="history-row-excel"
        @click="emit('excel')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import ExecutionStateBadge from '@cornflow-ui/core/components/project-execution/ExecutionStateBadge.vue'
import type { HistoryExecution } from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { formatLocalTimeHHmm } from '@cornflow-ui/core/utils/date'

defineOptions({ name: 'ExecutionListItem' })

const props = withDefaults(
  defineProps<{
    execution: HistoryExecution
    selected?: boolean
    currentPlan?: boolean
    loading?: boolean
    downloading?: boolean
    /** Shows the row actions without hovering (narrow screens, touch). */
    actionsAlways?: boolean
  }>(),
  {
    selected: false,
    currentPlan: false,
    loading: false,
    downloading: false,
    actionsAlways: false,
  },
)

const emit = defineEmits<{ select: []; load: []; excel: [] }>()

const generalStore = useGeneralStore()

const time = computed(() => formatLocalTimeHHmm(props.execution.createdAt))

const replanning = computed(() => props.execution.config?.replanning === true)

/** The user as the app shows it (`showExtraProjectExecutionColumns`). */
const user = computed(() => {
  const columns: { showUserFullName?: boolean; showUserName?: boolean } =
    generalStore.appConfig.parameters?.showExtraProjectExecutionColumns ?? {}
  if (columns.showUserFullName)
    return props.execution.userFullName || props.execution.userName
  if (columns.showUserName) return props.execution.userName
  return null
})
</script>

<style scoped>
.execution-row {
  position: relative;
  border-radius: var(--radius-md);
  transition: background-color var(--duration-base) var(--ease-standard);
}

.execution-row:hover {
  background: var(--color-surface-hover);
}

.execution-row.is-selected {
  background: var(--color-primary-subtle);
}

.execution-row__main {
  display: flex;
  gap: calc(var(--spacing) * 2.5);
  width: 100%;
  box-sizing: border-box;
  padding: calc(var(--spacing) * 2.5);
  border: 0;
  border-radius: inherit;
  background: none;
  font: inherit;
  font-family: var(--font-sans);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.execution-row__main:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.execution-row__state {
  padding-top: 1px;
}

.execution-row__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.execution-row__line,
.execution-row__meta {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
}

.execution-row__name {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.is-selected .execution-row__name {
  color: var(--color-primary);
}

.execution-row__spacer {
  flex: 1;
}

.execution-row__time {
  flex: none;
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
}

.execution-row__description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.execution-row__meta {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}

.execution-row__user {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-row__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  padding-left: calc(var(--spacing) * 2);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-standard);
}

/* The actions sit on the row: same background, so they cover the time underneath. */
.execution-row:hover .execution-row__actions {
  background: var(--color-surface-hover);
}

.is-selected .execution-row__actions {
  background: var(--color-primary-subtle);
}

.execution-row:hover .execution-row__actions,
.execution-row:focus-within .execution-row__actions,
.execution-row__actions.is-visible {
  opacity: 1;
  pointer-events: auto;
}
</style>
