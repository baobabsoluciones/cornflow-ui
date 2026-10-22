<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Execution history</h1>
    <p class="catalog-section__lead">
      The pieces of the history, with the states and settings of
      <code>src/app/config.ts</code>.
    </p>

    <CatalogBlock
      name="ExecutionStateBadge"
      api="kind (execution | solution) · code · variant (chip | icon | text) · showMessage"
      column
    >
      <span class="caption">Execution</span>
      <div class="row">
        <span v-for="code in executionCodes" :key="code" class="code-sample">
          <ExecutionStateBadge kind="execution" :code="code" />
          <code>{{ code }}</code>
        </span>
      </div>
      <span class="caption">Solution</span>
      <div class="row">
        <span v-for="code in solutionCodes" :key="code" class="code-sample">
          <ExecutionStateBadge kind="solution" :code="code" />
          <code>{{ code }}</code>
        </span>
      </div>
      <span class="caption">Variants</span>
      <div class="row">
        <ExecutionStateBadge kind="execution" :code="1" show-message />
        <ExecutionStateBadge kind="solution" :code="5" show-message />
        <span class="row">
          <ExecutionStateBadge
            v-for="code in [0, -7, -1, -4, 1]"
            :key="code"
            kind="execution"
            :code="code"
            variant="icon"
          />
        </span>
        <span class="row">
          <ExecutionStateBadge
            v-for="code in [2, 3, -2, -3]"
            :key="code"
            kind="solution"
            :code="code"
            variant="text"
          />
        </span>
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="ExecutionList · ExecutionListItem"
      api="groups · selectedId · isCurrentPlan · loadingIds · downloadingIds · preview → select, load, excel"
    >
      <div class="list-frame">
        <ExecutionList
          :groups="groups"
          :selected-id="selectedId"
          :is-current-plan="(id) => id === 'e3'"
          :loading-ids="loadingIds"
          preview
          :now="now"
          @select="selectedId = $event"
          @load="loadingIds = new Set([$event.id])"
        />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="ExecutionDetailHeader"
      api="execution · currentPlan · canSetCurrentPlan · loading · downloading · deleting · showBack → load, excel, set-current-plan, delete, back"
      column
    >
      <ExecutionDetailHeader :execution="byId('e3')" current-plan />
      <ExecutionDetailHeader
        :execution="byId('e6')"
        can-set-current-plan
        show-back
      />
    </CatalogBlock>

    <CatalogBlock
      name="Execution detail"
      note="Header, progress, data and parameters of the selected execution, as the history shows them."
      column
    >
      <div class="detail-frame">
        <div class="detail-section">
          <ExecutionDetailHeader
            :execution="selected"
            :current-plan="selected.id === 'e3'"
            :can-set-current-plan="selected.id !== 'e3'"
          />
        </div>
        <div class="detail-section">
          <CoreTimeline
            title="Progress"
            :steps="details.timelineSteps(selected, now)"
          />
        </div>
        <div class="detail-section">
          <CoreDescriptionList
            title="Execution data"
            :items="details.dataItems(selected, now)"
            :min-column-width="150"
          />
        </div>
      </div>
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CoreDescriptionList from '@cornflow-ui/core/components/core/CoreDescriptionList.vue'
import CoreTimeline from '@cornflow-ui/core/components/core/CoreTimeline.vue'
import ExecutionDetailHeader from '@cornflow-ui/core/components/project-execution/ExecutionDetailHeader.vue'
import ExecutionList from '@cornflow-ui/core/components/project-execution/ExecutionList.vue'
import ExecutionStateBadge from '@cornflow-ui/core/components/project-execution/ExecutionStateBadge.vue'
import {
  useExecutionDetails,
  type HistoryExecution,
} from '@cornflow-ui/core/composables/project-execution/useExecutionDetails'
import CatalogBlock from '../CatalogBlock.vue'

const executionCodes = [1, 0, -7, -1, -2, -3, -5, -6, -4, 2]
const solutionCodes = [1, 2, 3, 4, 5, -4, -1, -2, -5, 0, -3]

const details = useExecutionDetails()

const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => clearInterval(clock))

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()
const daysAgo = (days: number, hour: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

const make = (
  id: string,
  name: string,
  description: string,
  state: number,
  solution: number,
  createdAt: string,
  finishedAt: string | null,
  extra: Partial<HistoryExecution> = {},
): HistoryExecution => ({
  id,
  name,
  description,
  state,
  createdAt,
  finishedAt,
  userName: 'agarcia',
  userFullName: 'Ana García',
  config: { solver: 'mip_solver', timeLimit: 900 },
  solution_state: { status_code: solution },
  message: '',
  ...extra,
})

const executions: HistoryExecution[] = [
  make(
    'e1',
    'Plan week 43',
    'Base scenario with updated demand',
    0,
    0,
    minutesAgo(8),
    null,
  ),
  make(
    'e2',
    'Plan week 43 · adjustment',
    'Replanning after line 2 stopped',
    -7,
    0,
    minutesAgo(1),
    null,
    {
      config: { solver: 'mip_solver', replanning: true },
    },
  ),
  make(
    'e3',
    'Plan week 43',
    'Base scenario',
    1,
    1,
    minutesAgo(95),
    minutesAgo(77),
  ),
  make(
    'e4',
    'High demand scenario',
    '+15 % on the sales forecast',
    1,
    5,
    daysAgo(1, 17),
    daysAgo(1, 18),
  ),
  make(
    'e6',
    'Plan week 43',
    'First proposal',
    -1,
    0,
    daysAgo(1, 9),
    daysAgo(1, 9),
    {
      message:
        "Column 'capacity' not found in the products master table (row 14).",
    },
  ),
  make(
    'e8',
    'Monthly plan',
    'Draft not run',
    -4,
    -4,
    daysAgo(2, 16),
    daysAgo(2, 16),
  ),
]

const byId = (id: string) =>
  executions.find((execution) => execution.id === id)!

const groups = [
  { key: 'today', label: 'Today', executions: executions.slice(0, 3) },
  { key: 'yesterday', label: 'Yesterday', executions: executions.slice(3, 5) },
  { key: 'before', label: 'Two days ago', executions: executions.slice(5) },
]

const selectedId = ref('e1')
const selected = computed(() => byId(selectedId.value))
const loadingIds = ref(new Set<string>())
</script>

<style scoped>
.catalog-section__lead {
  margin: 0;
  color: var(--color-text-muted);
}

.caption {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: calc(var(--spacing) * 3);
}

.code-sample {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.list-frame {
  width: 380px;
  padding: 0 calc(var(--spacing) * 1.5) calc(var(--spacing) * 1.5);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-md);
}

.detail-frame {
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-lg);
}

.detail-section {
  padding: calc(var(--spacing) * 5) calc(var(--spacing) * 7);
}

.detail-section + .detail-section {
  border-top: 1px solid var(--color-divider);
}
</style>
