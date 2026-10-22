<!--
  ExecutionList: the executions of the history grouped by day, each day with its heading and
  count. With `preview`, resting the pointer on a row opens its summary beside the list.
-->
<template>
  <div class="execution-list">
    <section
      v-for="group in groups"
      :key="group.key"
      class="execution-list__day"
      :aria-label="group.label"
      data-testid="history-day"
    >
      <h3 class="execution-list__day-heading">
        <span class="execution-list__day-label">{{ group.label }}</span>
        <span class="execution-list__day-count">{{
          group.executions.length
        }}</span>
      </h3>
      <CoreHoverCard
        v-for="execution in group.executions"
        :key="execution.id"
        :disabled="!preview || execution.id === selectedId"
      >
        <template #trigger>
          <ExecutionListItem
            :execution="execution"
            :selected="execution.id === selectedId"
            :current-plan="isCurrentPlan(execution.id)"
            :loading="loadingIds.has(execution.id)"
            :downloading="downloadingIds.has(execution.id)"
            :actions-always="actionsAlways"
            @select="emit('select', execution.id)"
            @load="emit('load', execution)"
            @excel="emit('excel', execution)"
          />
        </template>
        <ExecutionPreview :execution="execution" :now="now" />
      </CoreHoverCard>
    </section>
  </div>
</template>

<script setup lang="ts">
import CoreHoverCard from '@cornflow-ui/core/components/core/CoreHoverCard.vue'
import ExecutionListItem from '@cornflow-ui/core/components/project-execution/ExecutionListItem.vue'
import ExecutionPreview from '@cornflow-ui/core/components/project-execution/ExecutionPreview.vue'
import type { HistoryExecution } from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'

defineOptions({ name: 'ExecutionList' })

export interface ExecutionDay {
  key: string
  label: string
  executions: HistoryExecution[]
}

withDefaults(
  defineProps<{
    groups: ExecutionDay[]
    selectedId?: string | null
    isCurrentPlan?: (id: string) => boolean
    loadingIds?: Set<string>
    downloadingIds?: Set<string>
    actionsAlways?: boolean
    /** Opens a summary of the row under the pointer. */
    preview?: boolean
    /** Current time, in ms (live durations in the summary). */
    now?: number
  }>(),
  {
    selectedId: null,
    isCurrentPlan: () => false,
    loadingIds: () => new Set<string>(),
    downloadingIds: () => new Set<string>(),
    actionsAlways: false,
    preview: false,
    now: () => Date.now(),
  },
)

const emit = defineEmits<{
  select: [id: string]
  load: [execution: HistoryExecution]
  excel: [execution: HistoryExecution]
}>()
</script>

<style scoped>
.execution-list {
  display: flex;
  flex-direction: column;
  font-family: var(--font-sans);
}

.execution-list__day {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.execution-list__day-heading {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  margin: 0;
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 2.5)
    calc(var(--spacing) * 1);
  background: var(--color-surface);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
}

.execution-list__day-label {
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.execution-list__day-count {
  font-weight: var(--font-weight-regular);
  color: var(--color-text-subtle);
}
</style>
