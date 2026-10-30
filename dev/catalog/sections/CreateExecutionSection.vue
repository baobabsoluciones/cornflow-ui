<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Create execution</h1>
    <p class="catalog-section__lead">
      The blocks of the create-execution flows (<code>src/components/create-execution/</code>), fed
      here by sample drafts. A flow of an app's own composes them around
      <code>useExecutionDraft</code> (<code>docs/create-execution-flows.md</code>).
    </p>

    <CatalogBlock
      name="ExecutionDataCard"
      api="draft · highlight"
      note="Empty, as each data source mode offers it, and after a load that failed."
      column
    >
      <div class="grid">
        <div v-for="sample in dataSamples" :key="sample.label" class="sample">
          <span class="caption">{{ sample.label }}</span>
          <div class="data-frame">
            <ExecutionDataCard :draft="sample.draft" />
          </div>
        </div>
      </div>
    </CatalogBlock>

    <CatalogBlock name="LoadFiltersForm" api="fields · values · showErrors → change">
      <div class="filters-frame">
        <LoadFiltersForm
          :fields="filterFields"
          :values="filterValues"
          show-errors
          @change="(key, value) => (filterValues = { ...filterValues, [key]: value })"
        />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="ChecksStatus"
      api="status · results · checkedAt · blocking · disabled · highlight → run"
      column
    >
      <div class="grid">
        <div v-for="sample in checkSamples" :key="sample.status" class="sample">
          <span class="caption">{{ sample.status }}</span>
          <div class="panel-frame">
            <ChecksStatus
              :status="sample.status"
              :results="sample.results"
              :checked-at="checkedAt"
              :blocking="true"
            />
          </div>
        </div>
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="ChecksDetailDialog"
      api="v-model · results · initialKey"
      note="Everything the checks found: the checks on the left, the rows of the picked one on the right, with a search."
    >
      <CoreButton
        variant="outlined"
        icon="mdi-shield-search"
        text="Open the checks detail"
        @click="checksDetailOpen = true"
      />
      <ChecksDetailDialog v-model="checksDetailOpen" :results="[error, warning]" />
    </CatalogBlock>

    <CatalogBlock
      name="ExecutionParametersForm · ParameterInput"
      api="fields · values · solvers · defaultSolver · fromData · highlight · showErrors → change"
    >
      <div class="panel-frame">
        <ExecutionParametersForm
          :fields="parameterFields"
          :values="parameterValues"
          :solvers="['mip.highs', 'mip.gurobi', 'heuristic.greedy']"
          default-solver="mip.highs"
          :from-data="['start_date']"
          @change="(key, value) => (parameterValues = { ...parameterValues, [key]: value })"
        />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="LaunchPanel"
      api="draft · v-model:collapsed → go, view, history"
      note="Cannot launch and why; ready with unapplied changes and developer mode; launched; folded."
    >
      <div class="panel-row">
        <div v-for="sample in panelSamples" :key="sample.label" class="sample">
          <span class="caption">{{ sample.label }}</span>
          <div class="launch-frame" :class="{ 'is-collapsed': sample.collapsed }">
            <LaunchPanel :draft="sample.draft" :collapsed="sample.collapsed" />
          </div>
        </div>
      </div>
    </CatalogBlock>

    <CatalogBlock name="LaunchResult" api="name · execution → view, another, history">
      <div v-for="state in [-7, 0, 1, -1]" :key="state" class="panel-frame">
        <LaunchResult
          name="Plan week 43"
          :execution="{ executionId: 'e1', state, createdAt: minutesAgo(2), config: { timeLimit: 300 } }"
        />
      </div>
    </CatalogBlock>

    <CatalogBlock name="DraftBanner · ExitCreateExecutionDialog" api="draft → resume, discard · modelValue · saving → save, leave, cancel" column>
      <DraftBanner :draft="savedDraft" />
      <div><CoreButton variant="outlined" text="Open the exit dialog" @click="exitOpen = true" /></div>
      <ExitCreateExecutionDialog
        v-model="exitOpen"
        @save="exitOpen = false"
        @leave="exitOpen = false"
        @cancel="exitOpen = false"
      />
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import ChecksDetailDialog from '@cornflow-ui/core/components/create-execution/ChecksDetailDialog.vue'
import ChecksStatus from '@cornflow-ui/core/components/create-execution/ChecksStatus.vue'
import DraftBanner from '@cornflow-ui/core/components/create-execution/DraftBanner.vue'
import ExecutionDataCard from '@cornflow-ui/core/components/create-execution/ExecutionDataCard.vue'
import ExecutionParametersForm from '@cornflow-ui/core/components/create-execution/ExecutionParametersForm.vue'
import ExitCreateExecutionDialog from '@cornflow-ui/core/components/create-execution/ExitCreateExecutionDialog.vue'
import LaunchPanel from '@cornflow-ui/core/components/create-execution/LaunchPanel.vue'
import LaunchResult from '@cornflow-ui/core/components/create-execution/LaunchResult.vue'
import LoadFiltersForm from '@cornflow-ui/core/components/create-execution/LoadFiltersForm.vue'
import type { CheckResult, ChecksStatus as Status } from '@cornflow-ui/core/composables/create-execution/useExecutionDraft'
import CatalogBlock from '../CatalogBlock.vue'

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const checkedAt = new Date()

const noop = () => {}
const asyncNoop = async () => true

/** A sample of what `useExecutionDraft` returns, with only what the blocks read. */
function sampleDraft(overrides: Record<string, any> = {}) {
  return reactive({
    execution: { instance: null, config: {}, name: '', description: '' },
    files: [] as File[],
    loadStatus: 'empty',
    loadErrors: null,
    rawLoadErrors: null,
    loadWarning: null,
    fromExecution: null,
    nameProposed: false,
    fromDataKeys: [],
    dataErrors: null,
    checks: { status: 'none', results: [], checkedAt: null },
    launch: { running: false, step: null, executionId: null },
    solution: { enabled: false, file: null, data: null, errors: null },
    etlReviewState: null,
    acceptedExtensions: ['xlsx', 'csv', 'json'],
    dataSourceMode: 'files',
    loadFilterFields: [],
    parameterFields: [],
    showParameters: true,
    showSolver: false,
    solvers: [],
    defaultSolver: '',
    developerMode: false,
    blockOnCheckErrors: true,
    hasChecks: true,
    isLoaded: false,
    canLoad: false,
    filtersChanged: false,
    filesChanged: false,
    missingRequiredFilters: [],
    pendingChangesCount: 0,
    missing: [],
    canLaunch: false,
    isLaunched: false,
    launchedExecution: null,
    addFiles: noop,
    removeFile: noop,
    setFilter: noop,
    load: asyncNoop,
    setInstance: noop,
    setDataErrors: noop,
    registerPendingChangesApplier: noop,
    setParameter: noop,
    setName: noop,
    setDescription: noop,
    runChecks: asyncNoop,
    setSolutionMode: noop,
    setSolutionFile: asyncNoop,
    launchExecution: asyncNoop,
    reset: noop,
    ...overrides,
  }) as any
}

const filterFields = [
  {
    key: 'plant',
    title: 'Plant to load',
    type: 'select',
    required: true,
    options: [
      { value: 'north', label: 'North plant' },
      { value: 'south', label: 'South plant' },
    ],
  },
  { key: 'since', title: 'Data since', type: 'date' },
]
const filterValues = ref<Record<string, unknown>>({})

const dataSamples = [
  { label: 'files', draft: sampleDraft() },
  { label: 'database', draft: sampleDraft({ dataSourceMode: 'database', canLoad: true }) },
  {
    label: 'database-filtered',
    draft: sampleDraft({ dataSourceMode: 'database-filtered', loadFilterFields: filterFields, missingRequiredFilters: [filterFields[0]] }),
  },
  {
    label: 'error',
    draft: sampleDraft({
      loadStatus: 'error',
      files: [new File([''], 'data_with_errors.xlsx')],
      loadErrors: {
        count: 3,
        groups: [
          {
            table: 'lines',
            title: 'Lines',
            items: ['Row 1 (L1): Capacity: must be a number', 'Row 2 (L2): Capacity: must be a number', 'and 1 more'],
          },
        ],
      },
    }),
  },
]

const warning: CheckResult = {
  key: 'tight',
  title: 'Tight capacity',
  description: 'Lines used above 95 % of their capacity',
  kind: 'warning',
  columns: [{ key: 'line', title: 'Line' }, { key: 'use', title: 'Use (%)' }, { key: 'week', title: 'Week' }],
  records: [{ line: 'L2', use: 97.5, week: 43 }],
}
const error: CheckResult = {
  key: 'missing',
  title: 'Products not defined',
  description: '',
  kind: 'error',
  columns: [{ key: 'product', title: 'Product' }, { key: 'week', title: 'Week' }],
  records: [
    { product: 'P-199', week: 43 },
    { product: 'P-207', week: 44 },
    { product: 'P-212', week: 44 },
    { product: 'P-230', week: 45 },
  ],
}
const checksDetailOpen = ref(false)

const checkSamples: { status: Status; results: CheckResult[] }[] = [
  { status: 'none', results: [] },
  { status: 'running', results: [] },
  { status: 'ok', results: [] },
  { status: 'warnings', results: [warning] },
  { status: 'errors', results: [error, warning] },
  { status: 'stale', results: [warning] },
]

const parameterFields = [
  {
    key: 'objective',
    title: 'Objective',
    type: 'select',
    required: true,
    options: [
      { value: 'cost', label: 'Cost' },
      { value: 'service', label: 'Service' },
      { value: 'balanced', label: 'Balanced' },
    ],
  },
  {
    key: 'horizon',
    title: 'Horizon',
    type: 'select',
    options: [
      { value: 1, label: '1 week' },
      { value: 2, label: '2 weeks' },
      { value: 4, label: '4 weeks' },
      { value: 8, label: '8 weeks' },
    ],
  },
  { key: 'start_date', title: 'Plan start date', type: 'date' },
  { key: 'timeLimit', title: 'Time limit', type: 'number', default: 300, suffix: 'sec' },
  { key: 'gap', title: 'Optimality gap', type: 'float', default: 0.01 },
  { key: 'overtime', title: 'Allow overtime', type: 'boolean', default: false },
]
const parameterValues = ref<Record<string, unknown>>({
  start_date: '2026-10-26',
  timeLimit: 300,
  gap: 0.01,
  overtime: false,
  solver: 'mip.highs',
})

const panelSamples = [
  {
    label: 'missing',
    collapsed: false,
    draft: sampleDraft({
      parameterFields,
      execution: { instance: null, config: { timeLimit: 300, gap: 0.01, overtime: false }, name: '', description: '' },
      missing: [
        { key: 'data', text: 'The data is missing', target: 'data' },
        { key: 'name', text: 'The name is missing', target: 'name' },
        { key: 'param:objective', text: '“Objective” is missing', target: 'param:objective' },
      ],
    }),
  },
  {
    label: 'ready · unapplied changes · developer mode',
    collapsed: false,
    draft: sampleDraft({
      isLoaded: true,
      parameterFields,
      developerMode: true,
      nameProposed: true,
      canLaunch: true,
      pendingChangesCount: 2,
      checks: { status: 'warnings', results: [warning], checkedAt },
      execution: { instance: {}, config: { ...parameterValues.value, objective: 'cost' }, name: 'Plan week 43', description: '' },
    }),
  },
  {
    label: 'launched',
    collapsed: false,
    draft: sampleDraft({
      isLaunched: true,
      execution: { instance: {}, config: {}, name: 'Plan week 43', description: '' },
      launchedExecution: { executionId: 'e1', state: 0, createdAt: minutesAgo(1), config: { timeLimit: 300 } },
    }),
  },
  {
    label: 'folded',
    collapsed: true,
    draft: sampleDraft({ missing: [{ key: 'data', text: 'The data is missing', target: 'data' }] }),
  },
]

const savedDraft = {
  savedAt: new Date().toISOString(),
  name: 'Plan week 43',
  description: '',
  config: {},
  instanceData: null,
  files: [],
  loadedFileNames: [],
  loadedFilters: null,
  fromExecution: null,
  pendingChanges: null,
  pendingChangesCount: 1,
}
const exitOpen = ref(false)
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  align-items: start;
  gap: calc(var(--spacing) * 4);
}

.sample {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
}

.data-frame {
  height: 380px;
}

.filters-frame {
  width: 520px;
}

.panel-frame {
  width: 340px;
  padding: calc(var(--spacing) * 4);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-lg);
}

.panel-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: calc(var(--spacing) * 4);
}

.launch-frame {
  width: 340px;
  height: 640px;
}

.launch-frame.is-collapsed {
  width: 56px;
}
</style>
