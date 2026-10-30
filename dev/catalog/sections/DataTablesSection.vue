<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Data tables</h1>
    <p class="catalog-section__lead">
      The table of the master data, the execution data and the review of a new execution
      (<code>src/components/core/data-table/</code>). The sample keeps its changes in the pending
      changes store (<code>useTableChanges</code>) through <code>useDataTableChanges</code>, as
      the screens do.
    </p>

    <CatalogBlock
      name="CoreDataTable · CoreDataGrid · DataGridEditor · DataTableTabs · ConditionFilterChip · PendingChangesPanel"
      api="title · columns · rows · cellValue · status · v-model:search/filters/sort/selected/density · editable · selectable · canAdd/canDelete/canBulkEdit/canBulkUpload · rowState · cellModified · pendingCount → cell-change, add-row, delete-rows, bulk-edit, upload, review"
      note="Click a cell and use the arrows; Enter, F2 or typing edits, Delete empties, Escape cancels. Edit a few cells, add a row, select rows, then Review changes."
    >
      <div class="stack">
        <div class="controls">
          <span class="caption">Permissions</span>
          <CoreSegmentedControl v-model="permission" size="small" :options="permissionOptions" />
          <span class="caption">State</span>
          <CoreSegmentedControl v-model="state" size="small" :options="stateOptions" />
        </div>
        <div class="screen">
          <div class="screen__main">
            <CoreDataTable
              ref="table"
              v-model:search="view.search"
              v-model:filters="view.filters"
              v-model:sort="view.sort"
              v-model:selected="view.selected"
              v-model:density="density"
              v-model:widths="view.widths"
              :title="current.title"
              :columns="current.columns"
              :rows="shownRows"
              :source-rows="changes.rows.value"
              :cell-value="changes.cellValue"
              :status="status"
              :total-count="changes.rows.value.length"
              :filtered-count="filteredCount"
              :editable="editable"
              :selectable="editable"
              :can-add="editable"
              :can-delete="editable"
              :can-bulk-edit="editable"
              :can-bulk-upload="editable"
              can-download-excel
              :upload-operations="['post_update_bulk', 'post_bulk', 'overwrite_all']"
              :row-state="changes.rowState"
              :cell-modified="changes.cellModified"
              :row-pinned="(row) => !!changes.cellValue(row, 'pinned')"
              :options-for="optionsFor"
              :pending-count="store.totalChangesCount.value"
              :pending-tables="store.modifiedTableKeys.value.length"
              @cell-change="changes.setCell"
              @add-row="changes.addRow"
              @delete-rows="changes.deleteRows"
              @restore-rows="changes.restoreRows"
              @bulk-edit="changes.bulkEdit"
              @need-options="loadOptions"
              @retry="state = 'ready'"
              @review="reviewOpen = true"
              @discard="store.clearAllChanges()"
            >
              <template #tabs>
                <DataTableTabs v-model="tableKey" :tabs="tabs" />
              </template>
            </CoreDataTable>
          </div>
          <PendingChangesPanel
            v-model:open="reviewOpen"
            class="screen__panel"
            :groups="groups"
            :save-label="'Save changes'"
            :saving="saving"
            @save="save"
            @revert-all="store.clearAllChanges()"
            @revert-table="revertTable"
            @revert-row="revertRow"
            @revert-field="(key, rowId, field) => store.revertChange(key, rowId, field)"
            @update-field="updateField"
            @go-to="goTo"
          />
        </div>
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="TableSourceStrip"
      api="origin · v-model:sourceChoice · showSourceChoice · master → compare, use-master, save-master"
      column
    >
      <TableSourceStrip v-model:source-choice="sourceChoice" :origin="{ variant: 'database' }" show-source-choice />
      <TableSourceStrip v-model:source-choice="fileChoice" :origin="{ variant: 'file' }" show-source-choice :master="masterReady" />
      <TableSourceStrip :origin="{ variant: 'edited' }" :master="{ ...masterReady, state: 'comparing' }" />
      <TableSourceStrip :origin="{ variant: 'reuploaded', perParameter: true }" />
      <TableSourceStrip :master="{ ...masterReady, added: 0, removed: 0, modified: 0 }" />
    </CatalogBlock>

    <CatalogBlock
      name="DataComparisonDialog"
      api="open · tableTitle · columns · lines · loadedCount · masterCount · pendingCount · allowRestore · allowDelete → restore, delete"
    >
      <CoreButton variant="outlined" icon="mdi-compare-horizontal" text="Compare Products" @click="comparisonOpen = true" />
      <DataComparisonDialog
        v-model:open="comparisonOpen"
        table-title="Products"
        :columns="productColumns"
        :lines="comparisonLines"
        :loaded-count="36"
        :master-count="35"
        :pending-count="0"
        allow-restore
        allow-delete
      />
    </CatalogBlock>

    <CatalogBlock
      name="ParametersTable"
      api="rows (id, label, unit, column, value, modified, source) · readOnly · sourceTitle → update:value, update:source, revert"
      column
    >
      <div class="frame">
        <ParametersTable :rows="parameterRows" @update:value="setParameter" @update:source="setSource" @revert="revertParameter" />
      </div>
      <div class="frame">
        <ParametersTable :rows="parameterChoiceRows" source-title="Origin of the value" />
      </div>
    </CatalogBlock>

    <CatalogBlock name="MessageList" api="messages · level">
      <div class="frame">
        <MessageList :messages="messages" level="warning" />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="CreateExecutionReviewInstance · ExecutionDataView"
      api="newExecution · instanceErrors · externalEtlFlow · showToolbar → update:instance, update:instanceErrors"
      note="The review of a new execution: the loaded tables with their pending changes, the parameters as a list, Excel download and upload and the full screen."
    >
      <div class="review">
        <CreateExecutionReviewInstance
          :new-execution="reviewExecution"
          :instance-errors="reviewErrors"
          show-toolbar
          @update:instance="(instance) => (reviewExecution.instance = instance)"
          @update:instance-errors="(errors) => (reviewErrors = errors)"
        />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="BulkEditDialog · BulkUploadDialog · RelaunchDialog"
      api="open · columns · count · tableTitle → apply | operations · phase · progressText → upload | name · summary · busy → launch"
    >
      <CoreButton variant="outlined" text="Bulk edit" @click="bulkOpen = true" />
      <CoreButton variant="outlined" text="Bulk upload" @click="uploadOpen = true" />
      <CoreButton variant="outlined" text="Relaunch" @click="relaunchOpen = true" />
      <BulkEditDialog v-model:open="bulkOpen" :columns="lineColumns.filter((c) => !c.readOnly && c.type !== 'reference')" :count="12" table-title="Lines" />
      <BulkUploadDialog
        v-model:open="uploadOpen"
        table-title="Lines"
        :operations="['post_update_bulk', 'post_bulk', 'overwrite_all']"
        :row-count="48"
      />
      <RelaunchDialog
        v-model:open="relaunchOpen"
        name="Week 43 · v2"
        summary="3 changes in Lines, Demand"
        source-name="Week 43"
        :busy="false"
      />
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Instance } from '@/app/models/Instance'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreSegmentedControl from '@cornflow-ui/core/components/core/CoreSegmentedControl.vue'
import BulkEditDialog from '@cornflow-ui/core/components/core/data-table/BulkEditDialog.vue'
import BulkUploadDialog from '@cornflow-ui/core/components/core/data-table/BulkUploadDialog.vue'
import CoreDataTable from '@cornflow-ui/core/components/core/data-table/CoreDataTable.vue'
import DataComparisonDialog from '@cornflow-ui/core/components/core/data-table/DataComparisonDialog.vue'
import DataTableTabs from '@cornflow-ui/core/components/core/data-table/DataTableTabs.vue'
import MessageList from '@cornflow-ui/core/components/core/data-table/MessageList.vue'
import ParametersTable, { type ParameterRow } from '@cornflow-ui/core/components/core/data-table/ParametersTable.vue'
import PendingChangesPanel from '@cornflow-ui/core/components/core/data-table/PendingChangesPanel.vue'
import RelaunchDialog from '@cornflow-ui/core/components/core/data-table/RelaunchDialog.vue'
import TableSourceStrip from '@cornflow-ui/core/components/core/data-table/TableSourceStrip.vue'
import type { ComparisonLine } from '@cornflow-ui/core/components/core/data-table/DataComparisonDialog.vue'
import type {
  DataColumn,
  DataColumnOption,
  DataDensity,
  DataFilter,
  DataRow,
  DataSort,
} from '@cornflow-ui/core/components/core/data-table/types'
import { useDataTableRows } from '@cornflow-ui/core/composables/core-table/useDataTableRows'
import { pendingChangeGroups, useDataTableChanges } from '@cornflow-ui/core/composables/core-table/useDataTableChanges'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'
import CreateExecutionReviewInstance from '@cornflow-ui/core/components/project-execution/CreateExecutionReviewInstance.vue'
import type { NewExecution } from '@cornflow-ui/core/composables/project-execution/useExecutionExcel'
import CatalogBlock from '../CatalogBlock.vue'

const PLANTS = ['North plant', 'South plant']
const TYPES = ['Packing', 'Labelling', 'Palletising', 'Mixing']
const FAMILIES = ['Drinks', 'Dairy', 'Tins', 'Snacks']
const LINES = Array.from({ length: 48 }, (_, i) => `L${i + 1}`)
const PRODUCTS = Array.from({ length: 36 }, (_, i) => `P-${101 + i}`)
const pad = (n: number) => String(n).padStart(2, '0')
const day = (i: number) => `${2023 + (i % 4)}-${pad(1 + ((i * 5) % 12))}-${pad(1 + ((i * 11) % 28))}`

const lineColumns: DataColumn[] = [
  { key: 'line', title: 'Line', type: 'text', required: true },
  { key: 'plant', title: 'Plant', type: 'reference', required: true, description: 'Reference to the Plants table' },
  { key: 'description', title: 'Description', type: 'text' },
  { key: 'capacity', title: 'Capacity', unit: 'units/week', type: 'number', required: true },
  { key: 'active', title: 'Active', type: 'boolean' },
  { key: 'kind', title: 'Type', type: 'list', options: TYPES.map((v) => ({ value: v, label: v })) },
  { key: 'since', title: 'Start date', type: 'date' },
  { key: 'shift', title: 'Shift start', type: 'time' },
  { key: 'cost', title: 'Cost', unit: '€/h', type: 'number', decimals: 2 },
  { key: 'pinned', title: 'Pin', type: 'switch' },
  { key: 'reviewed', title: 'Last review', type: 'datetime', readOnly: true },
]

const productColumns: DataColumn[] = [
  { key: 'code', title: 'Code', type: 'text', required: true },
  { key: 'name', title: 'Name', type: 'text', required: true },
  { key: 'family', title: 'Family', type: 'list', options: FAMILIES.map((v) => ({ value: v, label: v })) },
  { key: 'line', title: 'Line', type: 'reference' },
  { key: 'weight', title: 'Weight', unit: 'kg', type: 'number', decimals: 2 },
  { key: 'active', title: 'Active', type: 'boolean' },
]

const demandColumns: DataColumn[] = [
  { key: 'product', title: 'Product', type: 'reference', required: true },
  { key: 'week', title: 'Week', type: 'number' },
  { key: 'quantity', title: 'Quantity', unit: 'units', type: 'number', required: true },
  { key: 'priority', title: 'Priority', type: 'list', options: ['High', 'Medium', 'Low'].map((v) => ({ value: v, label: v })) },
  { key: 'due', title: 'Due date', type: 'date' },
  { key: 'comment', title: 'Comment', type: 'text' },
]

const descriptions = [
  'Main packing line with side labeller and double-exit palletiser',
  'Small format',
  null,
  'Night shift shared with preventive maintenance on Fridays',
  'Manual labelling',
  null,
  'Kept for urgent orders',
]

const tables: Record<string, { title: string; columns: DataColumn[]; rows: DataRow[] }> = {
  catalog_lines: {
    title: 'Lines',
    columns: lineColumns,
    rows: LINES.map((line, i) => ({
      id: i + 1,
      line,
      plant: i % 3 === 2 ? PLANTS[1] : PLANTS[0],
      description: descriptions[i % 7],
      capacity: 1200 + ((i * 379) % 9000),
      active: i % 5 !== 3,
      kind: TYPES[(i * 3) % 4],
      since: day(i),
      shift: ['06:00', '14:00', '22:00', '07:00'][i % 4],
      cost: i % 9 === 4 ? null : Math.round((18.5 + ((i * 13) % 46) + (i % 4) * 0.25) * 100) / 100,
      pinned: i % 6 === 0,
      reviewed: `2026-${pad(1 + (i % 9))}-${pad(1 + ((i * 3) % 27))}T08:${pad((i * 7) % 60)}`,
    })),
  },
  catalog_products: {
    title: 'Products',
    columns: productColumns,
    rows: PRODUCTS.map((code, i) => ({
      id: i + 1,
      code,
      name: `Product ${i + 1}`,
      family: FAMILIES[i % 4],
      line: i % 8 === 5 ? null : LINES[(i * 7) % 48],
      weight: Math.round((0.15 + ((i * 37) % 180) / 100) * 100) / 100,
      active: i % 7 !== 4,
    })),
  },
  catalog_demand: {
    title: 'Demand',
    columns: demandColumns,
    rows: Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      product: PRODUCTS[(i * 5) % 36],
      week: 40 + (i % 8),
      quantity: 200 + ((i * 613) % 14000),
      priority: ['High', 'Medium', 'Low'][(i * 2) % 3],
      due: `2026-${pad(10 + (i % 3))}-${pad(1 + ((i * 7) % 28))}`,
      comment: i % 6 === 1 ? 'Confirmed by the customer, partial delivery allowed' : null,
    })),
  },
}

const store = useTableChanges()

const tableKey = ref('catalog_lines')
const current = computed(() => tables[tableKey.value])

interface ViewState {
  search: string
  filters: DataFilter[]
  sort: DataSort | null
  selected: Array<string | number>
  widths: Record<string, number>
}
const views = reactive<Record<string, ViewState>>(
  Object.fromEntries(
    Object.keys(tables).map((key) => [
      key,
      {
        search: '',
        filters:
          key === 'catalog_lines'
            ? [{ id: 'f1', field: 'active', operator: 'is', value: 'true', values: [] }]
            : [],
        sort: null,
        selected: [],
        widths: {},
      },
    ]),
  ),
)
const view = computed(() => views[tableKey.value])
const density = ref<DataDensity>('default')

const changes = useDataTableChanges(
  tableKey,
  computed(() => current.value.title),
  computed(() => current.value.rows),
  computed(() => current.value.columns),
)

const { rows: shownRows, filteredCount } = useDataTableRows(
  changes.rows,
  computed(() => current.value.columns),
  {
    search: computed(() => view.value.search),
    filters: computed(() => view.value.filters),
    sort: computed(() => view.value.sort),
    cellValue: changes.cellValue,
  },
)

const tabs = computed(() =>
  Object.entries(tables).map(([key, table]) => ({
    key,
    label: table.title,
    rows: table.rows.length + store.getPendingCreates(key).length,
    pending:
      Object.values(store.getChangesForTable(key) ?? {}).reduce((n, row) => n + Object.keys(row).length, 0) +
      store.getPendingCreates(key).length +
      store.getPendingDeletes(key).length,
  })),
)

// Permissions and state of the sample.
const permission = ref('edit')
const permissionOptions = [
  { value: 'edit', label: 'Editable' },
  { value: 'read', label: 'Read only' },
]
const editable = computed(() => permission.value === 'edit')
const state = ref('ready')
const stateOptions = [
  { value: 'ready', label: 'Data' },
  { value: 'loading', label: 'Loading' },
  { value: 'empty', label: 'Empty' },
  { value: 'error', label: 'Error' },
]
const status = computed(() => (state.value === 'loading' || state.value === 'error' ? state.value : 'ready'))
watch(state, (value) => {
  if (value === 'empty') views[tableKey.value].search = 'East plant'
})

// Options of the references, "loaded" after a moment.
const loaded = reactive<Record<string, DataColumnOption[]>>({})
const REFERENCE_VALUES: Record<string, string[]> = { plant: PLANTS, line: LINES, product: PRODUCTS }
const optionsFor = (column: DataColumn) => loaded[column.key]
function loadOptions(column: DataColumn) {
  if (loaded[column.key]) return
  setTimeout(() => {
    loaded[column.key] = (REFERENCE_VALUES[column.key] ?? []).map((v) => ({ value: v, label: v }))
  }, 700)
}

// Review of the pending changes.
const table = ref<InstanceType<typeof CoreDataTable>>()
const reviewOpen = ref(false)
const saving = ref(false)
const groups = computed(() =>
  pendingChangeGroups(
    Object.entries(tables).map(([key, t]) => ({ key, title: t.title, columns: t.columns, rows: t.rows })),
  ),
)

function revertTable(key: string) {
  store.revertTableChanges(key)
  store.clearCreatesForTable(key)
  store.clearDeletesForTable(key)
}

function revertRow(key: string, rowId: string | number, kind: string) {
  if (kind === 'new') store.revertCreate(key, String(rowId))
  else if (kind === 'deleted') store.revertDelete(key, rowId)
  else store.revertRowChanges(key, rowId)
}

function updateField(key: string, rowId: string | number, field: string, value: unknown) {
  if (String(rowId).startsWith('create-')) {
    store.updateCreateField(key, String(rowId), field, value)
    return
  }
  const row = tables[key]?.rows.find((candidate) => String(candidate.id) === String(rowId))
  store.recordChange(key, rowId, field, row?.[field], value, field, tables[key]?.title)
}

function goTo(key: string, rowId: string | number, field: string) {
  tableKey.value = key
  views[key].search = ''
  views[key].filters = []
  setTimeout(() => table.value?.focusCell(Number.isNaN(Number(rowId)) ? rowId : Number(rowId), field), 50)
}

function save() {
  saving.value = true
  setTimeout(() => {
    saving.value = false
    store.clearAllChanges()
    reviewOpen.value = false
  }, 1200)
}

// Source bar and comparison.
const sourceChoice = ref('static')
const fileChoice = ref('file')
const masterReady = {
  state: 'ready' as const,
  name: 'Products',
  added: 2,
  removed: 1,
  modified: 3,
  canUseMaster: true,
  canSaveMaster: true,
}
const comparisonOpen = ref(false)
const productRows = tables.catalog_products.rows
const comparisonLines: ComparisonLine[] = [
  ...productRows.slice(0, 30).map((row, i) => {
    const changed = i === 2 ? ['weight'] : i === 5 ? ['family'] : i === 9 ? ['name'] : []
    const master = { ...row }
    if (i === 2) master.weight = 0.75
    if (i === 5) master.family = 'Drinks'
    if (i === 9) master.name = 'Mineral water 1 L'
    return {
      key: String(row.code),
      status: changed.length ? ('modified' as const) : ('identical' as const),
      loaded: row,
      master,
      changedKeys: changed,
    }
  }),
  { key: 'P-099', status: 'removed', master: { code: 'P-099', name: 'Sparkling water 1 L', family: 'Drinks', line: 'L3', weight: 1.05, active: true }, changedKeys: [] },
  { key: 'P-135', status: 'added', loaded: productRows[34], changedKeys: [] },
  { key: 'P-136', status: 'added', loaded: productRows[35], changedKeys: [] },
]

// Parameters.
const parameterValues = reactive<Record<string, unknown>>({ horizon: 12, objective: 'cost', limit: 600, gap: 0.5, night: true, seed: 42 })
const parameterSources = reactive<Record<string, boolean>>({ horizon: true, objective: true, limit: false, gap: true, night: true, seed: false })
const PARAMETER_BASE: Record<string, unknown> = { horizon: 12, objective: 'cost', limit: 600, gap: 0.5, night: true, seed: 42 }
const parameterRows = computed<ParameterRow[]>(() => [
  { id: 'horizon', label: 'Planning horizon', unit: 'weeks', column: { key: 'horizon', title: 'Planning horizon', type: 'number' } },
  { id: 'objective', label: 'Objective', column: { key: 'objective', title: 'Objective', type: 'list', options: [{ value: 'cost', label: 'Minimise cost' }, { value: 'service', label: 'Maximise service' }] } },
  { id: 'limit', label: 'Solver time limit', unit: 's', column: { key: 'limit', title: 'Solver time limit', type: 'number' } },
  { id: 'gap', label: 'Optimality gap', unit: '%', column: { key: 'gap', title: 'Optimality gap', type: 'number' } },
  { id: 'night', label: 'Allow night shifts', column: { key: 'night', title: 'Allow night shifts', type: 'boolean' } },
  { id: 'seed', label: 'Random seed', column: { key: 'seed', title: 'Random seed', type: 'number' }, noDatabase: true },
].map(({ noDatabase, ...row }) => ({
  ...row,
  value: parameterValues[row.id],
  modified: parameterValues[row.id] !== PARAMETER_BASE[row.id],
  source: { mode: 'switch' as const, fromDatabase: parameterSources[row.id], disabled: !!noDatabase },
})))
const parameterChoiceRows = computed<ParameterRow[]>(() =>
  parameterRows.value.slice(0, 3).map((row, i) => ({
    ...row,
    source: { mode: 'choice' as const, value: (['default', 'database', 'fixed'] as const)[i], databaseDisabled: i === 2 },
  })),
)
function setParameter(id: string, value: unknown) {
  parameterValues[id] = value
  parameterSources[id] = false
}
function setSource(id: string, value: unknown) {
  parameterSources[id] = !!value
  if (value) parameterValues[id] = PARAMETER_BASE[id]
}
function revertParameter(id: string) {
  parameterValues[id] = PARAMETER_BASE[id]
}

const messages = [
  'Product P-199 has no demand in the planning horizon.',
  'Line L22 has no shifts in week 45.',
  'There are 3 products weighing 0 kg.',
]

const reviewSchema = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      title: 'Lines',
      items: {
        type: 'object',
        properties: {
          line: { type: 'string', title: 'Line' },
          plant: { type: 'string', title: 'Plant' },
          capacity: { type: 'number', title: 'Capacity' },
          active: { type: 'boolean', title: 'Active' },
        },
        required: ['line'],
      },
    },
    products: {
      type: 'array',
      title: 'Products',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', title: 'Code' },
          family: { type: 'string', title: 'Family' },
          weight: { type: 'number', title: 'Weight (kg)' },
        },
        required: ['code'],
      },
    },
    demand: {
      type: 'array',
      title: 'Demand',
      items: {
        type: 'object',
        properties: {
          product: { type: 'string', title: 'Product' },
          due: { type: 'string', format: 'date', title: 'Due date' },
          quantity: { type: 'integer', title: 'Quantity' },
        },
        required: ['product', 'quantity'],
      },
    },
    parameters: {
      type: 'object',
      title: 'Parameters',
      properties: {
        horizon_days: { type: 'integer', title: 'Horizon (days)' },
        start_date: { type: 'string', format: 'date', title: 'Start date' },
        allow_overtime: { type: 'boolean', title: 'Allow overtime' },
        max_utilisation: { type: 'number', title: 'Maximum utilisation' },
      },
    },
  },
}

const reviewData = {
  lines: LINES.slice(0, 12).map((line, i) => ({
    line,
    plant: PLANTS[i % 2],
    capacity: 1200 + ((i * 379) % 9000),
    active: i % 5 !== 3,
  })),
  products: PRODUCTS.slice(0, 20).map((code, i) => ({
    code,
    family: FAMILIES[i % 4],
    weight: Math.round((0.15 + ((i * 37) % 180) / 100) * 100) / 100,
  })),
  demand: Array.from({ length: 30 }, (_, i) => ({
    product: PRODUCTS[(i * 5) % 20],
    due: `2026-${pad(10 + (i % 3))}-${pad(1 + ((i * 7) % 28))}`,
    quantity: 200 + ((i * 613) % 14000),
  })),
  parameters: { horizon_days: 28, start_date: '2026-10-26', allow_overtime: false, max_utilisation: 0.85 },
}

const reviewExecution = reactive<NewExecution>({
  name: 'Week 43',
  instance: new Instance(null as unknown as string, reviewData, reviewSchema, {}, 'catalog'),
})
const reviewErrors = ref<string | null>(null)

const bulkOpen = ref(false)
const uploadOpen = ref(false)
const relaunchOpen = ref(false)
</script>

<style scoped>
.catalog-section__lead {
  margin: 0;
  color: var(--color-text-muted);
}

.stack {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  min-width: 0;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
}

.caption {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.screen {
  display: flex;
  gap: calc(var(--spacing) * 4);
  height: 680px;
  padding: calc(var(--spacing) * 4);
  border-radius: var(--radius-lg);
  background: var(--color-background);
}

.screen__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.screen__main > :deep(.data-table) {
  flex: 1;
}

.screen__panel {
  flex: none;
  width: 400px;
}

.review {
  flex: 1 1 100%;
  height: 620px;
  min-width: 0;
}

.frame {
  flex: 1 1 100%;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}
</style>
