<!--
  ExecutionPreview: a summary of an execution (name, states, data and parameters), for the card
  that opens when the pointer rests on a row of the history.
-->
<template>
  <div class="execution-preview">
    <div class="execution-preview__head">
      <span class="execution-preview__name">{{ execution.name }}</span>
      <span v-if="execution.description" class="execution-preview__description">
        {{ execution.description }}
      </span>
      <span class="execution-preview__states">
        <ExecutionStateBadge kind="execution" :code="execution.state" />
        <ExecutionStateBadge
          kind="solution"
          :code="execution.solution_state?.status_code"
        />
      </span>
    </div>
    <div class="execution-preview__section">
      <CoreDescriptionList
        :title="$t('versionHistory.detail.data')"
        :items="dataItems(execution, now)"
        :min-column-width="130"
      />
    </div>
    <div v-if="parameters.length > 0" class="execution-preview__section">
      <CoreDescriptionList
        :title="$t('versionHistory.detail.parameters')"
        :items="parameters"
        :min-column-width="130"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreDescriptionList from '@cornflow-ui/core/components/core/CoreDescriptionList.vue'
import ExecutionStateBadge from '@cornflow-ui/core/components/project-execution/ExecutionStateBadge.vue'
import {
  useExecutionDetails,
  type HistoryExecution,
} from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'

defineOptions({ name: 'ExecutionPreview' })

const props = defineProps<{
  execution: HistoryExecution
  /** Current time, in ms (live durations). */
  now: number
}>()

const { dataItems, parameterItems } = useExecutionDetails()

const parameters = computed(() => parameterItems(props.execution))
</script>

<style scoped>
.execution-preview {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

.execution-preview__head {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 3.5) calc(var(--spacing) * 4)
    calc(var(--spacing) * 3);
  border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 12%, #ffffff);
  background: color-mix(in srgb, var(--color-primary) 7%, #ffffff);
}

.execution-preview__name {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.execution-preview__description {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.execution-preview__states {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 1.5);
  margin-top: calc(var(--spacing) * 1);
}

.execution-preview__section {
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 4);
}

.execution-preview__section + .execution-preview__section {
  border-top: 1px solid var(--color-divider);
}
</style>
