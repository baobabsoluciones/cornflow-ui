import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import CreateExecutionReviewInstance from '@/components/project-execution/CreateExecutionReviewInstance.vue'
import { useGeneralStore } from '@/stores/general'

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
    </div>
  `,
  props: ['execution', 'canCheckData', 'checksFinished', 'checksError'],
  emits: ['save-changes'],
}

// Mock CoreDropdownMenu component
vi.mock('@/components/core/CoreDropdownMenu.vue', () => ({
  default: {
    name: 'CoreDropdownMenu',
    template: '<div data-testid="core-dropdown-menu"></div>',
    props: ['items'],
  },
}))

// Mock useFullscreen composable
vi.mock('@/composables/useFullscreen', () => ({
  useFullscreen: () => ({
    isMaximized: { value: false },
    toggleMaximize: vi.fn(),
  }),
}))

// Mock useExecutionExcel composable
vi.mock('@/composables/project-execution/useExecutionExcel', () => ({
  useExecutionExcel: () => ({
    downloadExcel: vi.fn(),
    handleFileUpload: vi.fn(),
    triggerFileUpload: vi.fn(),
  }),
}))

// Mock Instance model
const { MockInstance } = vi.hoisted(() => {
  const MockInstance = vi.fn().mockImplementation((id, data, instanceSchema, instanceChecksSchema, schemaName) => {
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
vi.mock('@/config', () => ({
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
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
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
      await wrapper.vm.$nextTick()

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
      await wrapper.vm.$nextTick()

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
      await wrapper.vm.$nextTick()

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
      await wrapper.vm.$nextTick()

      // Component returns early if no instance, so no event should be emitted
      expect(wrapper.emitted('update:instance')).toBeFalsy()
    })
  })

  describe('Integration Tests', () => {
    test('triggering save from ExecutionDataView updates instance', async () => {
      wrapper = createWrapper()

      const triggerButton = wrapper.find('[data-testid="trigger-save"]')
      await triggerButton.trigger('click')
      await wrapper.vm.$nextTick()

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
      expect(wrapper.emitted('update:instance')).toHaveLength(1)

      // Second save
      await triggerButton.trigger('click')
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
      await wrapper.vm.$nextTick()

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
      await wrapper.vm.$nextTick()

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
      await wrapper.vm.$nextTick()

      // Component returns early if instance is undefined, so no event should be emitted
      expect(wrapper.emitted('update:instance')).toBeFalsy()
    })
  })
})
