<!--
  ExecutionListItem: one execution in the history list. First line: state icon, name, its "current
  plan" and "replanning" tags, description and time. Second line: solution state · user · solver ·
  duration. Loading it and downloading its Excel are at hand on the row (on hover, or always with
  `actionsAlways`).
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
            v-if="replanning"
            size="sm"
            tone="info"
            icon="mdi-calendar-sync"
            :label="$t('executionTable.replanning')"
          />
          <CoreBadge
            v-if="currentPlan"
            size="sm"
            tone="warning"
            icon="mdi-star"
            :label="$t('latestPlan.chip.current')"
          />
          <span
            v-if="execution.description"
            class="execution-row__description"
            >{{ execution.description }}</span
          >
          <span class="execution-row__time">{{ time }}</span>
        </span>
        <span class="execution-row__meta">
          <ExecutionStateBadge
            kind="solution"
            :code="execution.solution_state?.status_code"
            variant="text"
          />
          <template v-for="detail in details" :key="detail.key">
            <span aria-hidden="true">·</span>
            <span class="execution-row__detail">
              <CoreIcon
                v-if="detail.icon"
                :name="detail.icon"
                :size="13"
                class="execution-row__detail-icon"
              />
              {{ detail.text }}
            </span>
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
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import ExecutionStateBadge from '@cornflow-ui/core/components/project-execution/ExecutionStateBadge.vue'
import {
  formatDuration,
  type HistoryExecution,
} from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'
import { isExecutionActive } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'
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
    /** Current time, in ms (live duration of a running execution). */
    now?: number
  }>(),
  {
    selected: false,
    currentPlan: false,
    loading: false,
    downloading: false,
    actionsAlways: false,
    now: () => Date.now(),
  },
)

const emit = defineEmits<{ select: []; load: []; excel: [] }>()

const generalStore = useGeneralStore()

const time = computed(() => formatLocalTimeHHmm(props.execution.createdAt))

const replanning = computed(() => props.execution.config?.replanning === true)

const columns = computed<{
  showUserName?: boolean
  showUserFullName?: boolean
  showSolver?: boolean
}>(
  () =>
    generalStore.appConfig.parameters?.showExtraProjectExecutionColumns ?? {},
)

/** The user as the app shows it (`showExtraProjectExecutionColumns`). */
const user = computed(() => {
  if (columns.value.showUserFullName)
    return props.execution.userFullName || props.execution.userName
  if (columns.value.showUserName) return props.execution.userName
  return null
})

/** From creation to the end, or until now while it runs. */
const duration = computed(() => {
  const created = new Date(props.execution.createdAt).getTime()
  const end = isExecutionActive(props.execution.state)
    ? props.now
    : new Date(props.execution.finishedAt ?? '').getTime()
  return Number.isNaN(created) || Number.isNaN(end)
    ? null
    : formatDuration((end - created) / 1000)
})

/** What follows the solution state on the second line. */
const details = computed(() =>
  [
    { key: 'user', text: user.value, icon: '' },
    {
      key: 'solver',
      text:
        columns.value.showSolver !== false
          ? props.execution.config?.solver
          : null,
      icon: '',
    },
    { key: 'duration', text: duration.value, icon: 'mdi-timer-outline' },
  ].filter((detail) => Boolean(detail.text)),
)
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
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 2.5);
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
  gap: calc(var(--spacing) * 1.5);
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
  flex: none;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.is-selected .execution-row__name {
  color: var(--color-primary);
}

.execution-row__line :deep(.core-badge) {
  flex: none;
}

.execution-row__description {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.execution-row__time {
  flex: none;
  margin-left: auto;
  padding-left: calc(var(--spacing) * 2);
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
}

.execution-row__meta {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}

.execution-row__detail {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
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
