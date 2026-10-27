import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import ExecutionDataView from '@cornflow-ui/core/components/project-execution/ExecutionDataView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

// Controllable mock of the pending changes store: tests override what they need while the
// component keeps the same object from its setup.
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
    getCurrentValue: vi.fn((_table: string, _row: unknown, _key: string, original: unknown) => original),
    recordCreate: vi.fn(() => 'create-t0-0'),
    recordChange: vi.fn(),
    recordDelete: vi.fn(),
    updateCreateField: vi.fn(),
    revertChange: vi.fn(() => null),
    revertRowChanges: vi.fn(() => null),
    revertTableChanges: vi.fn(() => null),
    revertCreate: vi.fn(),
    revertDelete: vi.fn(),
    clearCreatesForTable: vi.fn(),
    clearDeletesForTable: vi.fn(),
    clearAllChanges: vi.fn(),
    isCellModified: vi.fn(() => false),
    isRowModified: vi.fn(() => false),
    getFullGroupedChanges: vi.fn(() => []),
    modifiedTableKeys: { value: [] },
  })
}

vi.mock('@cornflow-ui/core/composables/useTableChanges', () => ({
  useTableChanges: () => tableChangesMock,
}))

const i18n = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: {
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
        pendingChanges: { saveErrorNoInstanceData: 'No instance data' },
      },
    },
  })

// The table pieces are stubbed: these tests are about what the view feeds them.
const stubs = {
  CoreDataTable: {
    props: ['title', 'rows', 'columns', 'editable'],
    methods: { focusCell: vi.fn() },
    template:
      '<div class="data-table-stub" :data-title="title"><slot name="tabs" /><slot name="strip" /><slot name="body" /></div>',
  },
  DataTableTabs: { template: '<div class="tabs-stub" />' },
  TableSourceStrip: { template: '<div class="strip-stub" />' },
  ParametersTable: { template: '<div class="parameters-stub" />' },
  MessageList: { template: '<div class="messages-stub" />' },
  PendingChangesPanel: { template: '<div class="pending-panel-stub" />' },
  CoreAlert: { props: ['tone', 'message'], template: '<div class="alert-stub" :data-tone="tone">{{ message }}</div>' },
  CoreButton: { props: ['text'], emits: ['click'], template: '<button class="button-stub" @click="$emit(\'click\')">{{ text }}</button>' },
  CoreEmptyState: { props: ['title'], template: '<div class="empty-stub">{{ title }}</div>' },
}

const createWrapper = (props: Record<string, unknown> = {}) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(ExecutionDataView, {
    props: {
      execution: { instance: { data: {}, schema: { properties: {} } } },
      ...props,
    },
    global: { plugins: [pinia, i18n()], stubs },
  })
}

// A realistic execution: an array table declared in the schema and a parameters object.
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

const etlFlow = (switches: Record<string, any>, parameterSwitches: Record<string, any> = {}, parameterTables: string[] = []) => ({
  tableSwitches: switches,
  parameterSwitches,
  parameterTableNames: new Set(parameterTables),
})

const openTable = async (wrapper: any, key: string) => {
  await nextTick()
  wrapper.vm.selectedTableKey = key
  await nextTick()
}

describe('ExecutionDataView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTableChangesMock()
  })

  describe('rendering', () => {
    test('shows the current table in a data table with its tabs', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await nextTick()
      expect(wrapper.find('.data-table-stub').attributes('data-title')).toBe('Products')
      expect(wrapper.find('.tabs-stub').exists()).toBe(true)
    })

    test('renders without an execution', () => {
      const wrapper = mount(ExecutionDataView, {
        props: {},
        global: { plugins: [createPinia(), i18n()], stubs },
      })
      expect(wrapper.find('.execution-data-view').exists()).toBe(true)
    })

    test('says there is no data when there are no tables', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.empty-stub').text()).toBe('No data available')
    })

    test('the check button emits check-data', async () => {
      const wrapper = createWrapper({ canCheckData: true })
      await wrapper.find('.button-stub').trigger('click')
      expect(wrapper.emitted('check-data')).toBeTruthy()
      expect(wrapper.vm.checksLaunched).toBe(true)
    })

    test('a one-record table shows as a list of parameters', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'parameters')
      expect(wrapper.vm.isParametersView).toBe(true)
      expect(wrapper.find('.parameters-stub').exists()).toBe(true)
    })
  })

  describe('checks', () => {
    test('says the checks passed', () => {
      const wrapper = createWrapper({ canCheckData: true, checksFinished: true })
      expect(wrapper.find('.alert-stub').attributes('data-tone')).toBe('success')
    })

    test('is loading while the checks run', async () => {
      expect(createWrapper({ checksInProgress: true }).vm.isLoadingChecks).toBe(true)
      const wrapper = createWrapper()
      wrapper.vm.checksLaunched = true
      await nextTick()
      expect(wrapper.vm.isLoadingChecks).toBe(true)
    })

    test('says the checks failed', () => {
      const wrapper = createWrapper({ canCheckData: true, checksError: true })
      expect(wrapper.find('.alert-stub').attributes('data-tone')).toBe('error')
    })

    test('clears the launch once the checks finish', async () => {
      const wrapper = createWrapper({ checksInProgress: true })
      wrapper.vm.checksLaunched = true
      await wrapper.setProps({ checksInProgress: false, checksFinished: true })
      await nextTick()
      expect(wrapper.vm.checksLaunched).toBe(false)
    })

    test('knows whether the data checks found something', () => {
      const withErrors = createWrapper({
        execution: { instance: { data: {}, schema: { properties: {} }, dataChecks: { errors: ['bad'] } } },
      })
      expect(withErrors.vm.hasValidationErrors).toBe(true)
      const clean = createWrapper({
        execution: { instance: { data: {}, schema: { properties: {} }, dataChecks: {} } },
      })
      expect(clean.vm.hasValidationErrors).toBe(false)
    })

    test('check tables mark their rows with their level and are not editable', async () => {
      const wrapper = createWrapper({
        canCheckData: true,
        execution: {
          instance: {
            data: { products: [{ id: 1 }] },
            schema: { properties: {} },
            dataChecks: { missing_rows: [{ row: 1, msg: 'x' }] },
          },
        },
      })
      await openTable(wrapper, 'validation_missing_rows')
      expect(wrapper.vm.rowLevel()).toBe('error')
      expect(wrapper.vm.isEditableTable).toBe(false)
    })

    test('a check that only returns sentences shows as a list of messages', async () => {
      const wrapper = createWrapper({
        canCheckData: true,
        execution: {
          instance: {
            data: { products: [{ id: 1 }] },
            schema: { properties: {} },
            dataChecks: { warnings_list: ['w1', 'w2'] },
          },
        },
        checksSchema: { properties: { warnings_list: { is_warning: true } } },
      })
      await openTable(wrapper, 'validation_warnings_list')
      expect(wrapper.vm.currentColumns.map((c: any) => c.key)).toEqual(['value'])
      expect(wrapper.vm.isMessageView).toBe(true)
      expect(wrapper.vm.messageRows).toEqual(['w1', 'w2'])
    })
  })

  describe('tables of the instance', () => {
    test('builds the array and object tables of the schema', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await nextTick()
      const keys = wrapper.vm.instanceTables.map((t: any) => t.key)
      expect(keys).toEqual(['products', 'parameters'])
      expect(wrapper.vm.selectedTableKey).toBe('products')
    })

    test('leaves out the tables declared visible: false', async () => {
      const execution: any = buildExecution()
      execution.instance.data.audit_log = [{ id: 1, event: 'x' }]
      execution.instance.schema.properties.audit_log = {
        type: 'array',
        visible: false,
        items: { type: 'object', properties: { event: { type: 'string' } } },
      }
      execution.instance.schema.properties.parameters.visible = false
      const wrapper = createWrapper({ execution })
      await nextTick()
      expect(wrapper.vm.instanceTables.map((t: any) => t.key)).toEqual(['products'])
    })

    describe('tables the schema does not declare', () => {
      const withUndeclared = () => {
        const execution: any = buildExecution()
        execution.instance.data.extra = [{ id: 1, note: 'x' }]
        return execution
      }

      test('get no tab by default', async () => {
        const wrapper = createWrapper({ execution: withUndeclared() })
        await nextTick()
        expect(wrapper.vm.instanceTables.map((t: any) => t.key)).toEqual(['products', 'parameters'])
      })

      test('get a tab with showTablesWithoutSchema', async () => {
        const wrapper = createWrapper({ execution: withUndeclared() })
        const generalStore = useGeneralStore()
        generalStore.appConfig = {
          ...generalStore.appConfig,
          parameters: { ...generalStore.appConfig.parameters, showTablesWithoutSchema: true },
        }
        await nextTick()
        expect(wrapper.vm.instanceTables.map((t: any) => t.key)).toEqual(['products', 'parameters', 'extra'])
      })

      test('get a tab when matched to a master table', async () => {
        const wrapper = createWrapper({
          execution: withUndeclared(),
          masterTableMatches: [{ tableKey: 'extra', masterTableConfig: {} }],
        })
        await nextTick()
        expect(wrapper.vm.instanceTables.map((t: any) => t.key)).toContain('extra')
      })
    })

    test('has no tables without instance data', () => {
      const wrapper = createWrapper({ execution: { instance: { data: null, schema: {} } } })
      expect(wrapper.vm.instanceTables).toEqual([])
    })

    test('builds the check tables in the check step', async () => {
      const wrapper = createWrapper({
        canCheckData: true,
        execution: {
          instance: {
            data: { products: [{ id: 1 }] },
            schema: { properties: {} },
            dataChecks: { missing_rows: [{ row: 1, msg: 'x' }], warnings_list: ['w1', 'w2'] },
          },
        },
        checksSchema: { properties: { warnings_list: { is_warning: true } } },
      })
      await nextTick()
      const tables = wrapper.vm.instanceTables
      expect(tables.map((t: any) => t.key)).toEqual(
        expect.arrayContaining(['validation_missing_rows', 'validation_warnings_list']),
      )
      expect(tables.find((t: any) => t.key === 'validation_warnings_list').isWarning).toBe(true)
    })

    test('lists the tables matched to a master table first', async () => {
      const wrapper = createWrapper({
        execution: buildExecution(),
        masterTableMatches: [{ tableKey: 'parameters', masterTableConfig: { order: 0 } }],
      })
      await nextTick()
      expect(wrapper.vm.instanceTables[0].key).toBe('parameters')
    })
  })

  describe('the current table', () => {
    test('is the selected one, or the first', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'parameters')
      expect(wrapper.vm.currentTable.key).toBe('parameters')
      wrapper.vm.selectedTabKey = 'does-not-exist'
      await nextTick()
      expect(wrapper.vm.currentTable.key).toBe('products')
    })

    test('is empty without tables', () => {
      expect(createWrapper().vm.currentTable.key).toBe('')
    })

    test('shows its rows in windows of 200', async () => {
      const big = Array.from({ length: 450 }, (_, i) => ({ id: i, name: `n${i}` }))
      const wrapper = createWrapper({
        execution: {
          instance: {
            data: { products: big },
            schema: { properties: { products: { type: 'array', items: { properties: { name: { type: 'string' } } } } } },
          },
        },
      })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.windowedCurrentItems).toHaveLength(200)
      expect(wrapper.vm.windowedHasMore).toBe(true)
      wrapper.vm.loadMoreWindow()
      expect(wrapper.vm.windowedCurrentItems).toHaveLength(400)
    })

    test('counts every row and the ones that pass the search', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.currentTotalCount).toBe(2)
      expect(wrapper.vm.currentFilteredCount).toBe(2)
    })

    test('sorts its rows by the column picked, on every row', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'products')
      wrapper.vm.currentSort = { key: 'qty', direction: 'desc' }
      await nextTick()
      expect(wrapper.vm.windowedCurrentItems.map((r: any) => r.name)).toEqual(['B', 'A'])
    })

    test('each table keeps its own search and filters', async () => {
      vi.useFakeTimers()
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'products')
      wrapper.vm.currentSearch = 'A'
      expect(wrapper.vm.currentTableState.searchValue).toBe('A')
      vi.advanceTimersByTime(300)
      expect(wrapper.vm.currentTableState.debouncedSearchValue).toBe('A')
      wrapper.vm.currentFilters = [{ id: 'f1', field: 'name', operator: 'is', value: 'A' }]
      wrapper.vm.selectedTableKey = 'parameters'
      await nextTick()
      expect(wrapper.vm.currentSearch).toBe('')
      expect(wrapper.vm.currentFilters).toEqual([])
      vi.useRealTimers()
    })

    test('builds the columns from the table headers', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'products')
      const columns = wrapper.vm.currentColumns
      expect(columns.map((c: any) => c.key)).toEqual(['name', 'qty'])
      expect(columns.find((c: any) => c.key === 'qty').type).toBe('number')
    })
  })

  describe('row states and values', () => {
    test('a cell shows its pending value', async () => {
      tableChangesMock.getCurrentValue = vi.fn(() => 99)
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.cellValue({ id: 1, qty: 5 }, 'qty')).toBe(99)
    })

    test('a row is deleted, new, modified or plain', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'products')
      tableChangesMock.getRowClass = vi.fn(() => 'row-deleted')
      expect(wrapper.vm.rowState({ id: 1 })).toBe('deleted')
      tableChangesMock.getRowClass = vi.fn(() => 'row-new')
      expect(wrapper.vm.rowState({ id: 1 })).toBe('new')
      tableChangesMock.getRowClass = vi.fn(() => '')
      tableChangesMock.isRowModified = vi.fn(() => true)
      expect(wrapper.vm.rowState({ id: 1 })).toBe('modified')
      tableChangesMock.isRowModified = vi.fn(() => false)
      expect(wrapper.vm.rowState({ id: 1 })).toBeUndefined()
    })

    test('without Excel mode rows have no state and cells no pending value', async () => {
      tableChangesMock.getCurrentValue = vi.fn(() => 99)
      const wrapper = createWrapper({ execution: buildExecution(), enableExcelMode: false })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.rowState({ id: 1 })).toBeUndefined()
      expect(wrapper.vm.cellValue({ id: 1, qty: 5 }, 'qty')).toBe(5)
    })

    test('the table is not editable read-only', async () => {
      const wrapper = createWrapper({ execution: buildExecution(), readOnly: true })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.isEditableTable).toBe(false)
    })
  })

  describe('editing in Excel mode', () => {
    const editing = async () => {
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await openTable(wrapper, 'products')
      return { wrapper, execution }
    }

    test('a cell edit is recorded with the type of its column', async () => {
      const { wrapper } = await editing()
      wrapper.vm.onCellChange({ id: 1, name: 'A', qty: 5 }, 'qty', '8')
      const [table, rowId, key, oldValue, newValue] = tableChangesMock.recordChange.mock.calls[0]
      expect([table, rowId, key, oldValue, newValue]).toEqual(['products', 1, 'qty', 5, 8])
      expect(wrapper.emitted('pending-changes-update')).toBeTruthy()
    })

    test('an edit on an added row changes that row', async () => {
      const { wrapper } = await editing()
      wrapper.vm.onCellChange({ id: 'create-products-0-1', qty: 1 }, 'qty', '9')
      expect(tableChangesMock.updateCreateField).toHaveBeenCalledWith('products', 'create-products-0-1', 'qty', 9)
      expect(tableChangesMock.recordChange).not.toHaveBeenCalled()
    })

    test('adding a row stages it with the types of its columns', async () => {
      const { wrapper } = await editing()
      wrapper.vm.addRow({ name: 'C', qty: '3' })
      expect(tableChangesMock.recordCreate).toHaveBeenCalledWith('products', { name: 'C', qty: 3 }, 'Products')
      expect(wrapper.emitted('pending-changes-update')).toBeTruthy()
    })

    test('deleting rows marks them and clears the selection', async () => {
      const { wrapper } = await editing()
      wrapper.vm.selectedIds = [1, 2]
      wrapper.vm.deleteRows([2])
      expect(tableChangesMock.recordDelete).toHaveBeenCalledTimes(1)
      expect(tableChangesMock.recordDelete.mock.calls[0].slice(0, 2)).toEqual(['products', 2])
      expect(wrapper.vm.selectedIds).toEqual([])
    })

    test('restoring rows takes back their deletion', async () => {
      const { wrapper } = await editing()
      wrapper.vm.restoreRows([2])
      expect(tableChangesMock.revertDelete).toHaveBeenCalledWith('products', 2)
    })

    test('a bulk edit changes every selected row that is not deleted', async () => {
      tableChangesMock.getRowClass = vi.fn((_table: string, row: any) => (row.id === 2 ? 'row-deleted' : ''))
      const { wrapper } = await editing()
      wrapper.vm.bulkEditRows([1, 2], { qty: '4' })
      expect(tableChangesMock.recordChange).toHaveBeenCalledTimes(1)
      expect(tableChangesMock.recordChange.mock.calls[0].slice(0, 5)).toEqual(['products', 1, 'qty', 5, 4])
    })

    test('the selection holds the ids of the current rows', async () => {
      const { wrapper } = await editing()
      wrapper.vm.selectedIds = [2]
      expect(wrapper.vm.selectedItems.map((r: any) => r.name)).toEqual(['B'])
    })
  })

  describe('editing without Excel mode', () => {
    const direct = async () => {
      const execution = buildExecution()
      const wrapper = createWrapper({ execution, enableExcelMode: false })
      await openTable(wrapper, 'products')
      return { wrapper, execution }
    }

    test('adding a row puts it in the data and emits save-changes', async () => {
      const { wrapper, execution } = await direct()
      wrapper.vm.addRow({ name: 'C', qty: '3' })
      expect(execution.instance.data.products).toHaveLength(3)
      expect(execution.instance.data.products[2]).toMatchObject({ name: 'C', qty: 3 })
      expect(wrapper.emitted('save-changes')).toBeTruthy()
    })

    test('deleting rows removes them from the data', async () => {
      const { wrapper, execution } = await direct()
      wrapper.vm.deleteRows([1])
      expect(execution.instance.data.products.map((r: any) => r.id)).toEqual([2])
      expect(wrapper.emitted('save-changes')).toBeTruthy()
    })

    test('cell edits are not recorded', async () => {
      const { wrapper } = await direct()
      wrapper.vm.handleCellChange('products', 1, 'qty', 5, 8)
      expect(tableChangesMock.recordChange).not.toHaveBeenCalled()
    })
  })

  describe('options of the references', () => {
    test('a column without a reference offers its own options', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'products')
      await wrapper.vm.loadOptions({ key: 'name', title: 'Name', type: 'list', options: [{ value: 'A', label: 'A' }] })
      expect(wrapper.vm.optionsFor({ key: 'name' })).toEqual([{ value: 'A', label: 'A' }])
    })

    test('the tables of the instance are found by their name, as written or normalized', async () => {
      const wrapper = createWrapper({
        execution: {
          instance: { data: { 'Shift Swaps': [{ id: 1 }], products: [{ id: 1 }] }, schema: { properties: {} } },
        },
      })
      expect(await wrapper.vm.loadTableDataForCoreTable('products')).toHaveLength(1)
      expect(await wrapper.vm.loadTableDataForCoreTable('shift_swaps')).toHaveLength(1)
      expect(await wrapper.vm.loadTableDataForCoreTable('missing')).toEqual([])
      expect(wrapper.vm.tableDataForCoreTable.shift_swaps).toBeTruthy()
    })
  })

  describe('tabs', () => {
    test('each tab has its title, rows and pending changes', async () => {
      tableChangesMock.getChangesForTable = vi.fn((key: string) =>
        key === 'products' ? { '1': { qty: {}, name: {} } } : null,
      )
      tableChangesMock.getPendingDeletes = vi.fn((key: string) => (key === 'products' ? [{}] : []))
      const wrapper = createWrapper({ execution: buildExecution() })
      await nextTick()
      const products = wrapper.vm.tableTabs.find((tab: any) => tab.key === 'products')
      expect(products).toMatchObject({ label: 'Products', rows: 2, pending: 3 })
    })

    test('a tab shows its master comparison, its origin and its check level', async () => {
      const wrapper = createWrapper({
        execution: buildExecution(),
        masterTableMatches: [{ tableKey: 'products', hasDifferences: true }],
        externalEtlFlow: etlFlow({ products: { variant: 'edited_from_db', fixed: true } }),
      })
      await nextTick()
      const products = wrapper.vm.tableTabs.find((tab: any) => tab.key === 'products')
      expect(products.master).toBe('different')
      expect(products.source).toBe('edited')
    })
  })

  describe('master tables', () => {
    const match = {
      tableKey: 'products',
      masterTableTitle: 'Master Products',
      hasDifferences: true,
      diffSummary: { onlyInInstance: 1, onlyInMaster: 2, different: 3 },
      showReplaceMasterOption: true,
    }

    test('finds the match of a table', () => {
      const wrapper = createWrapper({ execution: buildExecution(), masterTableMatches: [match] })
      expect(wrapper.vm.getMatchForTable('products')).toBeTruthy()
      expect(wrapper.vm.getMatchForTable('nope')).toBe(null)
    })

    test('the bar shows the differences and what can be done', async () => {
      const wrapper = createWrapper({ execution: buildExecution(), masterTableMatches: [match] })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.sourceMaster).toEqual({
        state: 'ready',
        name: 'Master Products',
        added: 1,
        removed: 2,
        modified: 3,
        canUseMaster: true,
        canSaveMaster: true,
      })
      expect(wrapper.find('.strip-stub').exists()).toBe(true)
    })

    test('is still comparing while the match loads', async () => {
      const wrapper = createWrapper({ execution: buildExecution(), masterTableMatches: [match], masterTableLoading: true })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.sourceMaster.state).toBe('comparing')
    })

    test('with the ETL flow the master data is neither used nor saved from here', async () => {
      const wrapper = createWrapper({
        execution: buildExecution(),
        masterTableMatches: [match],
        externalEtlFlow: etlFlow({}),
      })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.sourceMaster).toMatchObject({ canUseMaster: false, canSaveMaster: false })
    })

    test('using or saving the master data and comparing are asked to the parent', async () => {
      const wrapper = createWrapper({ execution: buildExecution(), masterTableMatches: [match] })
      await openTable(wrapper, 'products')
      wrapper.vm.handleMasterTableAction('use_master')
      wrapper.vm.handleMasterTableAction('replace_master')
      wrapper.vm.handleShowComparison()
      expect(wrapper.emitted('master-table-action')).toEqual([
        ['products', 'use_master'],
        ['products', 'replace_master'],
      ])
      expect(wrapper.emitted('show-comparison')).toEqual([['products']])
    })
  })

  describe('origin of the data (ETL)', () => {
    test('the origin of each variant', async () => {
      for (const [variant, origin] of [
        ['from_db', 'database'],
        ['from_excel', 'file'],
        ['edited_from_db', 'edited'],
        ['reuploaded', 'reuploaded'],
      ] as const) {
        const wrapper = createWrapper({
          execution: buildExecution(),
          externalEtlFlow: etlFlow({ products: { variant, fixed: true } }),
        })
        await openTable(wrapper, 'products')
        expect(wrapper.vm.sourceOrigin).toEqual({ variant: origin, perParameter: false })
      }
    })

    test('no origin without the ETL flow', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.sourceOrigin).toBe(null)
    })

    test('a table from the database is static or updated with it', async () => {
      const flow = etlFlow({ products: { variant: 'from_db', fixed: true } })
      const wrapper = createWrapper({ execution: buildExecution(), externalEtlFlow: flow })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.sourceChoice).toBe('static')
      wrapper.vm.setSourceChoice('live')
      expect(flow.tableSwitches.products.fixed).toBe(false)
      expect(wrapper.vm.sourceChoice).toBe('live')
    })

    test('a table from a file uses the file or the database', async () => {
      const flow = etlFlow({ products: { variant: 'from_excel', fixed: true } })
      const wrapper = createWrapper({ execution: buildExecution(), externalEtlFlow: flow })
      await openTable(wrapper, 'products')
      expect(wrapper.vm.sourceChoice).toBe('file')
      wrapper.vm.setSourceChoice('database')
      expect(flow.tableSwitches.products.fixed).toBe(false)
      wrapper.vm.setSourceChoice('file')
      expect(flow.tableSwitches.products.fixed).toBe(true)
    })

    test('a parameter table chooses its origin per parameter', async () => {
      const flow = etlFlow({ parameters: { variant: 'from_db', fixed: true } }, {}, ['parameters'])
      const wrapper = createWrapper({ execution: buildExecution(), externalEtlFlow: flow })
      await openTable(wrapper, 'parameters')
      expect(wrapper.vm.isCurrentTableParameterTable).toBe(true)
      expect(wrapper.vm.sourceOrigin).toEqual({ variant: 'database', perParameter: true })
    })

    test('array parameter tables get a "from database" column', async () => {
      const flow = etlFlow({ products: { variant: 'from_db', fixed: true } }, { 'products.A': false }, ['products'])
      const wrapper = createWrapper({ execution: buildExecution(), externalEtlFlow: flow })
      await nextTick()
      const table = wrapper.vm.instanceTables.find((t: any) => t.key === 'products')
      expect(table.headers.some((h: any) => h.key === '__etl_from_db__')).toBe(true)
    })

    test('toggling a "from database" cell sets the switch of that parameter, not a change', async () => {
      const flow = etlFlow({ products: { variant: 'from_db', fixed: true } }, { 'products.A': true }, ['products'])
      const wrapper = createWrapper({ execution: buildExecution(), externalEtlFlow: flow })
      await openTable(wrapper, 'products')
      wrapper.vm.handleCellChange('products', 1, '__etl_from_db__', false, true)
      expect(flow.parameterSwitches['products.A']).toBe(false)
      expect(tableChangesMock.recordChange).not.toHaveBeenCalled()
    })
  })

  describe('parameters', () => {
    test('an object table lists its fields with their values', async () => {
      tableChangesMock.isCellModified = vi.fn((_t: string, _r: unknown, key: string) => key === 'factor')
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'parameters')
      const rows = wrapper.vm.parameterRows
      expect(rows.map((r: any) => [r.id, r.label, r.value, r.modified])).toEqual([
        ['horizon', 'Horizon', 10, false],
        ['factor', 'Factor', 2.5, true],
      ])
      expect(rows[0].column.type).toBe('number')
    })

    test('editing a field of an object table records a change of its single row', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'parameters')
      wrapper.vm.setParameterValue('horizon', '12')
      const call = tableChangesMock.recordChange.mock.calls[0]
      expect(call.slice(0, 5)).toEqual(['parameters', '__object__', 'horizon', 10, 12])
      wrapper.vm.revertParameter('horizon')
      expect(tableChangesMock.revertChange).toHaveBeenCalledWith('parameters', '__object__', 'horizon')
    })

    describe('loaded through the ETL', () => {
      const vertical = (variant = 'from_db', switches: Record<string, any> = { 'parameters.horizon': false, 'parameters.factor': true }) => {
        const flow = etlFlow({ parameters: { variant, fixed: true } }, switches, ['parameters'])
        const wrapper = createWrapper({ execution: buildExecution(), externalEtlFlow: flow })
        return { wrapper, flow }
      }

      test('each parameter is a row with a "from database" switch', async () => {
        const { wrapper } = vertical()
        await openTable(wrapper, 'parameters')
        expect(wrapper.vm.currentTable.isParameterTableVertical).toBe(true)
        const rows = wrapper.vm.parameterRows
        expect(rows.find((r: any) => r.id === 'horizon').source).toEqual({ mode: 'switch', fromDatabase: true, disabled: false })
        expect(rows.find((r: any) => r.id === 'factor').source).toEqual({ mode: 'switch', fromDatabase: false, disabled: false })
      })

      test('a reuploaded table offers default, database or fixed', async () => {
        const { wrapper } = vertical('reuploaded', { 'parameters.horizon': null, 'parameters.factor': true })
        await openTable(wrapper, 'parameters')
        const rows = wrapper.vm.parameterRows
        expect(rows.find((r: any) => r.id === 'horizon').source).toMatchObject({ mode: 'choice', value: 'default' })
        expect(rows.find((r: any) => r.id === 'factor').source).toMatchObject({ mode: 'choice', value: 'fixed' })
      })

      test('editing a value records it typed and stops reading it from the database', async () => {
        const { wrapper, flow } = vertical()
        await openTable(wrapper, 'parameters')
        wrapper.vm.setParameterValue('horizon', '15')
        expect(tableChangesMock.recordChange.mock.calls[0].slice(0, 5)).toEqual(['parameters', 'horizon', 'value', 10, 15])
        expect(flow.parameterSwitches['parameters.horizon']).toBe(true)
      })

      test('the switch and the choices set the origin of the parameter', async () => {
        const { wrapper, flow } = vertical()
        await openTable(wrapper, 'parameters')
        wrapper.vm.setParameterSource('factor', true)
        expect(flow.parameterSwitches['parameters.factor']).toBe(false)

        const reuploaded = vertical('reuploaded', { 'parameters.horizon': null })
        await openTable(reuploaded.wrapper, 'parameters')
        reuploaded.wrapper.vm.setParameterSource('horizon', 'fixed')
        expect(reuploaded.flow.parameterSwitches['parameters.horizon']).toBe(true)
        reuploaded.wrapper.vm.setParameterSource('horizon', 'database')
        expect(reuploaded.flow.parameterSwitches['parameters.horizon']).toBe(false)
      })

      test('reverting a parameter takes back its value', async () => {
        const { wrapper } = vertical()
        await openTable(wrapper, 'parameters')
        wrapper.vm.revertParameter('horizon')
        expect(tableChangesMock.revertChange).toHaveBeenCalledWith('parameters', 'horizon', 'value')
      })

      test('a parameter that cannot come from the database has its switch disabled', async () => {
        const execution: any = buildExecution()
        execution.instance.schema.properties.parameters.properties.factor.allow_load_from_db = false
        const flow = etlFlow({ parameters: { variant: 'from_db', fixed: true } }, {}, ['parameters'])
        const wrapper = createWrapper({ execution, externalEtlFlow: flow })
        await openTable(wrapper, 'parameters')
        const factor = wrapper.vm.parameterRows.find((r: any) => r.id === 'factor')
        expect(factor.source.disabled).toBe(true)
        expect(wrapper.vm.cellDisabled({ __etl_from_db_disabled__: true }, '__etl_from_db__')).toBe(true)
      })
    })
  })

  describe('review of the pending changes', () => {
    test('groups the changes of every table', async () => {
      tableChangesMock.getFullGroupedChanges = vi.fn(() => [
        {
          tableKey: 'products',
          tableTitle: 'Products',
          changes: [{ rowId: '1', fields: [{ fieldKey: 'qty', oldValue: 5, newValue: 6 }] }],
          creates: [{ tempId: 'create-products-0-1', data: { name: 'C', qty: 1 } }],
          deletes: [{ rowId: '2' }],
        },
      ])
      const wrapper = createWrapper({ execution: buildExecution() })
      await nextTick()
      const [group] = wrapper.vm.pendingGroups
      expect(group.tableKey).toBe('products')
      expect(group.items.map((item: any) => [item.kind, item.label])).toEqual([
        ['modified', 'Name A'],
        ['new', 'Name C'],
        ['deleted', 'Name B'],
      ])
    })

    test('reverts a table, a row of each kind, a field and everything', async () => {
      tableChangesMock.revertRowChanges = vi.fn(() => ({ qty: { oldValue: 1 }, name: { oldValue: 'orig' } }))
      tableChangesMock.revertChange = vi.fn(() => ({ oldValue: 5 }))
      tableChangesMock.getAllChanges = vi.fn(() => ({ products: { '2': { qty: { oldValue: 50 } } } }))
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await nextTick()
      wrapper.vm.revertTable('products')
      expect(tableChangesMock.revertTableChanges).toHaveBeenCalledWith('products')
      expect(tableChangesMock.clearCreatesForTable).toHaveBeenCalledWith('products')
      expect(tableChangesMock.clearDeletesForTable).toHaveBeenCalledWith('products')
      wrapper.vm.revertRow('products', 'create-products-0-1', 'new')
      expect(tableChangesMock.revertCreate).toHaveBeenCalledWith('products', 'create-products-0-1')
      wrapper.vm.revertRow('products', 2, 'deleted')
      expect(tableChangesMock.revertDelete).toHaveBeenCalledWith('products', 2)
      wrapper.vm.revertRow('products', 1, 'modified')
      expect(execution.instance.data.products[0]).toMatchObject({ qty: 1, name: 'orig' })
      wrapper.vm.handleRevertChange('products', '1', 'qty')
      expect(execution.instance.data.products[0].qty).toBe(5)
      wrapper.vm.handleRevertAll()
      expect(execution.instance.data.products[1].qty).toBe(50)
      expect(tableChangesMock.clearAllChanges).toHaveBeenCalled()
    })

    test('a value edited in the review is recorded, or changes the added row', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await nextTick()
      wrapper.vm.updateReviewField('products', 1, 'qty', '12')
      expect(tableChangesMock.recordChange.mock.calls[0].slice(0, 5)).toEqual(['products', '1', 'qty', 5, 12])
      wrapper.vm.updateReviewField('products', 'create-products-0-1', 'qty', 3)
      expect(tableChangesMock.updateCreateField).toHaveBeenCalledWith('products', 'create-products-0-1', 'qty', 3)
    })

    test('going to a change opens its table and clears what hides it', async () => {
      const wrapper = createWrapper({ execution: buildExecution() })
      await openTable(wrapper, 'parameters')
      const state = wrapper.vm.getTableState('products')
      state.searchValue = 'zzz'
      state.debouncedSearchValue = 'zzz'
      state.activeFilters = [{ id: 'f', field: 'name', operator: 'is', value: 'X' }]
      await wrapper.vm.goToChange('products', '2', 'qty')
      expect(wrapper.vm.currentTable.key).toBe('products')
      expect(state.debouncedSearchValue).toBe('')
      expect(state.activeFilters).toEqual([])
      expect(wrapper.vm.highlightedRowId).toBe(2)
    })

    test('opens with the review button', () => {
      const wrapper = createWrapper()
      wrapper.vm.openPendingChangesModal()
      expect(wrapper.vm.showPendingChangesModal).toBe(true)
    })

    test('counts the pending changes', () => {
      tableChangesMock.hasChanges = { value: true }
      tableChangesMock.totalChangesCount = { value: 4 }
      const wrapper = createWrapper()
      expect(wrapper.vm.hasPendingChanges).toBe(true)
      expect(wrapper.vm.pendingChangesCount).toBe(4)
    })
  })

  describe('applying the pending changes', () => {
    test('fails without instance data', async () => {
      const wrapper = createWrapper({ execution: { instance: { schema: { properties: {} } } } })
      await wrapper.vm.handleSaveAllChanges()
      expect(wrapper.vm.saveValidationError).toBeTruthy()
    })

    test('applies them, validates the data and emits save-changes', async () => {
      tableChangesMock.modifiedTableKeys = { value: ['products'] }
      tableChangesMock.getChangesForTable = vi.fn((key: string) =>
        key === 'products' ? { '1': { qty: { newValue: 42 } } } : null,
      )
      const execution = buildExecution()
      const wrapper = createWrapper({ execution })
      await nextTick()
      wrapper.vm.openPendingChangesModal()
      await wrapper.vm.handleSaveAllChanges()
      await flushPromises()
      expect(execution.instance.checkSchema).toHaveBeenCalled()
      expect(wrapper.emitted('save-changes')).toBeTruthy()
      expect(tableChangesMock.clearAllChanges).toHaveBeenCalled()
      expect(wrapper.vm.showPendingChangesModal).toBe(false)
    })

    test('keeps the data when it does not pass the schema', async () => {
      const execution = buildExecution({ checkSchema: vi.fn(async () => [{ message: 'bad' }]) })
      const wrapper = createWrapper({ execution })
      await nextTick()
      await wrapper.vm.handleSaveAllChanges()
      await flushPromises()
      expect(wrapper.vm.saveValidationError).toBeTruthy()
      expect(wrapper.emitted('save-changes')).toBeFalsy()
    })

    test('says what failed', async () => {
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

    test('an edited table from the database becomes "edited from the database"', async () => {
      tableChangesMock.modifiedTableKeys = { value: ['products'] }
      tableChangesMock.getChangesForTable = vi.fn(() => ({ '1': { qty: { newValue: 3 } } }))
      const flow = etlFlow({ products: { variant: 'from_db', fixed: true } })
      const execution = buildExecution()
      const wrapper = createWrapper({ execution, externalEtlFlow: flow })
      await nextTick()
      await wrapper.vm.handleSaveAllChanges()
      await flushPromises()
      expect(flow.tableSwitches.products.variant).toBe('edited_from_db')
    })
  })

  describe('exposed', () => {
    test('toggles the full screen and gives the pending-change helpers', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.fullscreen).toBe(false)
      wrapper.vm.toggleFullscreen()
      expect(wrapper.vm.fullscreen).toBe(true)
      expect(typeof wrapper.vm.saveAllChanges).toBe('function')
      expect(typeof wrapper.vm.openPendingChangesModal).toBe('function')
      expect(typeof wrapper.vm.clearAllChanges).toBe('function')
    })
  })
})
