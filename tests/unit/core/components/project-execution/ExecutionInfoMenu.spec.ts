import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import ExecutionInfoMenu from '@/components/project-execution/ExecutionInfoMenu.vue'

// Mock formatDate utility
const mockFormatDate = vi.hoisted(() => vi.fn((date) => `formatted-${date}`))
vi.mock('@/utils/data_io', () => ({
  formatDate: mockFormatDate
}))

// Mock Pinia store
const mockGeneralStore = {
  appConfig: {
    parameters: {
      configFields: [
        {
          key: 'iterations',
          title: 'config.iterations',
          icon: 'mdi-repeat',
          type: 'number',
          suffix: 'config.iterations.suffix'
        },
        {
          key: 'timeout',
          title: 'config.timeout',
          icon: 'mdi-clock-outline',
          type: 'number',
          suffix: 'config.seconds'
        },
        {
          key: 'enableFeature',
          title: 'config.feature',
          icon: 'mdi-feature-search',
          type: 'boolean'
        }
      ]
    }
  }
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore)
}))

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'config.iterations': 'Max Iterations',
    'config.iterations.suffix': ' iterations',
    'config.timeout': 'Timeout',
    'config.seconds': ' seconds',
    'config.feature': 'Enable Feature',
    'projectExecution.steps.step5.title': 'Solver',
    'inputOutputData.true': 'True',
    'inputOutputData.false': 'False'
  }
  return translations[key] || key
})

describe('ExecutionInfoMenu', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    return mount(ExecutionInfoMenu, {
      props: {
        selectedExecution: {
          createdAt: '2024-01-15T10:00:00Z',
          description: 'Test execution description',
          config: {
            iterations: 1000,
            timeout: 300,
            enableFeature: true,
            solver: 'CPLEX'
          }
        },
        ...props
      },
      global: {
        plugins: [vuetify],
        mocks: {
          $t: mockT
        },
        stubs: {
          VBtn: {
            template: '<button class="v-btn"><slot /></button>',
            props: ['size', 'flat', 'style']
          },
          VIcon: {
            template: '<i class="v-icon" :data-icon="icon"></i>',
            props: ['icon']
          },
          VMenu: {
            template: '<div class="v-menu"><slot /></div>',
            props: ['activator', 'location', 'transition']
          },
          VList: {
            template: '<ul class="v-list"><slot /></ul>',
            props: ['density', 'min-width', 'rounded', 'slim']
          },
          VListItem: {
            template: '<li class="v-list-item" :data-icon="prependIcon"><slot /></li>',
            props: ['prepend-icon', 'prependIcon']
          },
          VListItemTitle: {
            template: '<div class="v-list-item-title" :class="$attrs.class"><slot /></div>'
          }
        }
      }
    })
  }

  describe('Component Rendering', () => {
    test('renders when selectedExecution is provided', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.v-btn').exists()).toBe(true)
      expect(wrapper.find('.v-icon').exists()).toBe(true)
      expect(wrapper.find('.v-menu').exists()).toBe(true)
    })

    test('does not render when selectedExecution is null', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.find('.v-btn').exists()).toBe(false)
    })

    test('renders correct icon', () => {
      wrapper = createWrapper()
      
      const icon = wrapper.find('.v-icon')
      expect(icon.attributes('data-icon')).toBe('mdi-information-slab-circle-outline')
    })
  })

  describe('Execution Information Display', () => {
    test('displays formatted creation date', () => {
      wrapper = createWrapper()
      
      expect(mockFormatDate).toHaveBeenCalledWith('2024-01-15T10:00:00Z')
      expect(wrapper.text()).toContain('formatted-2024-01-15T10:00:00Z')
    })

    test('displays execution description when not empty', () => {
      wrapper = createWrapper({
        selectedExecution: {
          createdAt: '2024-01-15T10:00:00Z',
          description: 'Test execution description',
          config: { solver: 'CPLEX' }
        }
      })
      
      expect(wrapper.text()).toContain('Test execution description')
    })

    test('does not display description section when description is empty', () => {
      wrapper = createWrapper({
        selectedExecution: {
          createdAt: '2024-01-15T10:00:00Z',
          description: '',
          config: { solver: 'CPLEX' }
        }
      })
      
      const listItems = wrapper.findAll('.v-list-item')
      const descriptionItem = listItems.find(item => 
        item.attributes('data-icon') === 'mdi-text'
      )
      expect(descriptionItem).toBeFalsy()
    })

    test('displays solver information', () => {
      wrapper = createWrapper()
      
      expect(wrapper.text()).toContain('Solver: CPLEX')
    })
  })

  describe('Config Fields Display', () => {
    test('displays numeric config values with suffix', () => {
      wrapper = createWrapper()
      
      expect(wrapper.text()).toContain('Max Iterations: 1000 iterations')
      expect(wrapper.text()).toContain('Timeout: 300 seconds')
    })

    test('displays boolean config values as translated strings', () => {
      wrapper = createWrapper()
      
      expect(wrapper.text()).toContain('Enable Feature: True')
    })

    test('displays boolean false value correctly', () => {
      wrapper = createWrapper({
        selectedExecution: {
          createdAt: '2024-01-15T10:00:00Z',
          description: 'Test',
          config: {
            enableFeature: false,
            solver: 'CPLEX'
          }
        }
      })
      
      expect(wrapper.text()).toContain('Enable Feature: False')
    })

    test('only displays config fields that have values', () => {
      wrapper = createWrapper({
        selectedExecution: {
          createdAt: '2024-01-15T10:00:00Z',
          description: 'Test',
          config: {
            iterations: 1000,
            // timeout is undefined - should not be displayed
            solver: 'CPLEX'
          }
        }
      })
      
      expect(wrapper.text()).toContain('Max Iterations: 1000')
      expect(wrapper.text()).not.toContain('Timeout:')
    })

    test('handles config fields without suffix', () => {
      // Test with existing config field that has no suffix in the original mock
      wrapper = createWrapper({
        selectedExecution: {
          createdAt: '2024-01-15T10:00:00Z',
          description: 'Test',
          config: {
            enableFeature: true, // This field has no suffix in our mock
            solver: 'CPLEX'
          }
        }
      })
      
      // Should display the field without any suffix
      expect(wrapper.text()).toContain('Enable Feature: True')
      // Should not have any suffix text after the value
      expect(wrapper.text()).not.toContain('Enable Feature: True ')
    })
  })

  describe('Computed Properties', () => {
    test('configFields computed property returns store config fields', () => {
      wrapper = createWrapper()
      
      const configFields = wrapper.vm.configFields
      expect(configFields).toEqual(mockGeneralStore.appConfig.parameters.configFields)
      expect(configFields).toHaveLength(3)
      expect(configFields[0].key).toBe('iterations')
      expect(configFields[1].key).toBe('timeout')
      expect(configFields[2].key).toBe('enableFeature')
    })
  })

  describe('Methods', () => {
    test('formatConfigValue returns translated boolean values', () => {
      wrapper = createWrapper()
      
      expect(wrapper.vm.formatConfigValue(true, 'boolean')).toBe('True')
      expect(wrapper.vm.formatConfigValue(false, 'boolean')).toBe('False')
    })

    test('formatConfigValue returns value as-is for non-boolean types', () => {
      wrapper = createWrapper()
      
      expect(wrapper.vm.formatConfigValue(1000, 'number')).toBe(1000)
      expect(wrapper.vm.formatConfigValue('test', 'string')).toBe('test')
      expect(wrapper.vm.formatConfigValue(123, 'other')).toBe(123)
    })

    test('formatDate method is available and callable', () => {
      wrapper = createWrapper()
      
      const result = wrapper.vm.formatDate('2024-01-15T10:00:00Z')
      expect(result).toBe('formatted-2024-01-15T10:00:00Z')
      expect(mockFormatDate).toHaveBeenCalledWith('2024-01-15T10:00:00Z')
    })
  })

  describe('Component Structure', () => {
    test('has correct menu structure', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.v-btn').exists()).toBe(true)
      expect(wrapper.find('.v-menu').exists()).toBe(true)
      expect(wrapper.find('.v-list').exists()).toBe(true)
      expect(wrapper.findAll('.v-list-item').length).toBeGreaterThan(0)
    })

    test('list items have correct icons', () => {
      wrapper = createWrapper()
      
      const listItems = wrapper.findAll('.v-list-item')
      
      // Check for calendar icon (date)
      const dateItem = listItems.find(item => 
        item.attributes('data-icon') === 'mdi-calendar-month-outline'
      )
      expect(dateItem).toBeTruthy()
      
      // Check for text icon (description)
      const descriptionItem = listItems.find(item => 
        item.attributes('data-icon') === 'mdi-text'
      )
      expect(descriptionItem).toBeTruthy()
      
      // Check for wrench icon (solver)
      const solverItem = listItems.find(item => 
        item.attributes('data-icon') === 'mdi-wrench-outline'
      )
      expect(solverItem).toBeTruthy()
    })

    test('small-font class is applied to titles', () => {
      wrapper = createWrapper()
      
      const titles = wrapper.findAll('.v-list-item-title')
      titles.forEach(title => {
        expect(title.classes()).toContain('small-font')
      })
    })
  })

  describe('Props Validation', () => {
    test('accepts valid execution object', () => {
      const execution = {
        createdAt: '2024-01-15T10:00:00Z',
        description: 'Test',
        config: { solver: 'CPLEX' }
      }
      
      wrapper = createWrapper({ selectedExecution: execution })
      expect(wrapper.props('selectedExecution')).toEqual(execution)
    })
  })

  describe('Internationalization', () => {
    test('uses correct translation keys', () => {
      wrapper = createWrapper()
      
      expect(mockT).toHaveBeenCalledWith('config.iterations')
      expect(mockT).toHaveBeenCalledWith('config.iterations.suffix')
      expect(mockT).toHaveBeenCalledWith('config.timeout')
      expect(mockT).toHaveBeenCalledWith('config.seconds')
      expect(mockT).toHaveBeenCalledWith('config.feature')
      expect(mockT).toHaveBeenCalledWith('projectExecution.steps.step5.title')
      expect(mockT).toHaveBeenCalledWith('inputOutputData.true')
    })
  })
})
