import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import InputDataView from '@/views/InputDataView.vue'
import { useGeneralStore } from '@/stores/general'

// Mock utils
vi.mock('@/utils/data_io', () => ({
  formatDate: vi.fn((date) => `formatted-${date}`)
}))

// Mock components
vi.mock('@/components/project-execution/ExecutionInfoCard.vue', () => ({
  default: {
    name: 'ExecutionInfoCard',
    template: '<div data-testid="execution-info-card">ExecutionInfoCard</div>',
    props: ['selectedExecution']
  }
}))

vi.mock('@/components/project-execution/ExecutionInfoMenu.vue', () => ({
  default: {
    name: 'ExecutionInfoMenu',
    template: '<div data-testid="execution-info-menu">ExecutionInfoMenu</div>',
    props: ['selectedExecution']
  }
}))

vi.mock('@/components/input-data/InputOutputDataTable.vue', () => ({
  default: {
    name: 'InputDataTable',
    template: '<div data-testid="input-data-table">InputDataTable</div>',
    props: ['execution']
  }
}))

// Mock Mango UI components
vi.mock('mango-ui', () => ({
  MTitleView: {
    name: 'MTitleView',
    template: '<div data-testid="m-title-view"><slot /></div>',
    props: ['icon', 'title', 'description']
  }
}))

const createWrapper = (mockSelectedExecution = null) => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        inputOutputData: {
          inputTitle: 'Input Data'
        }
      }
    }
  })

  // Mock the store
  const generalStore = useGeneralStore()
  generalStore.selectedExecution = mockSelectedExecution
  
  const mockShowSnackbar = vi.fn()

  const wrapper = mount(InputDataView, {
    global: {
      plugins: [vuetify, pinia, i18n],
      provide: {
        showSnackbar: mockShowSnackbar
      },
      stubs: {
        MTitleView: {
          name: 'MTitleView',
          template: '<div data-testid="m-title-view"><slot /></div>',
          props: ['icon', 'title', 'description']
        },
        ExecutionInfoCard: {
          name: 'ExecutionInfoCard',
          template: '<div data-testid="execution-info-card">ExecutionInfoCard</div>',
          props: ['selectedExecution']
        },
        ExecutionInfoMenu: {
          name: 'ExecutionInfoMenu',
          template: '<div data-testid="execution-info-menu">ExecutionInfoMenu</div>',
          props: ['selectedExecution']
        },
        InputDataTable: {
          name: 'InputDataTable',
          template: '<div data-testid="input-data-table">InputDataTable</div>',
          props: ['execution']
        }
      }
    }
  })

  return { wrapper, generalStore, mockShowSnackbar }
}

describe('InputDataView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    test('renders basic structure without selected execution', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.find('.view-container').exists()).toBe(true)
      expect(wrapper.find('[data-testid="m-title-view"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="execution-info-card"]').exists()).toBe(true)
    })

    test('renders ExecutionInfoMenu when execution is selected', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)

      expect(wrapper.find('[data-testid="execution-info-menu"]').exists()).toBe(true)
    })

    test('does not render ExecutionInfoMenu when no execution is selected', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.find('[data-testid="execution-info-menu"]').exists()).toBe(false)
    })

    test('renders InputDataTable when execution has instance', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)

      expect(wrapper.find('[data-testid="input-data-table"]').exists()).toBe(true)
    })

    test('does not render InputDataTable when execution has no instance', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        hasInstance: vi.fn().mockReturnValue(false)
      }
      
      const { wrapper } = createWrapper(mockExecution)

      expect(wrapper.find('[data-testid="input-data-table"]').exists()).toBe(false)
    })

    test('does not render InputDataTable when no execution is selected', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.find('[data-testid="input-data-table"]').exists()).toBe(false)
    })
  })

  describe('Component Props', () => {
    test('passes correct props to MTitleView', () => {
      const { wrapper } = createWrapper()
      const titleView = wrapper.findComponent({ name: 'MTitleView' })

      expect(titleView.props('icon')).toBe('mdi-table-arrow-left')
      expect(titleView.props('title')).toBe('Input Data')
      expect(titleView.props('description')).toBe('')
    })

    test('passes execution name as description when execution is selected', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution Name',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      const titleView = wrapper.findComponent({ name: 'MTitleView' })

      expect(titleView.props('description')).toBe('Test Execution Name')
    })

    test('passes selectedExecution to ExecutionInfoCard', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      const infoCard = wrapper.findComponent({ name: 'ExecutionInfoCard' })

      expect(infoCard.props('selectedExecution')).toEqual(mockExecution)
    })

    test('passes selectedExecution to ExecutionInfoMenu', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      const infoMenu = wrapper.findComponent({ name: 'ExecutionInfoMenu' })

      expect(infoMenu.props('selectedExecution')).toEqual(mockExecution)
    })

    test('passes execution to InputDataTable when conditions are met', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      const dataTable = wrapper.findComponent({ name: 'InputDataTable' })

      expect(dataTable.props('execution')).toEqual(mockExecution)
    })
  })

  describe('Computed Properties', () => {
    test('title computed property returns correct value', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.title).toBe('Input Data')
    })

    test('description computed property returns execution name when execution exists', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution Name',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      
      expect(wrapper.vm.description).toBe('Test Execution Name')
    })

    test('description computed property returns empty string when no execution', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.description).toBe('')
    })

    test('selectedExecution getter returns store value', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper, generalStore } = createWrapper(mockExecution)
      
      expect(wrapper.vm.selectedExecution).toEqual(mockExecution)
      expect(wrapper.vm.selectedExecution).toBe(generalStore.selectedExecution)
    })

    test('selectedExecution setter updates store value', () => {
      const { wrapper, generalStore } = createWrapper()
      
      const newExecution = {
        id: 2,
        name: 'New Execution',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      wrapper.vm.selectedExecution = newExecution
      
      expect(generalStore.selectedExecution).toEqual(newExecution)
    })
  })

  describe('Methods', () => {
    test('formatDate method is available', () => {
      const { wrapper } = createWrapper()
      
      expect(typeof wrapper.vm.formatDate).toBe('function')
    })

    test('formatDate method calls imported formatDate utility', async () => {
      const { wrapper } = createWrapper()
      const { formatDate } = await import('@/utils/data_io')
      
      wrapper.vm.formatDate('2023-01-01')
      
      expect(formatDate).toHaveBeenCalledWith('2023-01-01')
    })
  })

  describe('Lifecycle Methods', () => {
    test('injects showSnackbar on created', () => {
      const { wrapper, mockShowSnackbar } = createWrapper()
      
      expect(wrapper.vm.showSnackbar).toBe(mockShowSnackbar)
    })

    test('initializes generalStore correctly', () => {
      const { wrapper, generalStore } = createWrapper()
      
      expect(wrapper.vm.generalStore).toBe(generalStore)
    })
  })

  describe('Data Properties', () => {
    test('has correct initial data structure', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.generalStore).toBeDefined()
      expect(wrapper.vm.showSnackbar).toBeDefined()
    })
  })

  describe('Component Structure', () => {
    test('has correct CSS classes and structure', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.find('.view-container').exists()).toBe(true)
      expect(wrapper.find('.d-flex.align-end').exists()).toBe(true)
    })

    test('applies correct scoped styles', () => {
      const { wrapper } = createWrapper()
      
      // Check that the component has the style attribute for scoped styles
      expect(wrapper.html()).toContain('data-v-')
    })

    test('applies correct margin top class to InputDataTable', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      const dataTable = wrapper.findComponent({ name: 'InputDataTable' })
      
      expect(dataTable.classes()).toContain('mt-5')
    })
  })

  describe('Edge Cases', () => {
    test('handles null execution gracefully', () => {
      const { wrapper } = createWrapper(null)
      
      expect(() => wrapper.vm.description).not.toThrow()
      expect(wrapper.vm.description).toBe('')
    })

    test('handles execution without name gracefully', () => {
      const mockExecution = {
        id: 1,
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      
      expect(() => wrapper.vm.description).not.toThrow()
      expect(wrapper.vm.description).toBeUndefined()
    })

    test('handles execution with undefined name gracefully', () => {
      const mockExecution = {
        id: 1,
        name: undefined,
        hasInstance: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      
      expect(() => wrapper.vm.description).not.toThrow()
      expect(wrapper.vm.description).toBeUndefined()
    })

    test('handles execution without hasInstance method gracefully', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution'
        // No hasInstance method
      }
      
      // This should throw an error because the template tries to call hasInstance()
      expect(() => createWrapper(mockExecution)).toThrow()
    })
  })

  describe('Conditional Rendering Logic', () => {
    test('InputDataTable visibility depends on execution and hasInstance', () => {
      const conditions = [
        { execution: null, visible: false },
        { execution: { id: 1, hasInstance: vi.fn().mockReturnValue(false) }, visible: false },
        { execution: { id: 1, hasInstance: vi.fn().mockReturnValue(true) }, visible: true }
      ]

      conditions.forEach(({ execution, visible }) => {
        const { wrapper } = createWrapper(execution)
        
        expect(wrapper.find('[data-testid="input-data-table"]').exists()).toBe(visible)
      })
    })

    test('ExecutionInfoMenu visibility depends on execution existence', () => {
      const conditions = [
        { execution: null, visible: false },
        { execution: { id: 1, name: 'Test', hasInstance: vi.fn().mockReturnValue(false) }, visible: true },
        { execution: { id: 1, hasInstance: vi.fn().mockReturnValue(true) }, visible: true }
      ]

      conditions.forEach(({ execution, visible }) => {
        const { wrapper } = createWrapper(execution)
        
        expect(wrapper.find('[data-testid="execution-info-menu"]').exists()).toBe(visible)
      })
    })
  })

  describe('Translation Integration', () => {
    test('uses correct translation key for title', () => {
      const { wrapper } = createWrapper()
      
      // The title should come from the translation
      expect(wrapper.vm.title).toBe('Input Data')
    })
  })
})
