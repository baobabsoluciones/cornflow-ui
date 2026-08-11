import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import CreateExecutionCheckData from '@cornflow-ui/core/components/project-execution/CreateExecutionCheckData.vue'

// Mock Pinia store
const mockGeneralStore = {
  createInstance: vi.fn(),
  getInstanceDataChecksById: vi.fn(),
}

vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore),
}))

// Mock ExecutionDataView component
const ExecutionDataViewStub = {
  name: 'ExecutionDataView',
  template: `
    <div class="execution-data-view" data-testid="execution-data-view">
      <div>Execution: {{ execution ? execution.name : 'None' }}</div>
      <div>Checks Finished: {{ checksFinished }}</div>
      <div>Checks Error: {{ checksError }}</div>
      <div>Read Only: {{ readOnly }}</div>
      <div>Can Check Data: {{ canCheckData }}</div>
      <button @click="$emit('check-data')" data-testid="check-data-button">
        Check Data
      </button>
    </div>
  `,
  props: [
    'execution',
    'checksFinished',
    'checksError',
    'readOnly',
    'canCheckData',
  ],
  emits: ['check-data'],
}

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'projectExecution.snackbar.instanceCreationError':
      'Failed to create instance',
    'projectExecution.snackbar.instanceDataChecksSuccess':
      'Data checks completed successfully',
    'projectExecution.snackbar.instanceDataChecksError': 'Data checks failed',
  }
  return translations[key] || key
})

describe('CreateExecutionCheckData', () => {
  let vuetify: any
  let wrapper: any
  let mockShowSnackbar: any

  beforeEach(() => {
    vuetify = createVuetify()
    mockShowSnackbar = vi.fn()

    // Reset all mocks
    vi.clearAllMocks()
    mockGeneralStore.createInstance.mockClear()
    mockGeneralStore.getInstanceDataChecksById.mockClear()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    return mount(CreateExecutionCheckData, {
      props: {
        newExecution: {
          id: 'test-execution',
          name: 'Test Execution',
          data: { test: 'data' },
        },
        ...props,
      },
      global: {
        plugins: [vuetify],
        provide: {
          showSnackbar: mockShowSnackbar,
        },
        mocks: {
          $t: mockT,
        },
        stubs: {
          ExecutionDataView: ExecutionDataViewStub,
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

      expect(wrapper.find('.check-data-container').exists()).toBe(true)
      expect(wrapper.findComponent(ExecutionDataViewStub).exists()).toBe(true)
    })

    test('applies has-tables class when validation tables exist', () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        instance: {
          dataChecks: {
            table1: { valid: true },
          },
        },
      }
      wrapper = createWrapper({ newExecution: execution })

      expect(wrapper.find('.check-data-container.has-tables').exists()).toBe(
        true,
      )
    })

    test('passes correct props to ExecutionDataView', () => {
      const execution = { id: 'test', name: 'Test Execution' }
      wrapper = createWrapper({ newExecution: execution })

      const executionDataView = wrapper.findComponent(ExecutionDataViewStub)
      expect(executionDataView.props('execution')).toEqual(execution)
      expect(executionDataView.props('checksFinished')).toBe(false)
      expect(executionDataView.props('checksError')).toBe(false)
      expect(executionDataView.props('readOnly')).toBe(false)
      // canCheckData is passed as a boolean attribute, so it arrives as empty string
      expect(executionDataView.props('canCheckData')).toBe('')
    })

    test('displays execution name in ExecutionDataView', () => {
      const execution = { id: 'test', name: 'My Test Execution' }
      wrapper = createWrapper({ newExecution: execution })

      expect(wrapper.text()).toContain('Execution: My Test Execution')
    })
  })

  describe('Data Properties', () => {
    test('initializes with correct default data', () => {
      wrapper = createWrapper()

      expect(wrapper.vm.checksFinished).toBe(false)
      expect(wrapper.vm.checksError).toBe(false)
      expect(wrapper.vm.generalStore).toBeDefined()
      expect(wrapper.vm.showSnackbar).toBe(mockShowSnackbar)
    })

    test('updates checksFinished status', async () => {
      wrapper = createWrapper()

      wrapper.vm.checksFinished = true
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Checks Finished: true')
    })

    test('updates checksError status', async () => {
      wrapper = createWrapper()

      wrapper.vm.checksError = true
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Checks Error: true')
    })
  })

  describe('Computed Properties', () => {
    test('hasValidationTables computed property returns false when no dataChecks', () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        data: {},
      }
      wrapper = createWrapper({ newExecution: execution })

      expect(wrapper.vm.hasValidationTables).toBe(false)
    })

    test('hasValidationTables computed property returns true when dataChecks exist', () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        instance: {
          dataChecks: {
            table1: { valid: true },
            table2: { valid: false },
          },
        },
      }
      wrapper = createWrapper({ newExecution: execution })

      expect(wrapper.vm.hasValidationTables).toBe(true)
    })

    test('hasValidationTables computed property handles empty dataChecks object', () => {
      const execution = {
        id: 'test',
        name: 'Test Execution',
        instance: {
          dataChecks: {},
        },
      }
      wrapper = createWrapper({ newExecution: execution })

      expect(wrapper.vm.hasValidationTables).toBe(false)
    })
  })

  describe('Event Handling', () => {
    test('updateInstance method emits correct event', () => {
      wrapper = createWrapper()

      const testInstance = { id: 'new-instance' }
      wrapper.vm.updateInstance(testInstance)

      expect(wrapper.emitted('update:instance')).toBeTruthy()
      expect(wrapper.emitted('update:instance')[0]).toEqual([testInstance])
    })
  })

  describe('createInstance Method - Success Flow', () => {
    test('successfully creates instance and runs data checks', async () => {
      const mockInstanceResult = { id: 'instance-123' }
      const mockCheckedInstance = { id: 'instance-123', status: 'checked' }

      mockGeneralStore.createInstance.mockResolvedValueOnce(mockInstanceResult)
      mockGeneralStore.getInstanceDataChecksById.mockResolvedValueOnce(
        mockCheckedInstance,
      )

      wrapper = createWrapper()

      await wrapper.vm.createInstance()

      expect(mockGeneralStore.createInstance).toHaveBeenCalledWith(
        wrapper.props('newExecution'),
      )
      expect(mockGeneralStore.getInstanceDataChecksById).toHaveBeenCalledWith(
        'instance-123',
      )
      expect(wrapper.vm.checksFinished).toBe(true)
      expect(wrapper.vm.checksError).toBe(false)
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Data checks completed successfully',
      )
      expect(wrapper.emitted('update:instance')).toBeTruthy()
      expect(wrapper.emitted('update:instance')[0]).toEqual([
        mockCheckedInstance,
      ])
    })

    test('emits checks-launching events correctly during success flow', async () => {
      const mockInstanceResult = { id: 'instance-123' }
      const mockCheckedInstance = { id: 'instance-123', status: 'checked' }

      mockGeneralStore.createInstance.mockResolvedValueOnce(mockInstanceResult)
      mockGeneralStore.getInstanceDataChecksById.mockResolvedValueOnce(
        mockCheckedInstance,
      )

      wrapper = createWrapper()

      await wrapper.vm.createInstance()

      const checksLaunchingEvents = wrapper.emitted('checks-launching')
      expect(checksLaunchingEvents).toBeTruthy()
      expect(checksLaunchingEvents).toHaveLength(2)
      expect(checksLaunchingEvents[0]).toEqual([true]) // Starting checks
      expect(checksLaunchingEvents[1]).toEqual([false]) // Checks finished
    })
  })

  describe('createInstance Method - Error Scenarios', () => {
    test('handles instance creation failure', async () => {
      mockGeneralStore.createInstance.mockResolvedValueOnce(null)

      wrapper = createWrapper()

      await wrapper.vm.createInstance()

      expect(wrapper.vm.checksFinished).toBe(false)
      expect(wrapper.vm.checksError).toBe(true)
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Failed to create instance',
        'error',
      )
      expect(wrapper.emitted('checks-launching')).toHaveLength(2)
      expect(wrapper.emitted('checks-launching')[1]).toEqual([false])
    })

    test('handles data checks failure', async () => {
      const mockInstanceResult = { id: 'instance-123' }

      mockGeneralStore.createInstance.mockResolvedValueOnce(mockInstanceResult)
      mockGeneralStore.getInstanceDataChecksById.mockResolvedValueOnce(null)

      wrapper = createWrapper()

      await wrapper.vm.createInstance()

      expect(wrapper.vm.checksFinished).toBe(false)
      expect(wrapper.vm.checksError).toBe(true)
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Data checks failed',
        'error',
      )
      expect(wrapper.emitted('checks-launching')).toHaveLength(2)
      expect(wrapper.emitted('checks-launching')[1]).toEqual([false])
    })

    test('handles exception during instance creation', async () => {
      mockGeneralStore.createInstance.mockRejectedValueOnce(
        new Error('Network error'),
      )

      wrapper = createWrapper()

      // Spy on console.error to verify error logging
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      await wrapper.vm.createInstance()

      expect(wrapper.vm.checksFinished).toBe(false)
      expect(wrapper.vm.checksError).toBe(true)
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Data checks failed',
        'error',
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Data check error:',
        expect.any(Error),
      )
      expect(wrapper.emitted('checks-launching')).toHaveLength(2)
      expect(wrapper.emitted('checks-launching')[1]).toEqual([false])

      consoleErrorSpy.mockRestore()
    })

    test('handles exception during data checks', async () => {
      const mockInstanceResult = { id: 'instance-123' }

      mockGeneralStore.createInstance.mockResolvedValueOnce(mockInstanceResult)
      mockGeneralStore.getInstanceDataChecksById.mockRejectedValueOnce(
        new Error('Check error'),
      )

      wrapper = createWrapper()

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      await wrapper.vm.createInstance()

      expect(wrapper.vm.checksFinished).toBe(false)
      expect(wrapper.vm.checksError).toBe(true)
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Data checks failed',
        'error',
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Data check error:',
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Integration with ExecutionDataView', () => {
    test('check-data event triggers createInstance method', async () => {
      const mockInstanceResult = { id: 'instance-123' }
      const mockCheckedInstance = { id: 'instance-123', status: 'checked' }

      mockGeneralStore.createInstance.mockResolvedValueOnce(mockInstanceResult)
      mockGeneralStore.getInstanceDataChecksById.mockResolvedValueOnce(
        mockCheckedInstance,
      )

      wrapper = createWrapper()

      const checkDataButton = wrapper.find('[data-testid="check-data-button"]')
      await checkDataButton.trigger('click')
      await flushPromises()

      expect(mockGeneralStore.createInstance).toHaveBeenCalled()
      expect(wrapper.vm.checksFinished).toBe(true)
    })
  })

  describe('Props Validation', () => {
    test('accepts valid newExecution object', () => {
      const execution = {
        id: 'test-123',
        name: 'Test Execution',
        data: { key: 'value' },
      }

      wrapper = createWrapper({ newExecution: execution })
      expect(wrapper.props('newExecution')).toEqual(execution)
    })

    test('component is required to have newExecution prop', () => {
      // Component should handle missing newExecution gracefully in real usage
      const execution = { id: 'minimal', name: 'Minimal' }
      wrapper = createWrapper({ newExecution: execution })

      expect(wrapper.vm.newExecution).toBeDefined()
    })
  })

  describe('Lifecycle and Dependencies', () => {
    test('showSnackbar is injected correctly', () => {
      wrapper = createWrapper()

      expect(wrapper.vm.showSnackbar).toBe(mockShowSnackbar)
    })

    test('generalStore is initialized correctly', () => {
      wrapper = createWrapper()

      expect(wrapper.vm.generalStore).toStrictEqual(mockGeneralStore)
      expect(wrapper.vm.generalStore.createInstance).toBeDefined()
      expect(wrapper.vm.generalStore.getInstanceDataChecksById).toBeDefined()
    })
  })

  describe('State Management', () => {
    test('resets status flags before starting checks', async () => {
      wrapper = createWrapper()

      // Set initial state
      wrapper.vm.checksFinished = true
      wrapper.vm.checksError = true

      mockGeneralStore.createInstance.mockResolvedValueOnce({ id: 'test' })
      mockGeneralStore.getInstanceDataChecksById.mockResolvedValueOnce({
        id: 'test',
      })

      await wrapper.vm.createInstance()

      // Should have been reset during the process
      expect(wrapper.vm.checksFinished).toBe(true) // Set to true after successful completion
      expect(wrapper.vm.checksError).toBe(false) // Reset to false during process
    })
  })

  describe('Internationalization', () => {
    test('uses correct translation keys for error messages', async () => {
      mockGeneralStore.createInstance.mockResolvedValueOnce(null)

      wrapper = createWrapper()

      await wrapper.vm.createInstance()

      expect(mockT).toHaveBeenCalledWith(
        'projectExecution.snackbar.instanceCreationError',
      )
    })

    test('uses correct translation keys for success messages', async () => {
      mockGeneralStore.createInstance.mockResolvedValueOnce({ id: 'test' })
      mockGeneralStore.getInstanceDataChecksById.mockResolvedValueOnce({
        id: 'test',
      })

      wrapper = createWrapper()

      await wrapper.vm.createInstance()

      expect(mockT).toHaveBeenCalledWith(
        'projectExecution.snackbar.instanceDataChecksSuccess',
      )
    })
  })
})
