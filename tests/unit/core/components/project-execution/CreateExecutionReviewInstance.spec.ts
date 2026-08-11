import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import CreateExecutionReviewInstance from '@cornflow-ui/core/components/project-execution/CreateExecutionReviewInstance.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

// Mock ExecutionDataView component
const ExecutionDataViewStub = {
  name: 'ExecutionDataView',
  template: `
    <div class="execution-data-view" data-testid="execution-data-view">
      <div>Execution: {{ execution ? execution.name : 'None' }}</div>
      <div>Can Check Data: {{ canCheckData }}</div>
      <div>Checks Finished: {{ checksFinished }}</div>
      <div>Checks Error: {{ checksError }}</div>
      <button @click="$emit('save-changes', { updated: true })" data-testid="trigger-save">
        Trigger Save
      </button>
      <button @click="$emit('master-table-action', 'orders', 'use_master')" data-testid="trigger-use-master">
        Use Master
      </button>
      <button @click="$emit('show-comparison', 'orders')" data-testid="trigger-show-comparison">
        Show Comparison
      </button>
      <button @click="$emit('pending-changes-update', true, 3)" data-testid="trigger-pending">
        Pending
      </button>
      <button @click="$emit('master-table-action', 'orders', 'replace_master')" data-testid="trigger-replace-master">
        Replace Master
      </button>
      <button @click="$emit('master-table-action', 'orders', 'keep_uploaded')" data-testid="trigger-keep">
        Keep Uploaded
      </button>
    </div>
  `,
  props: [
    'execution',
    'canCheckData',
    'checksFinished',
    'checksError',
    'masterTableMatches',
    'masterTableLoading',
    'enableExcelMode',
    'externalEtlFlow',
  ],
  emits: [
    'save-changes',
    'master-table-action',
    'show-comparison',
    'pending-changes-update',
  ],
}

// ── Controllable master-table-match composable ──────────────────────────────
const { mtm, tableChangesMock, appConfigMock } = vi.hoisted(() => {
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
    pendingChanges: ref({}),
    pendingCreates: ref({}),
    pendingDeletes: ref({}),
    hasChanges: ref(false),
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
  return { mtm, tableChangesMock, appConfigMock }
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
  // Preserve the real config object (prototype methods like getDashboardRoutes)
  // and only override getCore, delegating to the (mutable) hoisted mock.
  actual.default.getCore = (...args: any[]) => appConfigMock.getCore(...args)
  return actual
})

vi.mock('@cornflow-ui/core/repositories/TableRepository', () => ({
  isForceRetryOfferError: (e: any) => !!e?.__forceRetry,
}))

vi.mock('@cornflow-ui/core/utils/schemaUtils', () => ({
  parameterRowsToParameterObject: (rows: any) => ({ params: rows }),
  buildRowMatchKey: (row: any) => String(row?.id ?? ''),
}))

// Mock CoreDropdownMenu component
vi.mock('@cornflow-ui/core/components/core/CoreDropdownMenu.vue', () => ({
  default: {
    name: 'CoreDropdownMenu',
    template: '<div data-testid="core-dropdown-menu"></div>',
    props: ['items'],
  },
}))

vi.mock('@cornflow-ui/core/components/project-execution/DataComparisonModal.vue', () => ({
  default: {
    name: 'DataComparisonModal',
    template: '<div data-testid="data-comparison-modal"></div>',
    props: [
      'modelValue',
      'tableName',
      'masterTableTitle',
      'instanceData',
      'masterData',
      'diffSummary',
      'masterTableConfig',
      'fullInstanceData',
      'instanceSchemaColumns',
    ],
    emits: ['update:modelValue', 'restore-master-row', 'delete-instance-row'],
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

// Mock useFullscreen composable
vi.mock('@cornflow-ui/core/composables/useFullscreen', () => ({
  useFullscreen: () => ({
    isMaximized: { value: false },
    toggleMaximize: vi.fn(),
  }),
}))

// Mock useExecutionExcel composable
vi.mock('@cornflow-ui/core/composables/project-execution/useExecutionExcel', () => ({
  useExecutionExcel: () => ({
    downloadExcel: vi.fn(),
    handleFileUpload: vi.fn(),
    triggerFileUpload: vi.fn(),
  }),
}))

// Mock Instance model
const { MockInstance } = vi.hoisted(() => {
  const MockInstance = vi.fn(function (
    id,
    data,
    instanceSchema,
    instanceChecksSchema,
    schemaName,
  ) {
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

// Mock config module
vi.mock('@cornflow-ui/core/config', () => ({
  default: {
    schema: 'test-schema',
    initConfig: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('CreateExecutionReviewInstance', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()

    // Reset all mocks
    vi.clearAllMocks()

    // Reset controllable composable state
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
    appConfigMock.getCore = () => ({
      parameters: {
        enableMasterTableMatching: true,
        enableReplaceMasterWithUploaded: true,
      },
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}, provideOverrides: Record<string, any> = {}) => {
    const pinia = createPinia()
    setActivePinia(pinia)

    // Mock the store
    const generalStore = useGeneralStore()
    
    // Set schemaConfig in state (getSchemaConfig getter returns this.schemaConfig)
    generalStore.schemaConfig = {
      instanceSchema: {},
      instanceChecksSchema: {},
    } as any

    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          projectExecution: {
            maximize: 'Maximize',
            minimize: 'Minimize',
            downloadExcel: 'Download Excel',
            uploadExcel: 'Upload Excel',
            steps: {
              step3: {
                loadInstance: {
                  instanceSchemaError: 'Schema validation error',
                  unexpectedError: 'Unexpected error',
                },
              },
              step4: {
                titleContent: 'Review Instance',
              },
            },
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
        plugins: [vuetify, pinia, i18n],
        provide: {
          showSnackbar: vi.fn(),
          ...provideOverrides,
        },
        stubs: {
          ExecutionDataView: ExecutionDataViewStub,
          CoreDropdownMenu: {
            name: 'CoreDropdownMenu',
            template: '<div data-testid="core-dropdown-menu"></div>',
            props: ['items'],
          },
          Teleport: true,
          // Vuetify components
          'v-tabs': { template: '<div><slot /></div>' },
          'v-tab': { template: '<div><slot /></div>' },
          'v-card': { template: '<div><slot /></div>' },
          'v-card-text': { template: '<div><slot /></div>' },
          'v-btn': { template: '<button><slot /></button>' },
          'v-alert': { template: '<div><slot /></div>' },
          'v-progress-circular': { template: '<div><slot /></div>' },
        },
      },
    })
  }

  describe('Component Rendering', () => {
    test('renders the component correctly', () => {
      wrapper = createWrapper()

      expect(wrapper.find('.review-instance-container').exists()).toBe(true)
      expect(wrapper.findComponent(ExecutionDataViewStub).exists()).toBe(true)
    })

    test('applies correct CSS classes', () => {
      wrapper = createWrapper()

      const container = wrapper.find('.review-instance-container')
      expect(container.exists()).toBe(true)
      expect(container.classes()).toContain('review-instance-container')
    })

    test('renders with correct container dimensions', () => {
      wrapper = createWrapper()

      const container = wrapper.find('.review-instance-container')
      const style = container.attributes('style') || ''

      // Check that the component has scoped styles applied (data-v-* attribute)
      expect(wrapper.html()).toContain('data-v-')
      expect(container.classes()).toContain('review-instance-container')
    })
  })

  describe('Props to ExecutionDataView', () => {
    test('passes correct props to ExecutionDataView', () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        instance: { id: 'instance-456', data: {} },
      }
      wrapper = createWrapper({ newExecution: execution })

      const executionDataView = wrapper.findComponent(ExecutionDataViewStub)
      expect(executionDataView.props('execution')).toEqual(execution)
      expect(executionDataView.props('canCheckData')).toBe(false)
      expect(executionDataView.props('checksFinished')).toBe(false)
      expect(executionDataView.props('checksError')).toBe(false)
    })

    test('displays execution name in ExecutionDataView', () => {
      const execution = { id: 'test', name: 'My Test Execution' }
      wrapper = createWrapper({ newExecution: execution })

      expect(wrapper.text()).toContain('Execution: My Test Execution')
    })
  })

  describe('Event Handling', () => {
    test('handles save-changes event from ExecutionDataView', async () => {
      wrapper = createWrapper()

      const executionDataView = wrapper.findComponent(ExecutionDataViewStub)
      const testData = { updated: true, value: 'new data' }

      await executionDataView.vm.$emit('save-changes', testData)
      await flushPromises()

      expect(wrapper.emitted('update:instance')).toBeTruthy()
      // The component emits an Instance object, check that it has the correct data
      const emittedInstance = wrapper.emitted('update:instance')[0][0]
      expect(emittedInstance.data).toEqual(testData)
      expect(emittedInstance.checkSchema).toBeDefined()
    })

    test('handleSaveChanges method works correctly', async () => {
      wrapper = createWrapper()

      const testData = { field1: 'value1', field2: 'value2' }
      await wrapper.vm.handleSaveChanges(testData)
      await flushPromises()

      expect(wrapper.emitted('update:instance')).toBeTruthy()
      // The component emits an Instance object, check that it has the correct data
      const emittedInstance = wrapper.emitted('update:instance')[0][0]
      expect(emittedInstance.data).toEqual(testData)
      expect(emittedInstance.checkSchema).toBeDefined()
    })

    test('handleSaveChanges preserves existing instance data', async () => {
      const originalInstance = {
        id: 'original-id',
        data: { existing: 'data' },
        otherField: 'otherValue',
      }
      const execution = {
        id: 'test',
        name: 'Test Execution',
        instance: originalInstance,
      }

      wrapper = createWrapper({ newExecution: execution })

      const newData = { updated: true }
      await wrapper.vm.handleSaveChanges(newData)
      await flushPromises()

      expect(wrapper.emitted('update:instance')).toBeTruthy()
      // The component emits an Instance object, check that it has the correct data
      const emittedInstance = wrapper.emitted('update:instance')[0][0]
      expect(emittedInstance.data).toEqual(newData)
      expect(emittedInstance.checkSchema).toBeDefined()
    })
  })

  describe('Props Validation', () => {
    test('accepts valid newExecution object', () => {
      const execution = {
        id: 'test-123',
        name: 'Test Execution',
        instance: {
          id: 'instance-789',
          data: { key: 'value' },
        },
      }

      wrapper = createWrapper({ newExecution: execution })
      expect(wrapper.props('newExecution')).toEqual(execution)
    })

    test('validates newExecution prop structure', () => {
      // Test that component handles invalid newExecution gracefully
      const invalidExecution = {
        id: 'test',
        // Missing required fields
      }

      wrapper = createWrapper({ newExecution: invalidExecution })

      // Should render without throwing
      expect(wrapper.find('.review-instance-container').exists()).toBe(true)
      expect(wrapper.vm.newExecution).toEqual(invalidExecution)
    })

    test('handles execution without instance gracefully', async () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        // No instance property
      }

      wrapper = createWrapper({ newExecution: execution })

      const testData = { updated: true }
      await wrapper.vm.handleSaveChanges(testData)
      await flushPromises()

      // Component returns early if no instance, so no event should be emitted
      expect(wrapper.emitted('update:instance')).toBeFalsy()
    })
  })

  describe('Integration Tests', () => {
    test('triggering save from ExecutionDataView updates instance', async () => {
      wrapper = createWrapper()

      const triggerButton = wrapper.find('[data-testid="trigger-save"]')
      await triggerButton.trigger('click')
      await flushPromises()

      expect(wrapper.emitted('update:instance')).toBeTruthy()
      // The component emits an Instance object, check that it has the correct data
      const emittedInstance = wrapper.emitted('update:instance')[0][0]
      expect(emittedInstance.data).toEqual({ updated: true })
      expect(emittedInstance.checkSchema).toBeDefined()
    })

    test('multiple save events work correctly', async () => {
      wrapper = createWrapper()

      const triggerButton = wrapper.find('[data-testid="trigger-save"]')

      // First save
      await triggerButton.trigger('click')
      await flushPromises()
      expect(wrapper.emitted('update:instance')).toHaveLength(1)

      // Second save
      await triggerButton.trigger('click')
      await flushPromises()
      expect(wrapper.emitted('update:instance')).toHaveLength(2)
    })
  })

  describe('Edge Cases', () => {
    test('handles empty instance data', async () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        instance: {
          id: 'instance-id',
          data: {},
        },
      }

      wrapper = createWrapper({ newExecution: execution })

      await wrapper.vm.handleSaveChanges({ newField: 'newValue' })
      await flushPromises()

      expect(wrapper.emitted('update:instance')).toBeTruthy()
      // The component emits an Instance object, check that it has the correct data
      const emittedInstance = wrapper.emitted('update:instance')[0][0]
      expect(emittedInstance.data).toEqual({ newField: 'newValue' })
      expect(emittedInstance.checkSchema).toBeDefined()
    })

    test('handles null instance', async () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        instance: null,
      }

      wrapper = createWrapper({ newExecution: execution })

      await wrapper.vm.handleSaveChanges({ field: 'value' })
      await flushPromises()

      // Component returns early if instance is null, so no event should be emitted
      expect(wrapper.emitted('update:instance')).toBeFalsy()
    })

    test('handles undefined instance', async () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        // instance is undefined
      }

      wrapper = createWrapper({ newExecution: execution })

      await wrapper.vm.handleSaveChanges({ field: 'value' })
      await flushPromises()

      // Component returns early if instance is undefined, so no event should be emitted
      expect(wrapper.emitted('update:instance')).toBeFalsy()
    })
  })

  describe('Master table matching', () => {
    test('clears stale force-retry dialog on mount', () => {
      wrapper = createWrapper()
      expect(mtm.rejectForceRetry).toHaveBeenCalled()
    })

    test('rejects force-retry again when the step becomes active', async () => {
      wrapper = createWrapper({ isStepActive: false })
      mtm.rejectForceRetry.mockClear()
      await wrapper.setProps({ isStepActive: true })
      await flushPromises()
      expect(mtm.rejectForceRetry).toHaveBeenCalled()
    })

    test('runs detection on mount with instance data', () => {
      wrapper = createWrapper()
      expect(mtm.detectMatches).toHaveBeenCalled()
    })

    test('masterTableMatchesWithCanReplace augments matches with replace flags', async () => {
      mtm.matches.value = [
        { tableKey: 'orders', masterTableTitle: 'Orders', masterData: [] },
      ]
      wrapper = createWrapper()
      await flushPromises()
      const list = wrapper.vm.masterTableMatchesWithCanReplace
      expect(list).toHaveLength(1)
      expect(list[0].canReplaceMaster).toBe(true)
      expect(list[0].showReplaceMasterOption).toBe(true)
    })

    test('isMasterTableLoading reflects composable loading', async () => {
      mtm.loading.value = true
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.isMasterTableLoading).toBe(true)
    })
  })

  describe('master-table-action handling', () => {
    test('use_master choice emits update:instance and records the choice', async () => {
      mtm.matches.value = [
        {
          tableKey: 'orders',
          masterTableTitle: 'Orders',
          masterData: [{ id: 1 }],
          storageShape: 'array',
        },
      ]
      wrapper = createWrapper()
      await flushPromises()

      await wrapper
        .find('[data-testid="trigger-use-master"]')
        .trigger('click')
      await flushPromises()

      expect(mtm.setUserChoice).toHaveBeenCalledWith('orders', 'use_master')
      expect(mtm.updateMatchAfterAction).toHaveBeenCalledWith(
        'orders',
        'use_master',
        expect.any(Array),
      )
      expect(wrapper.emitted('update:instance')).toBeTruthy()
    })
  })

  describe('replace_master handling', () => {
    test('replace_master success emits master-tables-updated', async () => {
      mtm.matches.value = [
        { tableKey: 'orders', masterTableTitle: 'Orders', masterData: [] },
      ]
      mtm.applyChoices.mockResolvedValueOnce({
        masterTablesUpdated: ['Orders'],
      })
      wrapper = createWrapper()
      await flushPromises()

      await wrapper.find('[data-testid="trigger-replace-master"]').trigger('click')
      await flushPromises()

      expect(mtm.applyChoices).toHaveBeenCalled()
      expect(wrapper.emitted('master-tables-updated')).toBeTruthy()
      expect(wrapper.emitted('master-tables-updated')![0]).toEqual([['Orders']])
      expect(mtm.updateMatchAfterAction).toHaveBeenCalledWith(
        'orders',
        'replace_master',
      )
    })

    test('replace_master swallows force-retry-offer errors (no crash)', async () => {
      mtm.matches.value = [
        { tableKey: 'orders', masterTableTitle: 'Orders', masterData: [] },
      ]
      mtm.applyChoices.mockRejectedValueOnce({ __forceRetry: true })
      wrapper = createWrapper()
      await flushPromises()

      await wrapper.find('[data-testid="trigger-replace-master"]').trigger('click')
      await flushPromises()

      // No master-tables-updated emitted; handled gracefully
      expect(wrapper.emitted('master-tables-updated')).toBeFalsy()
    })

    test('replace_master surfaces generic errors via snackbar', async () => {
      const snackbar = vi.fn()
      mtm.matches.value = [
        { tableKey: 'orders', masterTableTitle: 'Orders', masterData: [] },
      ]
      mtm.applyChoices.mockRejectedValueOnce(new Error('nope'))
      wrapper = createWrapper({}, { showSnackbar: snackbar })
      await flushPromises()

      await wrapper.find('[data-testid="trigger-replace-master"]').trigger('click')
      await flushPromises()

      expect(snackbar).toHaveBeenCalledWith('nope', 'error')
    })

    test('keep_uploaded only records the choice', async () => {
      mtm.matches.value = [
        { tableKey: 'orders', masterTableTitle: 'Orders', masterData: [] },
      ]
      wrapper = createWrapper()
      await flushPromises()

      await wrapper.find('[data-testid="trigger-keep"]').trigger('click')
      await flushPromises()

      expect(mtm.setUserChoice).toHaveBeenCalledWith('orders', 'keep_uploaded')
      expect(mtm.applyChoices).not.toHaveBeenCalled()
      expect(wrapper.emitted('update:instance')).toBeFalsy()
    })
  })

  describe('force-retry confirm', () => {
    test('renders the force-retry dialog when a valid offer exists', async () => {
      mtm.forceRetryOffer.value = {
        message: 'overwrite?',
        match: { tableKey: 'orders', tableName: 'Orders' },
      }
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[data-testid="force-retry-dialog"]').exists()).toBe(true)
    })

    test('confirm accepts the retry and emits master-tables-updated', async () => {
      const snackbar = vi.fn()
      mtm.forceRetryOffer.value = {
        message: 'overwrite?',
        match: { tableKey: 'orders', tableName: 'Orders' },
      }
      mtm.acceptForceRetry.mockResolvedValueOnce(true)
      wrapper = createWrapper({}, { showSnackbar: snackbar })
      await flushPromises()

      wrapper
        .findComponent({ name: 'ForceRetryConfirmDialog' })
        .vm.$emit('confirm')
      await flushPromises()

      expect(mtm.acceptForceRetry).toHaveBeenCalled()
      expect(wrapper.emitted('master-tables-updated')).toBeTruthy()
      expect(wrapper.emitted('master-tables-updated')![0]).toEqual([['Orders']])
    })

    test('cancel rejects the force-retry', async () => {
      mtm.forceRetryOffer.value = {
        message: 'overwrite?',
        match: { tableKey: 'orders', tableName: 'Orders' },
      }
      wrapper = createWrapper()
      await flushPromises()
      mtm.rejectForceRetry.mockClear()

      wrapper
        .findComponent({ name: 'ForceRetryConfirmDialog' })
        .vm.$emit('cancel')
      await flushPromises()

      expect(mtm.rejectForceRetry).toHaveBeenCalled()
    })
  })

  describe('comparison row restore / delete', () => {
    const openComparison = async (matchOverrides = {}) => {
      mtm.matches.value = [
        {
          tableKey: 'orders',
          masterTableTitle: 'Orders',
          masterData: [{ id: 1, qty: 5 }],
          instanceData: [{ id: 1, qty: 3 }],
          fullInstanceData: [{ id: 1, qty: 3 }],
          ...matchOverrides,
        },
      ]
      wrapper = createWrapper({
        newExecution: {
          id: 'e',
          name: 'E',
          instance: { id: 'i', data: { orders: [{ id: 1, qty: 3 }] } },
        },
      })
      await flushPromises()
      await wrapper.find('[data-testid="trigger-show-comparison"]').trigger('click')
      await flushPromises()
      return wrapper.findComponent({ name: 'DataComparisonModal' })
    }

    test('restore-master-row queues a field edit for an existing row', async () => {
      const modal = await openComparison()
      modal.vm.$emit('restore-master-row', { id: 1, qty: 5 })
      await flushPromises()
      expect(tableChangesMock.recordChange).toHaveBeenCalled()
    })

    test('restore-master-row queues a create for a master-only row', async () => {
      const modal = await openComparison()
      modal.vm.$emit('restore-master-row', { id: 999, qty: 9 })
      await flushPromises()
      expect(tableChangesMock.recordCreate).toHaveBeenCalled()
    })

    test('delete-instance-row records a delete for a persisted row', async () => {
      const modal = await openComparison()
      modal.vm.$emit('delete-instance-row', { id: 1, qty: 3 })
      await flushPromises()
      expect(tableChangesMock.recordDelete).toHaveBeenCalled()
    })

    test('delete-instance-row reverts a pending-create row', async () => {
      const modal = await openComparison()
      modal.vm.$emit('delete-instance-row', { id: 'create-123', qty: 3 })
      await flushPromises()
      expect(tableChangesMock.revertCreate).toHaveBeenCalledWith(
        'orders',
        'create-123',
      )
    })
  })

  describe('show-comparison handling', () => {
    test('opens the comparison modal for a matching table', async () => {
      mtm.matches.value = [
        {
          tableKey: 'orders',
          masterTableTitle: 'Orders',
          masterData: [],
          instanceData: [],
          fullInstanceData: [],
        },
      ]
      wrapper = createWrapper()
      await flushPromises()

      await wrapper
        .find('[data-testid="trigger-show-comparison"]')
        .trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="data-comparison-modal"]').exists()).toBe(true)
    })
  })

  describe('pending changes', () => {
    test('forwards pending-changes-update as has-pending-changes', async () => {
      wrapper = createWrapper()
      await wrapper.find('[data-testid="trigger-pending"]').trigger('click')
      await flushPromises()
      expect(wrapper.emitted('has-pending-changes')).toBeTruthy()
      expect(wrapper.emitted('has-pending-changes')![0]).toEqual([true])
    })

    test('hasPendingChanges mirrors tableChanges.hasChanges', async () => {
      tableChangesMock.hasChanges.value = true
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.hasPendingChanges).toBe(true)
    })
  })

  describe('instance errors alert', () => {
    test('renders the error alert when instanceErrors prop is set', async () => {
      wrapper = createWrapper({ instanceErrors: '<b>Boom</b>' })
      await flushPromises()
      expect(wrapper.html()).toContain('Boom')
    })

    test('watcher updates local errors when the prop changes', async () => {
      wrapper = createWrapper({ instanceErrors: null })
      await wrapper.setProps({ instanceErrors: 'new error' })
      await flushPromises()
      expect(wrapper.html()).toContain('new error')
    })
  })

  describe('feature flag disabled', () => {
    test('returns an empty match list when master matching is disabled', async () => {
      appConfigMock.getCore = () => ({
        parameters: {
          enableMasterTableMatching: false,
          enableReplaceMasterWithUploaded: true,
        },
      })
      mtm.matches.value = [{ tableKey: 'orders', masterTableTitle: 'x', masterData: [] }]
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.masterTableMatchesWithCanReplace).toEqual([])
      // restore for other tests
      appConfigMock.getCore = () => ({
        parameters: {
          enableMasterTableMatching: true,
          enableReplaceMasterWithUploaded: true,
        },
      })
    })
  })
})
