import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import ExecutionDataView from '@cornflow-ui/core/components/project-execution/ExecutionDataView.vue'

// Controllable mock holder for the useTableChanges composable so individual
// tests can override return values while keeping a stable object across the
// single setup-time call.
const tableChangesMock: Record<string, any> = {}

const resetTableChangesMock = () => {
  Object.assign(tableChangesMock, {
    getRowClass: vi.fn(() => ''),
    hasChanges: { value: false },
    totalChangesCount: { value: 0 },
    getPendingCreates: vi.fn(() => []),
    getPendingDeletes: vi.fn(() => []),
    getPendingDeletesWithData: vi.fn(() => []),
    getChangesForTable: vi.fn(() => null),
    getAllChanges: vi.fn(() => ({})),
    recordCreate: vi.fn(() => 'create-t0-0'),
    recordChange: vi.fn(),
    recordDelete: vi.fn(),
    revertChange: vi.fn(() => null),
    revertRowChanges: vi.fn(() => null),
    revertTableChanges: vi.fn(() => null),
    clearAllChanges: vi.fn(),
    isCellModified: vi.fn(() => false),
    getFullGroupedChanges: vi.fn(() => []),
    modifiedTableKeys: { value: [] },
  })
}

vi.mock('@cornflow-ui/core/composables/useTableChanges', () => ({
  useTableChanges: () => tableChangesMock,
}))

const i18nMessages = {
  en: {
    projectExecution: {
      steps: {
        step5: { check: 'Check data' },
        step3: { loadInstance: { instanceSchemaError: 'Schema error' } },
      },
    },
    inputOutputData: {
      dataChecksPassedMessage: 'Checks passed',
      dataChecksLoadingMessage: 'Loading...',
      dataChecksFailedMessage: 'Checks failed',
      noDataAvailable: 'No data available',
      parameter: 'Parameter',
      value: 'Value',
    },
    pendingChanges: {
      changesIndicator: '{count} changes',
      reviewChanges: 'Review changes',
      saveErrorNoInstanceData: 'No instance data',
    },
  },
}

// Stub every Vuetify overlay/component so jsdom doesn't choke and resolution
// warnings disappear. We assert on selectors/keys, not rendered Vuetify DOM.
const vuetifyStubs = {
  'v-btn': { template: '<button class="v-btn-stub"><slot /></button>' },
  'v-alert': { template: '<div class="v-alert-stub"><slot /></div>' },
  'v-progress-circular': { template: '<span></span>' },
  'v-icon': { template: '<i><slot /></i>' },
  'v-chip': { template: '<span class="v-chip-stub"><slot /></span>' },
  'v-tooltip': {
    template: '<div><slot name="activator" :props="{}" /><slot /></div>',
  },
  'v-divider': { template: '<hr />' },
  'v-switch': { template: '<input type="checkbox" class="v-switch-stub" />' },
  'v-card': { template: '<div class="v-card-stub"><slot /></div>' },
  'v-card-text': { template: '<div><slot /></div>' },
  'v-card-title': { template: '<div><slot /></div>' },
  'v-card-actions': { template: '<div><slot /></div>' },
  'v-spacer': { template: '<span></span>' },
  'v-dialog': { template: '<div><slot /></div>' },
}

const createWrapper = (props: Record<string, unknown> = {}) => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createI18n({ legacy: false, locale: 'en', messages: i18nMessages })

  return mount(ExecutionDataView, {
    props: {
      execution: {
        instance: {
          data: {},
          schema: { properties: {} },
        },
      },
      ...props,
    },
    global: {
      plugins: [vuetify, pinia, i18n],
      stubs: {
        ...vuetifyStubs,
        CoreTable: { template: '<div class="core-table-stub"></div>' },
        CoreTabs: { template: '<div class="core-tabs-stub"><slot /></div>' },
        CoreTab: { template: '<div class="core-tab-stub"><slot /></div>' },
        CoreConfirmDialog: {
          template: '<div class="confirm-dialog-stub"><slot /></div>',
        },
        PendingChangesReviewModal: {
          template: '<div class="pending-changes-modal-stub"></div>',
        },
      },
    },
  })
}

// Helper: a realistic execution with a schema-defined array table, an object
// (parameters) table and raw array data.
const buildExecution = (overrides: Record<string, any> = {}) => ({
  instance: {
    data: {
      products: [
        { id: 1, name: 'A', qty: 5 },
        { id: 2, name: 'B', qty: 7 },
      ],
      parameters: { horizon: 10, factor: 2.5 },
    },
    schema: {
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Name' },
              qty: { type: 'integer', title: 'Qty' },
            },
            required: ['name'],
          },
        },
        parameters: {
          type: 'object',
          properties: {
            horizon: { type: 'integer', title: 'Horizon' },
            factor: { type: 'number', title: 'Factor' },
          },
        },
      },
    },
    checkSchema: vi.fn(async () => []),
    ...overrides,
  },
})

describe('ExecutionDataView', () => {
  beforeEach(() => {
    resetTableChangesMock()
    vi.clearAllMocks()
    resetTableChangesMock()
  })

  describe('Component rendering', () => {
    test('renders execution data view container', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.execution-data-view').exists()).toBe(true)
    })

    test('renders without execution prop (optional)', () => {
      const wrapper = mount(ExecutionDataView, {
        props: {},
        global: {
          plugins: [
            createVuetify(),
            createPinia(),
            createI18n({ legacy: false, locale: 'en', messages: { en: {} } }),
          ],
          stubs: {
            ...vuetifyStubs,
            CoreTable: true,
            CoreTabs: true,
            CoreTab: true,
            CoreConfirmDialog: true,
            PendingChangesReviewModal: true,
          },
        },
      })
      expect(wrapper.find('.execution-data-view').exists()).toBe(true)
    })

    test('shows no-data alert when no tables and cannot check data', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.no-data-container').exists()).toBe(true)
    })

    test('shows check-data button and emits check-data on click', async () => {
      const wrapper = createWrapper({ canCheckData: true })
      const btn = wrapper.find('.check-data-button-container .v-btn-stub')
      expect(btn.exists()).toBe(true)
      await btn.trigger('click')
      expect(wrapper.emitted('check-data')).toBeTruthy()
      expect(wrapper.vm.checksLaunched).toBe(true)
    })
  })

  describe('Alerts and loading states', () => {
    test('shows passed alert when checks finished without errors', () => {
      const wrapper = createWrapper({ checksFinished: true })
      expect(wrapper.find('.alert-section').exists()).toBe(true)
    })

    test('isLoadingChecks true when checksInProgress', () => {
      const wrapper = createWrapper({ checksInProgress: true })
      expect(wrapper.vm.isLoadingChecks).toBe(true)
    })

    test('isLoadingChecks true after launch while not finished', async () => {
      const wrapper = createWrapper()
      wrapper.vm.checksLaunched = true
      await nextTick()
      expect(wrapper.vm.isLoadingChecks).toBe(true)
    })

    test('shows error alert when checksError', () => {
      const wrapper = createWrapper({ checksError: true })
      expect(wrapper.find('.alert-section').exists()).toBe(true)
    })

    test('watcher resets checksLaunched when finished and not in progress', async () => {
      const wrapper = createWrapper({ checksInProgress: true })
      wrapper.vm.checksLaunched = true
      await wrapper.setProps({ checksInProgress: false, checksFinished: true })
      await nextTick()
      expect(wrapper.vm.checksLaunched).toBe(false)
    })

    test('hasValidationErrors true when dataChecks has items', () => {
      const wrapper = createWrapper({
        execution: {
          instance: {
            data: {},
            schema: { properties: {} },
            dataChecks: { errors: ['bad'] },
          },
        },
      })
      expect(wrapper.vm.hasValidationErrors).toBe(true)
    })

    test('hasValidationErrors false when dataChecks empty', () => {
      const wrapper = createWrapper({
        execution: {
          instance: { data: {}, schema: { properties: {} }, dataChecks: {} },
        },
      })
      expect(wrapper.vm.hasValidationErrors).toBe(false)
    })
  })

  describe('instanceTables building', () => {
    test('builds array and object tables from schema', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await nextTick()
      const tables = wrapper.vm.instanceTables
      const keys = tables.map((t: any) => t.key)
      expect(keys).toContain('products')
      expect(keys).toContain('parameters')
      // selectedTableKey set by the immediate watcher
      expect(wrapper.vm.selectedTableKey).toBe(keys[0])
    })

    test('returns empty when no instance data', () => {
      const wrapper = createWrapper({
        execution: { instance: { data: null, schema: {} } },
      })
      expect(wrapper.vm.instanceTables).toEqual([])
    })

    test('builds validation tables in check-data mode', async () => {
      const wrapper = createWrapper({
        canCheckData: true,
        execution: {
          instance: {
            data: { products: [{ id: 1 }] },
            schema: { properties: {} },
            dataChecks: {
              missing_rows: [{ row: 1, msg: 'x' }],
              warnings_list: ['w1', 'w2'],
            },
          },
        },
        checksSchema: { properties: { warnings_list: { is_warning: true } } },
      })
      await nextTick()
      const tables = wrapper.vm.instanceTables
      const valKeys = tables.map((t: any) => t.key)
      expect(valKeys).toContain('validation_missing_rows')
      expect(valKeys).toContain('validation_warnings_list')
      const warn = tables.find((t: any) => t.key === 'validation_warnings_list')
      expect(warn.isWarning).toBe(true)
    })

    test('sorts master-matched tables first', async () => {
      const wrapper = createWrapper({
        execution: buildExecution(),
        masterTableMatches: [
          { tableKey: 'parameters', masterTableConfig: { order: 0 } },
        ],
      })
      await nextTick()
      const tables = wrapper.vm.instanceTables
      expect(tables[0].key).toBe('parameters')
    })
  })

  describe('current table computed helpers', () => {
    test('currentTable resolves selected key', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await nextTick()
      wrapper.vm.selectedTableKey = 'parameters'
      await nextTick()
      expect(wrapper.vm.currentTable.key).toBe('parameters')
    })

    test('currentTable falls back to first when key missing', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await nextTick()
      wrapper.vm.selectedTableKey = 'does-not-exist'
      await nextTick()
      expect(wrapper.vm.currentTable.key).toBe(wrapper.vm.instanceTables[0].key)
    })

    test('currentTable empty placeholder when no tables', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.currentTable.key).toBe('')
    })

    test('windowing slices items and loadMoreWindow grows', async () => {
      const big = Array.from({ length: 450 }, (_, i) => ({ id: i, name: `n${i}` }))
      const wrapper = createWrapper({
        execution: {
          instance: {
            data: { products: big },
            schema: { properties: { products: { type: 'array', items: { properties: { name: { type: 'string' } } } } } },
          },
        },
      })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      expect(wrapper.vm.windowedCurrentItems.length).toBe(200)
      expect(wrapper.vm.windowedHasMore).toBe(true)
      wrapper.vm.loadMoreWindow()
      expect(wrapper.vm.windowedCurrentItems.length).toBe(400)
    })
  })

  describe('master table match', () => {
    const matchExec = () => buildExecution()
    const matches = [
      {
        tableKey: 'products',
        masterTableTitle: 'Master Products',
        hasDifferences: true,
        diffSummary: { onlyInInstance: 1, onlyInMaster: 2, different: 3 },
        showReplaceMasterOption: true,
        userChoice: 'use_master',
      },
    ]

    test('getMatchForTable returns match or null', () => {
      const wrapper = createWrapper({
        execution: matchExec(),
        masterTableMatches: matches,
      })
      expect(wrapper.vm.getMatchForTable('products')).toBeTruthy()
      expect(wrapper.vm.getMatchForTable('nope')).toBe(null)
    })

    test('getMatchForTable null when no matches', () => {
      const wrapper = createWrapper({ execution: matchExec() })
      expect(wrapper.vm.getMatchForTable('products')).toBe(null)
    })

    test('hasAnyMatches reflects matches', () => {
      const wrapper = createWrapper({
        execution: matchExec(),
        masterTableMatches: matches,
      })
      expect(wrapper.vm.hasAnyMatches).toBe(true)
    })

    test('confirm use master emits action and closes dialog', async () => {
      const wrapper = createWrapper({
        execution: matchExec(),
        masterTableMatches: matches,
      })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      wrapper.vm.showUseMasterConfirmDialog = true
      wrapper.vm.handleConfirmUseMaster()
      const ev = wrapper.emitted('master-table-action')
      expect(ev).toBeTruthy()
      expect(ev![0]).toEqual(['products', 'use_master'])
      expect(wrapper.vm.showUseMasterConfirmDialog).toBe(false)
    })

    test('confirm replace master emits action', async () => {
      const wrapper = createWrapper({
        execution: matchExec(),
        masterTableMatches: matches,
      })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      wrapper.vm.handleConfirmReplaceMaster()
      const ev = wrapper.emitted('master-table-action')
      expect(ev![0]).toEqual(['products', 'replace_master'])
    })

    test('handleShowComparison emits show-comparison', async () => {
      const wrapper = createWrapper({
        execution: matchExec(),
        masterTableMatches: matches,
      })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      wrapper.vm.handleShowComparison()
      expect(wrapper.emitted('show-comparison')![0]).toEqual(['products'])
    })
  })

  describe('ETL flow computed and handlers', () => {
    const etlExec = () => buildExecution()
    const etlFlow = (variant: string, fixed: any = true) => ({
      tableSwitches: { products: { variant, fixed } },
      parameterSwitches: {},
      parameterTableNames: new Set<string>(),
    })

    test('etlInfoIcon and etlInfoText for from_db', async () => {
      const wrapper = createWrapper({
        execution: etlExec(),
        externalEtlFlow: etlFlow('from_db'),
      })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      expect(wrapper.vm.etlInfoIcon).toBe('mdi-database')
      expect(wrapper.vm.etlInfoText).toBe('externalEtl.switch.fromDbLabel')
      expect(wrapper.vm.etlSwitchLabel).toBe('externalEtl.switch.fixTable')
    })

    test('etlInfoIcon variants', async () => {
      for (const [variant, icon] of [
        ['from_excel', 'mdi-file-excel'],
        ['edited_from_db', 'mdi-database-edit'],
        ['reuploaded', 'mdi-file-replace'],
      ] as const) {
        const wrapper = createWrapper({
          execution: etlExec(),
          externalEtlFlow: etlFlow(variant),
        })
        await nextTick()
        wrapper.vm.selectedTableKey = 'products'
        await nextTick()
        expect(wrapper.vm.etlInfoIcon).toBe(icon)
      }
    })

    test('etlInfoIcon default when no switch state', () => {
      const wrapper = createWrapper({ execution: etlExec() })
      expect(wrapper.vm.etlInfoIcon).toBe('mdi-table')
      expect(wrapper.vm.etlInfoText).toBe('')
      expect(wrapper.vm.etlSwitchLabel).toBe('')
    })

    test('etlSwitchModelValue true when fixed false', async () => {
      const wrapper = createWrapper({
        execution: etlExec(),
        externalEtlFlow: etlFlow('from_db', false),
      })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      expect(wrapper.vm.etlSwitchModelValue).toBe(true)
    })

    test('etlSwitchModelValue false when no state', () => {
      const wrapper = createWrapper({ execution: etlExec() })
      expect(wrapper.vm.etlSwitchModelValue).toBe(false)
    })

    test('handleEtlSwitchChange flips fixed', async () => {
      const flow = etlFlow('from_db', true)
      const wrapper = createWrapper({ execution: etlExec(), externalEtlFlow: flow })
      await nextTick()
      wrapper.vm.handleEtlSwitchChange('products', true)
      expect(flow.tableSwitches.products.fixed).toBe(false)
      wrapper.vm.handleEtlSwitchChange('products', false)
      expect(flow.tableSwitches.products.fixed).toBe(true)
    })

    test('handleEtlSwitchChange no-op without flow or state', () => {
      const wrapper = createWrapper({ execution: etlExec() })
      expect(() => wrapper.vm.handleEtlSwitchChange('products', true)).not.toThrow()
      const flow = etlFlow('from_db')
      const w2 = createWrapper({ execution: etlExec(), externalEtlFlow: flow })
      expect(() => w2.vm.handleEtlSwitchChange('missing', true)).not.toThrow()
    })

    test('handleEtlParameterChange writes parameterSwitches', () => {
      const flow = etlFlow('from_db')
      const wrapper = createWrapper({ execution: etlExec(), externalEtlFlow: flow })
      wrapper.vm.handleEtlParameterChange('products.horizon', false)
      expect(flow.parameterSwitches['products.horizon']).toBe(false)
    })

    test('isCurrentTableParameterTable reflects set membership', async () => {
      const flow = {
        tableSwitches: { parameters: { variant: 'from_db', fixed: true } },
        parameterSwitches: {},
        parameterTableNames: new Set(['parameters']),
      }
      const wrapper = createWrapper({ execution: etlExec(), externalEtlFlow: flow })
      await nextTick()
      wrapper.vm.selectedTableKey = 'parameters'
      await nextTick()
      expect(wrapper.vm.isCurrentTableParameterTable).toBe(true)
    })

    test('builds vertical parameter table when parameter table with etl', async () => {
      const flow = {
        tableSwitches: { parameters: { variant: 'from_db', fixed: true } },
        parameterSwitches: { 'parameters.horizon': false },
        parameterTableNames: new Set(['parameters']),
      }
      const wrapper = createWrapper({ execution: buildExecution(), externalEtlFlow: flow })
      await nextTick()
      const paramTable = wrapper.vm.instanceTables.find((t: any) => t.key === 'parameters')
      expect(paramTable.isParameterTableVertical).toBe(true)
    })

    test('injects parameter switch columns for array etl table', async () => {
      const flow = {
        tableSwitches: { products: { variant: 'from_db', fixed: true } },
        parameterSwitches: { 'products.A': false },
        parameterTableNames: new Set(['products']),
      }
      const wrapper = createWrapper({ execution: buildExecution(), externalEtlFlow: flow })
      await nextTick()
      const t = wrapper.vm.instanceTables.find((x: any) => x.key === 'products')
      expect(t.headers.some((h: any) => h.key === '__etl_from_db__')).toBe(true)
    })
  })

  describe('table data lookup helpers', () => {
    test('tableDataForCoreTable returns array data with normalized keys', () => {
      const wrapper = createWrapper({
        execution: {
          instance: {
            data: { 'Operadores Intercambios': [{ id: 1 }], notArray: 5 },
            schema: { properties: {} },
          },
        },
      })
      const out = wrapper.vm.tableDataForCoreTable
      expect(out['Operadores Intercambios']).toBeTruthy()
      // normalized duplicate key added for the array table
      expect(out['operadores_intercambios']).toBeTruthy()
      // non-array values are passed through unchanged (no normalized dup)
      expect(out.notArray).toBe(5)
    })

    test('loadTableDataForCoreTable finds by exact and normalized name', async () => {
      const wrapper = createWrapper({
        execution: {
          instance: {
            data: { products: [{ id: 1 }] },
            schema: { properties: {} },
          },
        },
      })
      expect(await wrapper.vm.loadTableDataForCoreTable('products')).toHaveLength(1)
      expect(await wrapper.vm.loadTableDataForCoreTable('missing')).toEqual([])
    })
  })

  describe('formFields and getOperatorText', () => {
    test('formFields maps headers and filters hidden ones', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      const fields = wrapper.vm.formFields
      expect(fields.some((f: any) => f.key === 'selection')).toBe(false)
      expect(fields.some((f: any) => f.key === 'name')).toBe(true)
    })

    test('getOperatorText delegates to util', () => {
      const wrapper = createWrapper()
      expect(typeof wrapper.vm.getOperatorText('equals')).toBe('string')
    })
  })

  describe('search / filter / selection handlers', () => {
    const exec = () => buildExecution()

    test('handleSearch sets searchValue and debounces', async () => {
      vi.useFakeTimers()
      const wrapper = createWrapper({ execution: exec() })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      wrapper.vm.handleSearch('A')
      expect(wrapper.vm.currentTableState.searchValue).toBe('A')
      vi.advanceTimersByTime(300)
      expect(wrapper.vm.currentTableState.debouncedSearchValue).toBe('A')
      vi.useRealTimers()
    })

    test('handleAddFilter / handleRemoveFilter / handleClearAllFilters', async () => {
      const wrapper = createWrapper({ execution: exec() })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      wrapper.vm.handleAddFilter({ id: 'f1', field: 'name' })
      expect(wrapper.vm.currentTableState.activeFilters).toHaveLength(1)
      wrapper.vm.handleRemoveFilter('f1')
      expect(wrapper.vm.currentTableState.activeFilters).toHaveLength(0)
      wrapper.vm.handleAddFilter({ id: 'f2' })
      wrapper.vm.handleClearAllFilters()
      expect(wrapper.vm.currentTableState.activeFilters).toHaveLength(0)
    })

    test('handleToggleFiltersPanel is a no-op', () => {
      const wrapper = createWrapper()
      expect(() => wrapper.vm.handleToggleFiltersPanel(true)).not.toThrow()
    })

    test('select item toggles selection; select-all and clear', () => {
      const wrapper = createWrapper()
      wrapper.vm.handleSelectItem({ id: 1 })
      expect(wrapper.vm.selectedItems).toHaveLength(1)
      wrapper.vm.handleSelectItem({ id: 1 })
      expect(wrapper.vm.selectedItems).toHaveLength(0)
      wrapper.vm.handleSelectAll([{ id: 1 }, { id: 2 }])
      expect(wrapper.vm.selectedItems).toHaveLength(2)
      wrapper.vm.handleClearSelection()
      expect(wrapper.vm.selectedItems).toHaveLength(0)
    })
  })

  describe('CRUD handlers (non-excel mode)', () => {
    const makeWrapper = async () => {
      const execution = buildExecution()
      const wrapper = createWrapper({ execution, enableExcelMode: false })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      return { wrapper, execution }
    }

    test('handleAddItem opens modal', () => {
      const wrapper = createWrapper()
      wrapper.vm.handleAddItem()
      expect(wrapper.vm.showAddEditModal).toBe(true)
      expect(wrapper.vm.isEditing).toBe(false)
    })

    test('handleEditItem populates form data', () => {
      const wrapper = createWrapper()
      wrapper.vm.handleEditItem({ id: 5, name: 'X' })
      expect(wrapper.vm.isEditing).toBe(true)
      expect(wrapper.vm.formData.name).toBe('X')
    })

    test('handleSaveItem adds row and emits save-changes', async () => {
      const { wrapper, execution } = await makeWrapper()
      wrapper.vm.isEditing = false
      wrapper.vm.handleSaveItem({ name: 'C', qty: '3' })
      expect(execution.instance.data.products).toHaveLength(3)
      expect(wrapper.emitted('save-changes')).toBeTruthy()
    })

    test('handleSaveItem edits existing row', async () => {
      const { wrapper, execution } = await makeWrapper()
      wrapper.vm.isEditing = true
      wrapper.vm.handleSaveItem({ id: 1, name: 'Z', qty: '9' })
      const row = execution.instance.data.products.find((r: any) => r.id === 1)
      expect(row.name).toBe('Z')
      expect(row.qty).toBe(9)
    })

    test('handleConfirmDelete removes row and emits', async () => {
      const { wrapper, execution } = await makeWrapper()
      wrapper.vm.handleDeleteItem({ id: 1, name: 'A' })
      expect(wrapper.vm.showDeleteDialog).toBe(true)
      wrapper.vm.handleConfirmDelete()
      expect(execution.instance.data.products.find((r: any) => r.id === 1)).toBeUndefined()
    })

    test('handleConfirmBulkDelete removes selected', async () => {
      const { wrapper, execution } = await makeWrapper()
      wrapper.vm.handleSelectAll([{ id: 1 }, { id: 2 }])
      wrapper.vm.handleBulkDelete()
      expect(wrapper.vm.showBulkDeleteDialog).toBe(true)
      wrapper.vm.handleConfirmBulkDelete()
      expect(execution.instance.data.products).toHaveLength(0)
    })

    test('handleBulkDelete no-op when no selection', () => {
      const wrapper = createWrapper()
      wrapper.vm.handleBulkDelete()
      expect(wrapper.vm.showBulkDeleteDialog).toBe(false)
    })
  })

  describe('CRUD handlers (excel mode)', () => {
    const makeWrapper = async () => {
      const execution = buildExecution()
      const wrapper = createWrapper({ execution, enableExcelMode: true })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      return { wrapper, execution }
    }

    test('handleSaveItem stages create via recordCreate', async () => {
      const { wrapper } = await makeWrapper()
      wrapper.vm.isEditing = false
      wrapper.vm.handleSaveItem({ name: 'C', qty: 3 })
      expect(tableChangesMock.recordCreate).toHaveBeenCalled()
      expect(wrapper.emitted('pending-changes-update')).toBeTruthy()
    })

    test('handleConfirmDelete stages delete via recordDelete', async () => {
      const { wrapper } = await makeWrapper()
      wrapper.vm.handleDeleteItem({ id: 1 })
      wrapper.vm.handleConfirmDelete()
      expect(tableChangesMock.recordDelete).toHaveBeenCalled()
    })

    test('handleConfirmBulkDelete stages deletes', async () => {
      const { wrapper } = await makeWrapper()
      wrapper.vm.handleSelectAll([{ id: 1 }, { id: 2 }])
      wrapper.vm.handleConfirmBulkDelete()
      expect(tableChangesMock.recordDelete).toHaveBeenCalledTimes(2)
    })
  })

  describe('inline editing', () => {
    const makeWrapper = async (excel = false) => {
      const execution = buildExecution()
      const wrapper = createWrapper({ execution, enableExcelMode: excel })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      return { wrapper, execution }
    }

    test('startInlineEdit sets editing state', async () => {
      const { wrapper } = await makeWrapper()
      wrapper.vm.startInlineEdit({ id: 1, name: 'A' })
      expect(wrapper.vm.editingRowId).toBe(1)
      expect(wrapper.vm.isEditingAnyRow).toBe(true)
    })

    test('startInlineEdit no-op when same row', async () => {
      const { wrapper } = await makeWrapper()
      wrapper.vm.startInlineEdit({ id: 1, name: 'A' })
      wrapper.vm.editingData.name = 'changed'
      wrapper.vm.startInlineEdit({ id: 1, name: 'A' })
      expect(wrapper.vm.editingData.name).toBe('changed')
    })

    test('startInlineEdit overlays pending changes in excel mode', async () => {
      tableChangesMock.getChangesForTable = vi.fn(() => ({
        '1': { name: { newValue: 'OVERLAY', oldValue: 'A' } },
      }))
      const { wrapper } = await makeWrapper(true)
      wrapper.vm.startInlineEdit({ id: 1, name: 'A' })
      expect(wrapper.vm.editingData.name).toBe('OVERLAY')
    })

    test('updateInlineField mutates editingData', () => {
      const wrapper = createWrapper()
      wrapper.vm.updateInlineField('foo', 42)
      expect(wrapper.vm.editingData.foo).toBe(42)
    })

    test('cancelInlineEdit clears state', async () => {
      const { wrapper } = await makeWrapper()
      wrapper.vm.startInlineEdit({ id: 1 })
      wrapper.vm.cancelInlineEdit()
      expect(wrapper.vm.editingRowId).toBe(null)
    })

    test('saveInlineEdit updates array row (non-excel)', async () => {
      const { wrapper, execution } = await makeWrapper(false)
      wrapper.vm.startInlineEdit({ id: 1, name: 'A', qty: 5 })
      wrapper.vm.editingData.qty = '99'
      wrapper.vm.saveInlineEdit()
      const row = execution.instance.data.products.find((r: any) => r.id === 1)
      expect(row.qty).toBe(99)
      expect(wrapper.vm.editingRowId).toBe(null)
    })

    test('saveInlineEdit on object/parameter table', async () => {
      const execution = buildExecution()
      const wrapper = createWrapper({ execution, enableExcelMode: false })
      await nextTick()
      wrapper.vm.selectedTableKey = 'parameters'
      await nextTick()
      wrapper.vm.startInlineEdit({ id: '__object__', horizon: 10, factor: 2.5 })
      wrapper.vm.editingData.horizon = '42'
      wrapper.vm.saveInlineEdit()
      expect(execution.instance.data.parameters.horizon).toBe(42)
    })

    test('saveInlineEdit no-op in excel mode (changes stay staged)', async () => {
      const { wrapper, execution } = await makeWrapper(true)
      wrapper.vm.startInlineEdit({ id: 1, name: 'A' })
      wrapper.vm.saveInlineEdit()
      // No save-changes emitted in excel mode here
      expect(wrapper.vm.editingRowId).toBe(null)
      expect(execution.instance.data.products[0].name).toBe('A')
    })
  })

  describe('cell change and modified helpers', () => {
    const makeWrapper = async (excel = true, flow: any = null) => {
      const execution = buildExecution()
      const wrapper = createWrapper({
        execution,
        enableExcelMode: excel,
        externalEtlFlow: flow,
      })
      await nextTick()
      wrapper.vm.selectedTableKey = 'products'
      await nextTick()
      return { wrapper, execution }
    }

    test('handleCellChange records change and emits', async () => {
      const { wrapper } = await makeWrapper(true)
      wrapper.vm.handleCellChange('products', 1, 'qty', 5, '8')
      expect(tableChangesMock.recordChange).toHaveBeenCalled()
      const args = tableChangesMock.recordChange.mock.calls[0]
      // qty is integer per schema -> coerced to number 8
      expect(args[4]).toBe(8)
      expect(wrapper.emitted('pending-changes-update')).toBeTruthy()
    })

    test('handleCellChange no-op when not excel mode', async () => {
      const { wrapper } = await makeWrapper(false)
      wrapper.vm.handleCellChange('products', 1, 'qty', 5, 8)
      expect(tableChangesMock.recordChange).not.toHaveBeenCalled()
    })

    test('handleCellChange routes ETL switch columns to parameter handler', async () => {
      const flow = {
        tableSwitches: { products: { variant: 'from_db', fixed: true } },
        parameterSwitches: {},
        parameterTableNames: new Set(['products']),
      }
      const { wrapper } = await makeWrapper(true, flow)
      // a product row named 'A' -> paramKey products.A
      wrapper.vm.handleCellChange('products', 1, '__etl_from_db__', false, true)
      expect(tableChangesMock.recordChange).not.toHaveBeenCalled()
    })

    test('handleCellChange on vertical parameter "value" updates ETL switch + editing row', async () => {
      const flow = {
        tableSwitches: { parameters: { variant: 'from_db', fixed: true } },
        parameterSwitches: { 'parameters.horizon': false },
        parameterTableNames: new Set(['parameters']),
      }
      const execution = buildExecution()
      const wrapper = createWrapper({
        execution,
        enableExcelMode: true,
        externalEtlFlow: flow,
      })
      await nextTick()
      wrapper.vm.selectedTableKey = 'parameters'
      await nextTick()
      // begin editing the 'horizon' parameter row so the editingData mirror runs
      wrapper.vm.startInlineEdit({ id: 'horizon', parameter: 'horizon', value: 10 })
      wrapper.vm.handleCellChange('parameters', 'horizon', 'value', 10, '15')
      expect(tableChangesMock.recordChange).toHaveBeenCalled()
      expect(wrapper.vm.editingData.__etl_from_db__).toBe(false)
    })

    test('handleModalUpdateChange on vertical parameter resolves field type', async () => {
      const flow = {
        tableSwitches: { parameters: { variant: 'from_db', fixed: true } },
        parameterSwitches: { 'parameters.horizon': false },
        parameterTableNames: new Set(['parameters']),
      }
      const execution = buildExecution()
      const wrapper = createWrapper({ execution, externalEtlFlow: flow })
      await nextTick()
      wrapper.vm.selectedTableKey = 'parameters'
      await nextTick()
      wrapper.vm.handleModalUpdateChange('parameters', 'horizon', 'value', '20')
      expect(tableChangesMock.recordChange).toHaveBeenCalled()
      const args = tableChangesMock.recordChange.mock.calls.at(-1)
      // horizon is integer -> coerced to number 20
      expect(args[4]).toBe(20)
    })

    test('isCellModified false when not excel', async () => {
      const { wrapper } = await makeWrapper(false)
      expect(wrapper.vm.isCellModified(1, 'qty')).toBe(false)
    })

    test('isCellModified delegates in excel mode', async () => {
      tableChangesMock.isCellModified = vi.fn(() => true)
      const { wrapper } = await makeWrapper(true)
      expect(wrapper.vm.isCellModified(1, 'qty')).toBe(true)
    })

    test('getModifiedValue returns staged value', async () => {
      tableChangesMock.getChangesForTable = vi.fn(() => ({
        '1': { qty: { newValue: 77 } },
      }))
      const { wrapper } = await makeWrapper(true)
      expect(wrapper.vm.getModifiedValue(1, 'qty')).toBe(77)
    })

    test('getModifiedValue undefined when not excel', async () => {
      const { wrapper } = await makeWrapper(false)
      expect(wrapper.vm.getModifiedValue(1, 'qty')).toBeUndefined()
    })

    test('getRowClass delegates in excel mode', async () => {
      tableChangesMock.getRowClass = vi.fn(() => 'row-new')
      const { wrapper } = await makeWrapper(true)
      expect(wrapper.vm.getRowClass({ id: 1 })).toBe('row-new')
    })

    test('getRowClass empty when not excel or no item', async () => {
      const { wrapper } = await makeWrapper(false)
      expect(wrapper.vm.getRowClass({ id: 1 })).toBe('')
    })
  })

  describe('pending changes modal handlers', () => {
    test('openPendingChangesModal / handleClose toggles visibility', () => {
      const wrapper = createWrapper()
      wrapper.vm.openPendingChangesModal()
      expect(wrapper.vm.showPendingChangesModal).toBe(true)
      wrapper.vm.handleClosePendingChangesModal()
      expect(wrapper.vm.showPendingChangesModal).toBe(false)
    })

    test('hasPendingChanges and pendingChangesCount computed', () => {
      tableChangesMock.hasChanges = { value: true }
      tableChangesMock.totalChangesCount = { value: 4 }
      const wrapper = createWrapper()
      expect(wrapper.vm.hasPendingChanges).toBe(true)
      expect(wrapper.vm.pendingChangesCount).toBe(4)
    })

    test('handleModalUpdateChange records change', async () => {
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await nextTick()
      wrapper.vm.handleModalUpdateChange('products', '1', 'qty', '12')
      expect(tableChangesMock.recordChange).toHaveBeenCalled()
    })

    test('handleRevertChange reverts and emits', async () => {
      tableChangesMock.revertChange = vi.fn(() => ({ oldValue: 5 }))
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await nextTick()
      wrapper.vm.handleRevertChange('products', '1', 'qty')
      expect(execution.instance.data.products.find((r: any) => r.id === 1).qty).toBe(5)
      expect(wrapper.emitted('pending-changes-update')).toBeTruthy()
    })

    test('handleRevertRow reverts row fields', async () => {
      tableChangesMock.revertRowChanges = vi.fn(() => ({
        qty: { oldValue: 1 },
        name: { oldValue: 'orig' },
      }))
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await nextTick()
      wrapper.vm.handleRevertRow('products', '1')
      const row = execution.instance.data.products.find((r: any) => r.id === 1)
      expect(row.qty).toBe(1)
      expect(row.name).toBe('orig')
    })

    test('handleRevertTable reverts all rows', async () => {
      tableChangesMock.revertTableChanges = vi.fn(() => ({
        '1': { qty: { oldValue: 100 } },
      }))
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await nextTick()
      wrapper.vm.handleRevertTable('products')
      expect(execution.instance.data.products.find((r: any) => r.id === 1).qty).toBe(100)
    })

    test('handleRevertAll reverts using getAllChanges and clears', async () => {
      tableChangesMock.getAllChanges = vi.fn(() => ({
        products: { '1': { qty: { oldValue: 50 } } },
      }))
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await nextTick()
      wrapper.vm.handleRevertAll()
      expect(execution.instance.data.products.find((r: any) => r.id === 1).qty).toBe(50)
      expect(tableChangesMock.clearAllChanges).toHaveBeenCalled()
      expect(wrapper.emitted('pending-changes-update')).toBeTruthy()
    })
  })

  describe('handleSaveAllChanges', () => {
    test('errors when no instance data', async () => {
      const wrapper = createWrapper({
        execution: { instance: { schema: { properties: {} } } },
      })
      await wrapper.vm.handleSaveAllChanges()
      expect(wrapper.vm.saveValidationError).toBeTruthy()
    })

    test('applies changes, passes validation, emits save-changes', async () => {
      tableChangesMock.modifiedTableKeys = { value: ['products'] }
      tableChangesMock.getChangesForTable = vi.fn((key: string) =>
        key === 'products' ? { '1': { qty: { newValue: 42 } } } : null,
      )
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await nextTick()
      await wrapper.vm.handleSaveAllChanges()
      await flushPromises()
      expect(execution.instance.checkSchema).toHaveBeenCalled()
      expect(wrapper.emitted('save-changes')).toBeTruthy()
      expect(tableChangesMock.clearAllChanges).toHaveBeenCalled()
      expect(wrapper.vm.showPendingChangesModal).toBe(false)
    })

    test('rolls back on validation errors', async () => {
      const execution = buildExecution({
        checkSchema: vi.fn(async () => [{ message: 'bad' }]),
      })
      const wrapper = createWrapper({ execution })
      await nextTick()
      await wrapper.vm.handleSaveAllChanges()
      await flushPromises()
      expect(wrapper.vm.saveValidationError).toBeTruthy()
      expect(wrapper.emitted('save-changes')).toBeFalsy()
    })

    test('catches thrown error during save', async () => {
      const execution = buildExecution({
        checkSchema: vi.fn(async () => {
          throw new Error('boom')
        }),
      })
      const wrapper = createWrapper({ execution })
      await nextTick()
      await wrapper.vm.handleSaveAllChanges()
      await flushPromises()
      expect(wrapper.vm.saveValidationError).toBe('boom')
      expect(wrapper.vm.savingChanges).toBe(false)
    })

    test('applies ETL table switch transitions after save', async () => {
      tableChangesMock.modifiedTableKeys = { value: ['products'] }
      tableChangesMock.getChangesForTable = vi.fn(() => ({
        '1': { qty: { newValue: 3 } },
      }))
      const flow = {
        tableSwitches: { products: { variant: 'from_db', fixed: true } },
        parameterSwitches: {},
        parameterTableNames: new Set<string>(),
      }
      const execution = buildExecution()
      const wrapper = createWrapper({ execution, externalEtlFlow: flow })
      await nextTick()
      await wrapper.vm.handleSaveAllChanges()
      await flushPromises()
      expect(flow.tableSwitches.products.variant).toBe('edited_from_db')
    })
  })

  describe('modal computed data', () => {
    test('getRowIdentifiers / getRowsData / getTableHeaders build maps', async () => {
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await nextTick()
      const ids = wrapper.vm.getRowIdentifiers
      expect(ids.products['1']).toBe('A') // name used as identifier
      const rows = wrapper.vm.getRowsData
      expect(rows.products['1'].name).toBe('A')
      const headers = wrapper.vm.getTableHeaders
      expect(headers.products.some((h: any) => h.key === 'selection')).toBe(false)
      // integer header type mapped to number
      expect(headers.products.find((h: any) => h.key === 'qty')?.type).toBe('number')
    })
  })

  describe('exposed API', () => {
    test('exposes pending-change helpers', () => {
      const wrapper = createWrapper()
      expect(typeof wrapper.vm.openPendingChangesModal).toBe('function')
      expect(typeof wrapper.vm.clearAllChanges).toBe('function')
    })
  })
})
