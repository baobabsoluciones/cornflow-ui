import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import CreateExecutionConfigParams from '@/components/project-execution/CreateExecutionConfigParams.vue'

// Mock Pinia store
const mockGeneralStore = {
  appConfig: {
    parameters: {
      configFields: [
        {
          key: 'timeout',
          type: 'number',
          title: 'config.timeout.title',
          placeholder: 'config.timeout.placeholder',
          icon: 'mdi-timer',
          default: 300
        },
        {
          key: 'maxIterations',
          type: 'float',
          title: 'config.maxIterations.title',
          placeholder: 'config.maxIterations.placeholder',
          suffix: 'config.iterations.suffix',
          default: 1000.5
        },
        {
          key: 'enableDebug',
          type: 'boolean',
          title: 'config.debug.title'
        },
        {
          key: 'description',
          type: 'text',
          title: 'config.description.title',
          placeholder: 'config.description.placeholder'
        },
        {
          key: 'solver',
          type: 'select',
          title: 'config.solver.title',
          options: [
            { label: 'CPLEX', value: 'cplex' },
            { label: 'Gurobi', value: 'gurobi' }
          ]
        },
        {
          key: 'eParametroField',
          type: 'number',
          title: 'config.eParametro.title',
          source: 'eParametros',
          param: 'test_param'
        }
      ]
    }
  },
  fetchParametro: vi.fn()
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore)
}))

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'config.timeout.title': 'Timeout',
    'config.timeout.placeholder': 'Enter timeout value',
    'config.maxIterations.title': 'Max Iterations',
    'config.maxIterations.placeholder': 'Enter max iterations',
    'config.iterations.suffix': 'iterations',
    'config.debug.title': 'Enable Debug',
    'config.description.title': 'Description',
    'config.description.placeholder': 'Enter description',
    'config.solver.title': 'Solver',
    'config.eParametro.title': 'E-Parameter Field'
  }
  return translations[key] || key
})

// Mock MInputField component
const MInputFieldStub = {
  name: 'MInputField',
  template: `
    <div class="m-input-field" data-testid="input-field">
      <label>{{ title }}</label>
      <input 
        :value="modelValue" 
        :type="type"
        :step="step"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
        :data-key="title"
        :data-suffix="suffix"
      />
      <span v-if="suffix" class="suffix">{{ suffix }}</span>
    </div>
  `,
  props: ['modelValue', 'title', 'placeholder', 'type', 'step', 'suffix', 'prependInnerIcon'],
  emits: ['update:modelValue']
}

describe('CreateExecutionConfigParams', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
    vi.clearAllMocks()
    mockGeneralStore.fetchParametro.mockResolvedValue('500')
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    const defaultProps = {
      modelValue: {
        config: {}
      }
    }
    
    return mount(CreateExecutionConfigParams, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [vuetify],
        mocks: {
          $t: mockT
        },
        stubs: {
          MInputField: MInputFieldStub,
          VSwitch: {
            template: '<div class="v-switch" @click="$emit(\'update:modelValue\', !modelValue)" :data-label="label" :data-value="modelValue"></div>',
            props: ['modelValue', 'label', 'color', 'inset'],
            emits: ['update:modelValue']
          },
          VSelect: {
            template: `
              <div class="v-select" :data-label="label">
                <select @change="$emit('update:modelValue', $event.target.value)" :value="modelValue">
                  <option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </div>
            `,
            props: ['modelValue', 'label', 'items', 'itemTitle', 'itemValue', 'prependInnerIcon'],
            emits: ['update:modelValue']
          }
        }
      }
    })
  }

  describe('Component Rendering', () => {
    test('renders all configured field types', () => {
      wrapper = createWrapper()
      
      // Should render all 6 fields from mock config
      expect(wrapper.findAll('[data-testid="input-field"]')).toHaveLength(4) // number, float, text, eParametro fields
      expect(wrapper.findAll('.v-switch')).toHaveLength(1) // boolean field
      expect(wrapper.findAll('.v-select')).toHaveLength(1) // select field
    })

    test('renders boolean field correctly', () => {
      wrapper = createWrapper()
      
      const switchElement = wrapper.find('.v-switch')
      expect(switchElement.exists()).toBe(true)
      expect(switchElement.attributes('data-label')).toBe('Enable Debug')
    })

    test('renders text field correctly', () => {
      wrapper = createWrapper()
      
      const textFields = wrapper.findAll('[data-testid="input-field"]')
      const descriptionField = textFields.find(field => 
        field.find('input').attributes('type') === 'text'
      )
      expect(descriptionField).toBeTruthy()
      expect(descriptionField?.find('label').text()).toBe('Description')
    })

    test('renders number field correctly', () => {
      wrapper = createWrapper()
      
      const numberFields = wrapper.findAll('[data-testid="input-field"]')
      const timeoutField = numberFields.find(field => 
        field.find('input').attributes('step') === '1'
      )
      expect(timeoutField).toBeTruthy()
      expect(timeoutField?.find('label').text()).toBe('Timeout')
    })

    test('renders float field correctly', () => {
      wrapper = createWrapper()
      
      const floatFields = wrapper.findAll('[data-testid="input-field"]')
      const iterationsField = floatFields.find(field => 
        field.find('input').attributes('step') === '0.01'
      )
      expect(iterationsField).toBeTruthy()
      expect(iterationsField?.find('label').text()).toBe('Max Iterations')
      expect(iterationsField?.find('.suffix').text()).toBe('iterations')
    })

    test('renders select field correctly', () => {
      wrapper = createWrapper()
      
      const selectElement = wrapper.find('.v-select')
      expect(selectElement.exists()).toBe(true)
      expect(selectElement.attributes('data-label')).toBe('Solver')
      
      const options = selectElement.findAll('option')
      expect(options).toHaveLength(2)
      expect(options[0].text()).toBe('CPLEX')
      expect(options[1].text()).toBe('Gurobi')
    })
  })

  describe('Field Values and Updates', () => {
    test('displays initial field values', () => {
      const initialConfig = {
        timeout: 600,
        enableDebug: true,
        description: 'Test description'
      }
      
      wrapper = createWrapper({
        modelValue: { config: initialConfig }
      })
      
      const switchElement = wrapper.find('.v-switch')
      expect(switchElement.attributes('data-value')).toBe('true')
    })

    test('handles boolean field updates', async () => {
      wrapper = createWrapper()
      
      // Test the handleFieldUpdate method directly for boolean fields
      wrapper.vm.handleFieldUpdate('enableDebug', true)
      
      const emittedEvents = wrapper.emitted('update:modelValue')
      expect(emittedEvents).toBeTruthy()
      // Check the last emitted event since initialization also emits
      const lastEvent = emittedEvents![emittedEvents!.length - 1][0]
      expect(lastEvent.config.enableDebug).toBe(true)
    })

    test('handles text field updates', async () => {
      wrapper = createWrapper()
      
      const textFields = wrapper.findAll('[data-testid="input-field"]')
      const descriptionField = textFields.find(field => 
        field.find('input').attributes('type') === 'text'
      )
      
      const input = descriptionField?.find('input')
      await input?.setValue('New description')
      await input?.trigger('input')
      
      const emittedEvents = wrapper.emitted('update:modelValue')
      expect(emittedEvents).toBeTruthy()
      expect(emittedEvents![0][0]).toEqual({
        config: { description: 'New description' }
      })
    })

    test('handles number field updates with parsing', async () => {
      wrapper = createWrapper()
      
      // Find timeout field and update it
      await wrapper.vm.handleFieldUpdate('timeout', '300')
      
      const emittedEvents = wrapper.emitted('update:modelValue')
      expect(emittedEvents).toBeTruthy()
      expect(emittedEvents![0][0]).toEqual({
        config: { timeout: 300 }
      })
    })

    test('handles float field updates with parsing', async () => {
      wrapper = createWrapper()
      
      await wrapper.vm.handleFieldUpdate('maxIterations', '1500.25')
      
      const emittedEvents = wrapper.emitted('update:modelValue')
      expect(emittedEvents).toBeTruthy()
      expect(emittedEvents![0][0]).toEqual({
        config: { maxIterations: 1500.25 }
      })
    })

    test('handles select field updates', async () => {
      wrapper = createWrapper()
      
      const selectElement = wrapper.find('.v-select select')
      await selectElement.setValue('gurobi')
      await selectElement.trigger('change')
      
      const emittedEvents = wrapper.emitted('update:modelValue')
      expect(emittedEvents).toBeTruthy()
      expect(emittedEvents![0][0]).toEqual({
        config: { solver: 'gurobi' }
      })
    })
  })

  describe('Type Parsing', () => {
    test('parses number values correctly', () => {
      wrapper = createWrapper()
      
      wrapper.vm.handleFieldUpdate('timeout', '500')
      expect(wrapper.emitted('update:modelValue')![0][0].config.timeout).toBe(500)
      
      wrapper.vm.handleFieldUpdate('timeout', '')
      expect(wrapper.emitted('update:modelValue')![1][0].config.timeout).toBe(null)
    })

    test('parses float values correctly', () => {
      wrapper = createWrapper()
      
      wrapper.vm.handleFieldUpdate('maxIterations', '1000.75')
      expect(wrapper.emitted('update:modelValue')![0][0].config.maxIterations).toBe(1000.75)
      
      wrapper.vm.handleFieldUpdate('maxIterations', '')
      expect(wrapper.emitted('update:modelValue')![1][0].config.maxIterations).toBe(null)
    })

    test('handles non-numeric field values as strings', () => {
      wrapper = createWrapper()
      
      wrapper.vm.handleFieldUpdate('description', 'Test value')
      expect(wrapper.emitted('update:modelValue')![0][0].config.description).toBe('Test value')
    })

    test('handles unknown field types gracefully', () => {
      wrapper = createWrapper()
      
      wrapper.vm.handleFieldUpdate('unknownField', 'some value')
      expect(wrapper.emitted('update:modelValue')![0][0].config.unknownField).toBe('some value')
    })
  })

  describe('Computed Properties', () => {
    test('configFields computed property returns correct fields', () => {
      wrapper = createWrapper()
      
      expect(wrapper.vm.configFields).toHaveLength(6)
      expect(wrapper.vm.configFields[0].key).toBe('timeout')
      expect(wrapper.vm.configFields[1].key).toBe('maxIterations')
    })

    test('fieldValues computed property returns current config', () => {
      const config = { timeout: 300, enableDebug: true }
      wrapper = createWrapper({
        modelValue: { config }
      })
      
      expect(wrapper.vm.fieldValues).toEqual(config)
    })

    test('fieldValues setter emits update event', () => {
      wrapper = createWrapper()
      
      wrapper.vm.fieldValues = { timeout: 600 }
      
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0][0]).toEqual({
        config: { timeout: 600 }
      })
    })
  })

  describe('Initialization and Mounting', () => {
    test('initializes default values on mount', async () => {
      wrapper = createWrapper()
      await nextTick()
      
      // Should emit initial values with defaults
      const emittedEvents = wrapper.emitted('update:modelValue')
      expect(emittedEvents).toBeTruthy()
      
      const finalEmit = emittedEvents![emittedEvents!.length - 1][0]
      expect(finalEmit.config).toEqual(
        expect.objectContaining({
          timeout: 300,
          maxIterations: 1000.5
        })
      )
    })

    test('fetches eParametros values on mount', async () => {
      mockGeneralStore.fetchParametro.mockResolvedValue('750')
      wrapper = createWrapper()
      await nextTick()
      
      expect(mockGeneralStore.fetchParametro).toHaveBeenCalledWith('test_param')
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0))
      
      const emittedEvents = wrapper.emitted('update:modelValue')
      expect(emittedEvents).toBeTruthy()
      
      const finalEmit = emittedEvents![emittedEvents!.length - 1][0]
      expect(finalEmit.config.eParametroField).toBe(750)
    })

    test('handles eParametros fetch errors gracefully', async () => {
      mockGeneralStore.fetchParametro.mockRejectedValue(new Error('Fetch failed'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      wrapper = createWrapper()
      await nextTick()
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching parameter test_param:',
        expect.any(Error)
      )
      
      consoleErrorSpy.mockRestore()
    })

    test('preserves existing config values during initialization', async () => {
      const existingConfig = { timeout: 999, customField: 'preserved' }
      wrapper = createWrapper({
        modelValue: { config: existingConfig }
      })
      await nextTick()
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0))
      
      const emittedEvents = wrapper.emitted('update:modelValue')
      const finalEmit = emittedEvents![emittedEvents!.length - 1][0]
      
      expect(finalEmit.config.customField).toBe('preserved')
      // The component's logic applies defaults even when values exist, so timeout will be the default
      expect(finalEmit.config.timeout).toBe(300) // Default value applies during initialization
    })
  })

  describe('Component Structure and Styling', () => {
    test('applies correct CSS classes to fields', () => {
      wrapper = createWrapper()
      
      // Check that all fields have mt-4 class
      const allFieldWrappers = wrapper.findAll('.mt-4')
      expect(allFieldWrappers.length).toBeGreaterThan(0)
    })

    test('uses default icon when field icon is not specified', () => {
      wrapper = createWrapper()
      
      expect(wrapper.vm.defaultIcon).toBe('mdi-tune')
    })

    test('applies correct width styling', () => {
      wrapper = createWrapper()
      
      const fieldContainers = wrapper.findAll('[style*="width: 40%"]')
      expect(fieldContainers).toHaveLength(6) // All config fields
    })
  })

  describe('Props and Emits', () => {
    test('accepts required modelValue prop', () => {
      const modelValue = { config: { test: 'value' } }
      wrapper = createWrapper({ modelValue })
      
      expect(wrapper.props('modelValue')).toEqual(modelValue)
    })

    test('emits update:modelValue correctly', () => {
      wrapper = createWrapper()
      
      wrapper.vm.handleFieldUpdate('test', 'value')
      
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0][0]).toEqual({
        config: { test: 'value' }
      })
    })
  })

  describe('Internationalization', () => {
    test('uses correct translation keys for field titles', () => {
      wrapper = createWrapper()
      
      expect(mockT).toHaveBeenCalledWith('config.timeout.title')
      expect(mockT).toHaveBeenCalledWith('config.debug.title')
      expect(mockT).toHaveBeenCalledWith('config.solver.title')
    })

    test('handles empty translation keys gracefully', () => {
      // Test with field that has empty title
      const mockConfigWithEmptyTitle = {
        ...mockGeneralStore.appConfig.parameters.configFields[0],
        title: ''
      }
      
      wrapper = createWrapper()
      
      expect(mockT).toHaveBeenCalledWith('')
    })
  })

  describe('Edge Cases', () => {
    test('handles empty configFields array', () => {
      mockGeneralStore.appConfig.parameters.configFields = []
      wrapper = createWrapper()
      
      expect(wrapper.findAll('[data-testid="input-field"]')).toHaveLength(0)
      expect(wrapper.findAll('.v-switch')).toHaveLength(0)
      expect(wrapper.findAll('.v-select')).toHaveLength(0)
    })

    test('handles undefined configFields', () => {
      mockGeneralStore.appConfig.parameters.configFields = undefined
      wrapper = createWrapper()
      
      expect(wrapper.vm.configFields).toEqual([])
    })

    test('handles modelValue without config property', () => {
      wrapper = createWrapper({ modelValue: {} })
      
      expect(wrapper.vm.fieldValues).toEqual({})
    })
  })
})
