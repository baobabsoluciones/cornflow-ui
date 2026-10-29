<!--
  ExecutionSummary: the loaded execution at the head of its views (input data, results,
  dashboards): its name, a line under it and badges beside it (`useExecutionSummary`; an app
  changes them through `parameters.executionSummary`). Resting the pointer on the name opens the
  execution's details, as in the history. Nothing is shown without an execution.

  <ExecutionSummary />                         the selected execution
  <ExecutionSummary :execution="execution" />
-->
<template>
  <div v-if="loaded && content" class="execution-summary" data-testid="execution-summary">
    <CoreIcon name="mdi-cog-outline" :size="16" class="execution-summary__icon" />
    <CoreHoverCard side="bottom" align="end" :width="420">
      <template #trigger>
        <span class="execution-summary__text" tabindex="0">
          <span class="execution-summary__name">{{ loaded.name }}</span>
          <span v-if="content.meta" class="execution-summary__meta" :title="content.meta">
            {{ content.meta }}
          </span>
        </span>
      </template>
      <ExecutionPreview :execution="preview" :now="Date.now()" />
    </CoreHoverCard>
    <span v-if="content.badges.length" class="execution-summary__badges">
      <CoreBadge
        v-for="badge in content.badges"
        :key="badge.label"
        :label="badge.label"
        :tone="badge.tone"
        :spin="badge.spin"
        :title="badge.title"
        size="sm"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreHoverCard from '@cornflow-ui/core/components/core/CoreHoverCard.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import ExecutionPreview from '@cornflow-ui/core/components/project-execution/ExecutionPreview.vue'
import { useExecutionSummary } from '@cornflow-ui/core/composables/project-execution/useExecutionSummary'
import type { HistoryExecution } from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'
import type { LoadedExecution } from '@cornflow-ui/core/models/LoadedExecution'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

defineOptions({ name: 'CoreExecutionSummary' })

const props = defineProps<{
  /** The execution to sum up; the selected one when not given. */
  execution?: LoadedExecution | null
}>()

const store = useGeneralStore()

const loaded = computed<LoadedExecution | null>(() =>
  props.execution === undefined ? store.selectedExecution : props.execution,
)
const content = useExecutionSummary(loaded)

/** The execution as the history's preview reads it. */
const preview = computed<HistoryExecution>(() => {
  const execution = loaded.value as LoadedExecution
  return {
    id: execution.executionId,
    name: execution.name,
    description: execution.description,
    state: execution.state,
    message: execution.messageState,
    createdAt: execution.createdAt,
    config: execution.config,
    solution_state: execution.solutionState,
  }
})
</script>

<style scoped>
.execution-summary {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  min-width: 0;
  font-family: var(--font-sans);
}

.execution-summary__icon {
  flex: none;
  color: var(--color-text-subtle);
}

.execution-summary__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: var(--radius-sm);
  cursor: default;
}

.execution-summary__text:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.execution-summary__name,
.execution-summary__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: var(--leading-tight);
}

.execution-summary__name {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.execution-summary__meta {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.execution-summary__badges {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
}
</style>
