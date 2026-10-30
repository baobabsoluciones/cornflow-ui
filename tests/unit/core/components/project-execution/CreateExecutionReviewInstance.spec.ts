import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import CreateExecutionReviewInstance from '@cornflow-ui/core/components/project-execution/CreateExecutionReviewInstance.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

// ── Controllable composables ────────────────────────────────────────────────
const { mtm, tableChangesMock, appConfigMock, excel, view, comparison } = vi.hoisted(() => {
  const ref = (v: any) => ({ value: v })
  const mtm = {
    matches: ref([] as any[]),
    loading: ref(false),
    forceRetryOffer: ref(null as any),
    forceRetryLoading: ref(false),
    detectMatches: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    canReplaceMasterTable: vi.fn(() => true),
    setUserChoice: vi.fn(),
    applyChoices: vi.fn().mockResolvedValue({ masterTablesUpdated: [] }),
    updateMatchAfterAction: vi.fn(),
    acceptForceRetry: vi.fn().mockResolvedValue(true),
    rejectForceRetry: vi.fn(),
  }
  const tableChangesMock = {
    pendingChanges: ref({} as Record<string, any>),
    pendingCreates: ref({} as Record<string, any>),
    pendingDeletes: ref({} as Record<string, any>),
    hasChanges: ref(false),
    getChangesForTable: vi.fn(() => null as any),
    getPendingCreates: vi.fn(() => [] as any[]),
    getPendingDeletes: vi.fn(() => [] as any[]),
    recordChange: vi.fn(),
    recordCreate: vi.fn(),
    recordDelete: vi.fn(),
    revertCreate: vi.fn(),
    setTableTitle: vi.fn(),
    clearAllChanges: vi.fn(),
  }
  const appConfigMock = {
    getCore: () => ({
      parameters: {
        enableMasterTableMatching: true,
        enableReplaceMasterWithUploaded: true,
      },
    }),
  }
  const excel = {
    downloadExcel: vi.fn(),
    handleFileUpload: vi.fn(),
    onInstanceUpdate: null as null | ((instance: any) => void),
  }
  const view = {
    toggleFullscreen: vi.fn(),
    saveAllChanges: vi.fn().mockResolvedValue(true),
  }
  const comparison = { lines: [] as any[], comparisonLinesFrom: vi.fn() }
  comparison.comparisonLinesFrom.mockImplementation(() => comparison.lines)
  return { mtm, tableChangesMock, appConfigMock, excel, view, comparison }
})

vi.mock('@cornflow-ui/core/composables/project-execution/useMasterTableMatch', () => ({
  useMasterTableMatch: () => mtm,
  getMasterCompareRowContext: () => ({
    keyFields: ['id'],
    normInstByKey: {},
    normMasterByKey: {},
  }),
}))

vi.mock('@cornflow-ui/core/composables/useTableChanges', () => ({
  useTableChanges: () => tableChangesMock,
}))

vi.mock('@/app/config', async (orig) => {
  const actual = (await (orig as () => Promise<any>)()) as any
  // Keep the real config object and only take getCore from the mutable mock.
  actual.default.getCore = (...args: any[]) => appConfigMock.getCore(...args)
  return actual
})

vi.mock('@cornflow-ui/core/repositories/TableRepository', () => ({
  isForceRetryOfferError: (e: any) => !!e?.__forceRetry,
}))

vi.mock('@cornflow-ui/core/utils/schemaUtils', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  parameterRowsToParameterObject: (rows: any) => ({ params: rows }),
  buildRowMatchKey: (row: any) => String(row?.id ?? ''),
}))

vi.mock('@cornflow-ui/core/utils/dataComparison', () => ({
  comparisonLinesFrom: comparison.comparisonLinesFrom,
}))

vi.mock('@cornflow-ui/core/components/core/data-table/DataComparisonDialog.vue', () => ({
  default: {
    name: 'DataComparisonDialog',
    template: '<div data-testid="data-comparison-dialog"></div>',
    props: {
      open: Boolean,
      tableTitle: String,
      columns: Array,
      lines: Array,
      loadedCount: Number,
      masterCount: Number,
      pendingCount: Number,
      allowRestore: Boolean,
      allowDelete: Boolean,
    },
    emits: ['update:open', 'restore', 'delete'],
  },
}))

vi.mock('@cornflow-ui/core/components/core/table/ForceRetryConfirmDialog.vue', () => ({
  default: {
    name: 'ForceRetryConfirmDialog',
    template: '<div data-testid="force-retry-dialog"></div>',
    props: ['modelValue', 'message', 'loading'],
    emits: ['confirm', 'cancel', 'update:modelValue'],
  },
}))

vi.mock('@cornflow-ui/core/composables/project-execution/useExecutionExcel', () => ({
  useExecutionExcel: (_execution: unknown, onInstanceUpdate: (instance: any) => void) => {
    excel.onInstanceUpdate = onInstanceUpdate
    return { downloadExcel: excel.downloadExcel, handleFileUpload: excel.handleFileUpload }
  },
}))

const { MockInstance } = vi.hoisted(() => {
  const MockInstance = vi.fn(function (id, data) {
    return {
      checkSchema: vi.fn().mockResolvedValue([]),
      data: data || { test: 'data' },
      id: id,
    }
  })
  return { MockInstance }
})

vi.mock('@/app/models/Instance', () => ({
  Instance: MockInstance,
}))

vi.mock('@cornflow-ui/core/config', () => ({
  default: {
    schema: 'test-schema',
    initConfig: vi.fn().mockResolvedValue(undefined),
  },
}))

// The view is stubbed: it exposes what the review calls and emits what the review listens to.
const ExecutionDataViewStub = {
  name: 'ExecutionDataView',
  template: `
    <div class="execution-data-view" data-testid="execution-data-view">
      <button @click="$emit('save-changes', { updated: true })" data-testid="trigger-save" />
      <button @click="$emit('master-table-action', 'orders', 'use_master')" data-testid="trigger-use-master" />
      <button @click="$emit('master-table-action', 'orders', 'replace_master')" data-testid="trigger-replace-master" />
      <button @click="$emit('master-table-action', 'orders', 'keep_uploaded')" data-testid="trigger-keep" />
      <button @click="$emit('show-comparison', 'orders')" data-testid="trigger-show-comparison" />
    </div>
  `,
  props: [
    'execution',
    'masterTableMatches',
    'masterTableLoading',
    'enableExcelMode',
    'externalEtlFlow',
  ],
  emits: ['save-changes', 'master-table-action', 'show-comparison'],
  methods: {
    toggleFullscreen: () => view.toggleFullscreen(),
    saveAllChanges: () => view.saveAllChanges(),
  },
}

const ordersMatch = (overrides: Record<string, any> = {}) => ({
  tableKey: 'orders',
  masterTableTitle: 'Orders',
  masterData: [{ id: 1, qty: 5 }],
  instanceData: [{ id: 1, qty: 3 }],
  fullInstanceData: { orders: [{ id: 1, qty: 3 }] },
  instanceSchemaColumns: ['qty'],
  ...overrides,
})

describe('CreateExecutionReviewInstance', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    mtm.matches.value = []
    mtm.loading.value = false
    mtm.forceRetryOffer.value = null
    mtm.forceRetryLoading.value = false
    mtm.canReplaceMasterTable.mockReturnValue(true)
    mtm.applyChoices.mockResolvedValue({ masterTablesUpdated: [] })
    mtm.acceptForceRetry.mockResolvedValue(true)
    tableChangesMock.pendingChanges.value = {}
    tableChangesMock.pendingCreates.value = {}
    tableChangesMock.pendingDeletes.value = {}
    tableChangesMock.hasChanges.value = false
    tableChangesMock.getChangesForTable.mockReturnValue(null)
    tableChangesMock.getPendingCreates.mockReturnValue([])
    tableChangesMock.getPendingDeletes.mockReturnValue([])
    view.saveAllChanges.mockResolvedValue(true)
    comparison.lines = []
    appConfigMock.getCore = () => ({
      parameters: {
        enableMasterTableMatching: true,
        enableReplaceMasterWithUploaded: true,
      },
    })
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  const createWrapper = (props = {}, provideOverrides: Record<string, any> = {}) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const generalStore = useGeneralStore()
    generalStore.schemaConfig = {
      instanceSchema: {},
      instanceChecksSchema: {},
    } as any

    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      missingWarn: false,
      fallbackWarn: false,
      messages: {
        en: {
          projectExecution: {
            maximize: 'Maximize',
            downloadExcel: 'Download Excel',
            uploadExcel: 'Upload Excel',
            steps: {
              step3: {
                loadInstance: {
                  instanceSchemaError: 'Schema validation error',
                  unexpectedError: 'Unexpected error',
                },
              },
            },
          },
          dataComparison: {
            restoreRowQueued: 'Row restored',
            deleteRowQueued: 'Row deleted',
          },
        },
      },
    })

    return mount(CreateExecutionReviewInstance, {
      props: {
        newExecution: {
          id: 'test-execution',
          name: 'Test Execution',
          instance: {
            id: 'instance-123',
            data: { test: 'data' },
          },
        },
        ...props,
      },
      global: {
        plugins: [pinia, i18n],
        provide: {
          showSnackbar: vi.fn(),
          ...provideOverrides,
        },
        stubs: {
          ExecutionDataView: ExecutionDataViewStub,
        },
      },
    })
  }

  const withOrders = (schema?: Record<string, any>) => ({
    newExecution: {
      id: 'e',
      name: 'E',
      instance: { id: 'i', data: { orders: [{ id: 1, qty: 3 }] }, ...(schema ? { schema } : {}) },
    },
  })

  describe('the data view', () => {
    test('shows the execution in a single data view, with pending changes', () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        instance: { id: 'instance-456', data: {} },
      }
      wrapper = createWrapper({ newExecution: execution })
      const dataViews = wrapper.findAllComponents(ExecutionDataViewStub)
      expect(dataViews).toHaveLength(1)
      expect(dataViews[0].props('execution')).toEqual(execution)
      expect(dataViews[0].props('enableExcelMode')).toBe(true)
    })

    test('passes the ETL flow to the view', () => {
      const flow = { tableSwitches: {}, parameterSwitches: {} }
      wrapper = createWrapper({ externalEtlFlow: flow })
      expect(wrapper.findComponent(ExecutionDataViewStub).props('externalEtlFlow')).toEqual(flow)
    })
  })

  describe('toolbar', () => {
    test('downloads the data as Excel', async () => {
      wrapper = createWrapper()
      const button = wrapper.findAll('.review-instance-header button').find((b: any) => b.text() === 'Download Excel')
      await button.trigger('click')
      expect(excel.downloadExcel).toHaveBeenCalled()
    })

    test('opens the file picker to upload an Excel', async () => {
      wrapper = createWrapper()
      const input = wrapper.find('input[type="file"]')
      const click = vi.fn()
      input.element.click = click
      const button = wrapper.findAll('.review-instance-header button').find((b: any) => b.text() === 'Upload Excel')
      await button.trigger('click')
      expect(click).toHaveBeenCalled()
      await input.trigger('change')
      expect(excel.handleFileUpload).toHaveBeenCalled()
    })

    test('maximizes the data view', async () => {
      wrapper = createWrapper()
      await wrapper.find('.review-instance-header button[aria-label="Maximize"]').trigger('click')
      expect(view.toggleFullscreen).toHaveBeenCalledTimes(1)
    })

    test('is left out when the screen offers its own, which calls the exposed actions', async () => {
      wrapper = createWrapper({ showToolbar: false })
      expect(wrapper.find('.review-instance-header').exists()).toBe(false)
      wrapper.vm.toggleMaximize()
      wrapper.vm.downloadExcel()
      expect(view.toggleFullscreen).toHaveBeenCalled()
      expect(excel.downloadExcel).toHaveBeenCalled()
    })
  })

  describe('saving changes', () => {
    test('validates the saved data and emits the new instance', async () => {
      wrapper = createWrapper()
      await wrapper.find('[data-testid="trigger-save"]').trigger('click')
      await flushPromises()
      const emittedInstance = wrapper.emitted('update:instance')[0][0]
      expect(emittedInstance.data).toEqual({ updated: true })
      expect(emittedInstance.checkSchema).toBeDefined()
      expect(wrapper.emitted('update:instanceErrors')![0]).toEqual([null])
    })

    test('every save emits its instance', async () => {
      wrapper = createWrapper()
      const triggerButton = wrapper.find('[data-testid="trigger-save"]')
      await triggerButton.trigger('click')
      await flushPromises()
      await triggerButton.trigger('click')
      await flushPromises()
      expect(wrapper.emitted('update:instance')).toHaveLength(2)
    })

    test('keeps the instance and shows the errors when the data breaks the schema', async () => {
      const snackbar = vi.fn()
      MockInstance.mockImplementationOnce(function (id: any, data: any) {
        return { id, data, checkSchema: vi.fn().mockResolvedValue([{ message: 'bad', instancePath: '/x' }]) }
      })
      wrapper = createWrapper({}, { showSnackbar: snackbar })
      await wrapper.vm.handleSaveChanges({ x: 1 })
      await flushPromises()
      expect(wrapper.emitted('update:instance')).toBeFalsy()
      expect(wrapper.emitted('update:instanceErrors')![0][0]).toContain('Schema validation error')
      expect(snackbar).toHaveBeenCalledWith('Schema validation error', 'error', { persistent: true })
      expect(wrapper.find('.core-alert--error').exists()).toBe(true)
    })

    test('does nothing without an instance', async () => {
      for (const instance of [undefined, null]) {
        wrapper = createWrapper({ newExecution: { id: 'test', name: 'Test', instance } })
        await wrapper.vm.handleSaveChanges({ field: 'value' })
        await flushPromises()
        expect(wrapper.emitted('update:instance')).toBeFalsy()
        wrapper.unmount()
      }
      wrapper = null
    })

    test('an uploaded Excel is a new instance with its data, and marks the ETL tables as reuploaded', async () => {
      const flow = {
        tableSwitches: { orders: { variant: 'from_db', fixed: false } },
        parameterSwitches: { 'parameters.horizon': true },
      }
      wrapper = createWrapper({ ...withOrders(), externalEtlFlow: flow })
      excel.onInstanceUpdate!({ data: { orders: [] } })
      expect(flow.tableSwitches.orders).toEqual({ variant: 'reuploaded', fixed: true })
      expect(flow.parameterSwitches['parameters.horizon']).toBe(null)
      expect(wrapper.emitted('update:instance')![0][0]).toMatchObject({ id: null, data: { orders: [] } })
    })
  })

  describe('instance errors', () => {
    test('shows the errors in an alert below the table', async () => {
      wrapper = createWrapper({ instanceErrors: '<b>Boom</b>' })
      const alert = wrapper.find('.review-instance-errors')
      expect(alert.classes()).toContain('core-alert--error')
      expect(alert.find('b').text()).toBe('Boom')
    })

    test('has no alert without errors', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.review-instance-errors').exists()).toBe(false)
    })

    test('follows the errors of the parent', async () => {
      wrapper = createWrapper({ instanceErrors: null })
      await wrapper.setProps({ instanceErrors: 'new error' })
      await flushPromises()
      expect(wrapper.find('.review-instance-errors').text()).toContain('new error')
    })
  })

  describe('master table matching', () => {
    test('clears a stale force-retry dialog on mount', () => {
      wrapper = createWrapper()
      expect(mtm.rejectForceRetry).toHaveBeenCalled()
    })

    test('detects the matches on mount', () => {
      wrapper = createWrapper()
      expect(mtm.detectMatches).toHaveBeenCalled()
    })

    test('gives the view the matches with whether the master can be replaced', async () => {
      mtm.matches.value = [{ tableKey: 'orders', masterTableTitle: 'Orders', masterData: [] }]
      wrapper = createWrapper()
      await flushPromises()
      const [match] = wrapper.findComponent(ExecutionDataViewStub).props('masterTableMatches')
      expect(match.canReplaceMaster).toBe(true)
      expect(match.showReplaceMasterOption).toBe(true)
    })

    test('the view shows the matches loading', async () => {
      mtm.loading.value = true
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.findComponent(ExecutionDataViewStub).props('masterTableLoading')).toBe(true)
    })

    test('has no matches when the matching is turned off', async () => {
      appConfigMock.getCore = () => ({
        parameters: {
          enableMasterTableMatching: false,
          enableReplaceMasterWithUploaded: true,
        },
      })
      mtm.matches.value = [{ tableKey: 'orders', masterTableTitle: 'x', masterData: [] }]
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.findComponent(ExecutionDataViewStub).props('masterTableMatches')).toEqual([])
    })
  })

  describe('master table actions', () => {
    test('using the master data records the choice and emits the instance', async () => {
      mtm.matches.value = [ordersMatch({ storageShape: 'array' })]
      wrapper = createWrapper()
      await flushPromises()
      await wrapper.find('[data-testid="trigger-use-master"]').trigger('click')
      await flushPromises()
      expect(mtm.setUserChoice).toHaveBeenCalledWith('orders', 'use_master')
      expect(mtm.updateMatchAfterAction).toHaveBeenCalledWith('orders', 'use_master', expect.any(Array))
      expect(wrapper.emitted('update:instance')).toBeTruthy()
    })

    test('saving as master marks the table as replaced', async () => {
      mtm.matches.value = [ordersMatch()]
      mtm.applyChoices.mockResolvedValueOnce({ masterTablesUpdated: ['Orders'] })
      wrapper = createWrapper()
      await flushPromises()
      await wrapper.find('[data-testid="trigger-replace-master"]').trigger('click')
      await flushPromises()
      expect(mtm.applyChoices).toHaveBeenCalled()
      expect(mtm.updateMatchAfterAction).toHaveBeenCalledWith('orders', 'replace_master')
    })

    test('saving as master waits for the force-retry answer when the backend offers it', async () => {
      mtm.matches.value = [ordersMatch()]
      mtm.applyChoices.mockRejectedValueOnce({ __forceRetry: true })
      wrapper = createWrapper()
      await flushPromises()
      await wrapper.find('[data-testid="trigger-replace-master"]').trigger('click')
      await flushPromises()
      expect(mtm.updateMatchAfterAction).not.toHaveBeenCalled()
    })

    test('saving as master says what failed', async () => {
      const snackbar = vi.fn()
      mtm.matches.value = [ordersMatch()]
      mtm.applyChoices.mockRejectedValueOnce(new Error('nope'))
      wrapper = createWrapper({}, { showSnackbar: snackbar })
      await flushPromises()
      await wrapper.find('[data-testid="trigger-replace-master"]').trigger('click')
      await flushPromises()
      expect(snackbar).toHaveBeenCalledWith('nope', 'error')
    })

    test('keeping the uploaded data only records the choice', async () => {
      mtm.matches.value = [ordersMatch()]
      wrapper = createWrapper()
      await flushPromises()
      await wrapper.find('[data-testid="trigger-keep"]').trigger('click')
      await flushPromises()
      expect(mtm.setUserChoice).toHaveBeenCalledWith('orders', 'keep_uploaded')
      expect(mtm.applyChoices).not.toHaveBeenCalled()
      expect(wrapper.emitted('update:instance')).toBeFalsy()
    })
  })

  describe('force retry', () => {
    const offer = { message: 'overwrite?', match: { tableKey: 'orders', tableName: 'Orders' } }
    const dialog = () => wrapper.findComponent({ name: 'ForceRetryConfirmDialog' })

    test('opens with the message of the offer', async () => {
      mtm.forceRetryOffer.value = offer
      mtm.forceRetryLoading.value = true
      wrapper = createWrapper()
      await flushPromises()
      expect(dialog().props()).toMatchObject({ modelValue: true, message: 'overwrite?', loading: true })
    })

    test('stays closed without an offer', () => {
      wrapper = createWrapper()
      expect(dialog().props()).toMatchObject({ modelValue: false, message: '', loading: false })
    })

    test.each([
      ['with a snackbar', {}],
      ['without a snackbar', { showSnackbar: undefined }],
    ])('confirming retries and marks the table as replaced, %s', async (_, provide) => {
      mtm.forceRetryOffer.value = offer
      wrapper = createWrapper({}, provide)
      await flushPromises()
      dialog().vm.$emit('confirm')
      await flushPromises()
      expect(mtm.acceptForceRetry).toHaveBeenCalled()
      expect(mtm.updateMatchAfterAction).toHaveBeenCalledWith('orders', 'replace_master')
    })

    test('cancelling or closing rejects the retry', async () => {
      mtm.forceRetryOffer.value = offer
      wrapper = createWrapper()
      await flushPromises()
      mtm.rejectForceRetry.mockClear()
      dialog().vm.$emit('cancel')
      dialog().vm.$emit('update:modelValue', false)
      await flushPromises()
      expect(mtm.rejectForceRetry).toHaveBeenCalledTimes(2)
    })
  })

  describe('comparison with the master table', () => {
    const lines = [
      {
        key: '1',
        status: 'modified',
        loaded: { id: 1, qty: 3 },
        master: { id: 1, qty: 5 },
        changedKeys: ['qty'],
        loadedRow: { id: 1, qty: 3 },
        masterRow: { id: 1, qty: 5 },
      },
      { key: '999', status: 'removed', master: { id: 999, qty: 9, __note: 'x' }, changedKeys: [], masterRow: { id: 999, qty: 9 } },
      { key: 'create-123', status: 'pendingCreate', loaded: { qty: 3 }, changedKeys: [], loadedRow: { id: 'create-123', qty: 3 } },
    ]

    const openComparison = async (matchOverrides = {}, props = withOrders()) => {
      comparison.lines = lines
      mtm.matches.value = [ordersMatch(matchOverrides)]
      wrapper = createWrapper(props)
      await flushPromises()
      await wrapper.find('[data-testid="trigger-show-comparison"]').trigger('click')
      await flushPromises()
      return wrapper.findComponent({ name: 'DataComparisonDialog' })
    }

    test('opens for the matched table with its lines', async () => {
      const dialog = await openComparison()
      expect(dialog.props()).toMatchObject({
        open: true,
        tableTitle: 'Orders',
        lines,
        allowRestore: true,
        allowDelete: true,
      })
    })

    test('stays closed for a table without a match', async () => {
      mtm.matches.value = [ordersMatch()]
      wrapper = createWrapper()
      await flushPromises()
      wrapper.vm.handleShowComparison('other')
      await flushPromises()
      expect(wrapper.find('[data-testid="data-comparison-dialog"]').exists()).toBe(false)
    })

    test('compares the loaded rows with their pending changes', async () => {
      tableChangesMock.pendingChanges.value = { orders: { '1': { qty: { newValue: 4 } } } }
      tableChangesMock.pendingDeletes.value = { orders: [{ rowId: '2' }] }
      tableChangesMock.pendingCreates.value = { orders: [{ tempId: 'create-7', data: { qty: 7 } }] }
      await openComparison({ instanceData: [{ id: 1, qty: 3 }, { id: 2, qty: 6 }] })
      const source = comparison.comparisonLinesFrom.mock.calls.at(-1)![0]
      expect(source).toMatchObject({
        tableKey: 'orders',
        masterRows: [{ id: 1, qty: 5 }],
        instanceSchemaColumns: ['qty'],
      })
      expect(source.instanceRows).toEqual([
        { id: 1, qty: 4, __pendingEdit: true },
        { id: 2, qty: 6, __pendingDelete: true },
        { id: 'create-7', qty: 7, __pendingCreate: true },
      ])
    })

    test('shows the columns of the instance schema', async () => {
      const dialog = await openComparison(
        {},
        withOrders({
          properties: {
            orders: { type: 'array', items: { properties: { qty: { type: 'integer', title: 'Quantity' }, day: { type: 'string', format: 'date' } } } },
          },
        }),
      )
      expect(dialog.props('columns').map((c: any) => [c.key, c.title, c.type])).toEqual([
        ['qty', 'Quantity', 'number'],
        ['day', 'Day', 'date'],
      ])
    })

    test('without a schema, shows the columns of the compared rows', async () => {
      const dialog = await openComparison()
      expect(dialog.props('columns').map((c: any) => c.key)).toEqual(['qty'])
    })

    test('counts the loaded, master and pending rows', async () => {
      tableChangesMock.getChangesForTable.mockReturnValue({ '1': { qty: {} } })
      tableChangesMock.getPendingCreates.mockReturnValue([{}])
      tableChangesMock.getPendingDeletes.mockReturnValue([{}, {}])
      const dialog = await openComparison({ diffSummary: { totalInstance: 40, totalMaster: 42 } })
      expect(dialog.props()).toMatchObject({ loadedCount: 40, masterCount: 42, pendingCount: 4 })
    })

    test('without a summary, counts the lines', async () => {
      const dialog = await openComparison()
      expect(dialog.props()).toMatchObject({ loadedCount: 3, masterCount: 0, pendingCount: 0 })
    })

    test('restoring a master row edits the loaded row as a pending change', async () => {
      const snackbar = vi.fn()
      comparison.lines = lines
      mtm.matches.value = [ordersMatch()]
      wrapper = createWrapper(withOrders(), { showSnackbar: snackbar })
      await flushPromises()
      await wrapper.find('[data-testid="trigger-show-comparison"]').trigger('click')
      await flushPromises()
      wrapper.findComponent({ name: 'DataComparisonDialog' }).vm.$emit('restore', lines[0])
      await flushPromises()
      expect(tableChangesMock.recordChange).toHaveBeenCalledWith('orders', 1, 'qty', 3, 5, 'qty', 'Orders')
      expect(snackbar).toHaveBeenCalledWith('Row restored', 'info')
    })

    test('restoring a row only in the master adds it as a pending row', async () => {
      const dialog = await openComparison()
      dialog.vm.$emit('restore', lines[1])
      await flushPromises()
      expect(tableChangesMock.recordCreate).toHaveBeenCalledWith('orders', { qty: 9 }, 'Orders')
    })

    test('removing a loaded row deletes it as a pending change', async () => {
      const dialog = await openComparison()
      dialog.vm.$emit('delete', lines[0])
      await flushPromises()
      expect(tableChangesMock.recordDelete).toHaveBeenCalledWith('orders', 1, { id: 1, qty: 3 })
      expect(tableChangesMock.setTableTitle).toHaveBeenCalledWith('orders', 'Orders')
    })

    test('removing a restored row takes it back', async () => {
      const dialog = await openComparison()
      dialog.vm.$emit('delete', lines[2])
      await flushPromises()
      expect(tableChangesMock.revertCreate).toHaveBeenCalledWith('orders', 'create-123')
      expect(tableChangesMock.recordDelete).not.toHaveBeenCalled()
    })
  })

  describe('pending changes', () => {
    test('exposes whether there are pending changes', async () => {
      tableChangesMock.hasChanges.value = true
      wrapper = createWrapper()
      expect(wrapper.vm.hasPendingChanges).toBe(true)
    })

    test('applying them saves them through the view', async () => {
      wrapper = createWrapper()
      expect(await wrapper.vm.applyPendingChanges()).toBe(true)
      expect(view.saveAllChanges).not.toHaveBeenCalled()

      tableChangesMock.hasChanges.value = true
      view.saveAllChanges.mockResolvedValueOnce(false)
      expect(await wrapper.vm.applyPendingChanges()).toBe(false)
      expect(view.saveAllChanges).toHaveBeenCalledTimes(1)
    })

    test('clearing them clears every pending change', () => {
      wrapper = createWrapper()
      wrapper.vm.clearPendingChanges()
      expect(tableChangesMock.clearAllChanges).toHaveBeenCalled()
    })
  })
})
