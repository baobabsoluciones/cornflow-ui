import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import DashboardView from '@/views/DashboardView.vue'
import { useGeneralStore } from '@/stores/general'

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

vi.mock('@/app/components/DashboardMain.vue', () => ({
  default: {
    name: 'DashboardMain',
    template: '<div data-testid="dashboard-main">DashboardMain</div>',
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
        dashboard: {
          title: 'Dashboard'
        }
      }
    }
  })

  // Mock the store
  const generalStore = useGeneralStore()
  generalStore.selectedExecution = mockSelectedExecution
  
  const mockShowSnackbar = vi.fn()

  const wrapper = mount(DashboardView, {
    global: {
      plugins: [vuetify, pinia, i18n],
      provide: {
        showSnackbar: mockShowSnackbar
      },
      stubs: {
        'v-app': { template: '<div><slot /></div>' },
        'v-main': { template: '<div><slot /></div>' },
        'v-container': { template: '<div><slot /></div>' },
        'MTitleView': { 
          name: 'MTitleView',
          template: '<div data-testid="m-title-view"></div>',
          props: ['icon', 'title', 'description']
        },
        'ExecutionInfoCard': { 
          name: 'ExecutionInfoCard',
          template: '<div data-testid="execution-info-card"></div>',
          props: ['selectedExecution']
        },
        'ExecutionInfoMenu': { 
          template: '<div data-testid="execution-info-menu"></div>' 
        },
        'DashboardMain': { 
          name: 'DashboardMain',
          template: '<div data-testid="dashboard-main"></div>',
          props: ['execution']
        }
      }
    }
  })

  return { wrapper, generalStore, mockShowSnackbar }
}

describe('DashboardView', () => {
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
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)

      expect(wrapper.find('[data-testid="execution-info-menu"]').exists()).toBe(true)
    })

    test('does not render ExecutionInfoMenu when no execution is selected', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.find('[data-testid="execution-info-menu"]').exists()).toBe(false)
    })

    test('renders DashboardMain when execution has solution and state is 1', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)

      expect(wrapper.find('[data-testid="dashboard-main"]').exists()).toBe(true)
    })

    test('does not render DashboardMain when execution state is not 1', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        state: 0,
        hasSolution: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)

      expect(wrapper.find('[data-testid="dashboard-main"]').exists()).toBe(false)
    })

    test('does not render DashboardMain when execution has no solution', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        state: 1,
        hasSolution: vi.fn().mockReturnValue(false)
      }
      
      const { wrapper } = createWrapper(mockExecution)

      expect(wrapper.find('[data-testid="dashboard-main"]').exists()).toBe(false)
    })
  })

  describe('Component Props', () => {
    test('passes correct props to MTitleView', () => {
      const { wrapper } = createWrapper()
      const titleView = wrapper.findComponent({ name: 'MTitleView' })

      expect(titleView.props('icon')).toBe('mdi-table-arrow-left')
      expect(titleView.props('title')).toBe('Dashboard')
      expect(titleView.props('description')).toBe('')
    })

    test('passes execution name as description when execution is selected', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution Name',
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      const titleView = wrapper.findComponent({ name: 'MTitleView' })

      expect(titleView.props('description')).toBe('Test Execution Name')
    })

    test('passes selectedExecution to ExecutionInfoCard', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      const infoCard = wrapper.findComponent({ name: 'ExecutionInfoCard' })

      expect(infoCard.props('selectedExecution')).toEqual(mockExecution)
    })

    test('passes execution to DashboardMain when conditions are met', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution',
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      const dashboardMain = wrapper.findComponent({ name: 'DashboardMain' })

      expect(dashboardMain.props('execution')).toEqual(mockExecution)
    })
  })

  describe('Computed Properties', () => {
    test('title computed property returns correct value', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.title).toBe('Dashboard')
    })

    test('description computed property returns execution name when execution exists', () => {
      const mockExecution = {
        id: 1,
        name: 'Test Execution Name',
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
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
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
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
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
      }
      
      wrapper.vm.selectedExecution = newExecution
      
      expect(generalStore.selectedExecution).toEqual(newExecution)
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
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      
      expect(() => wrapper.vm.description).not.toThrow()
      expect(wrapper.vm.description).toBe('')
    })

    test('handles execution with undefined name gracefully', () => {
      const mockExecution = {
        id: 1,
        name: undefined,
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
      }
      
      const { wrapper } = createWrapper(mockExecution)
      
      expect(() => wrapper.vm.description).not.toThrow()
      expect(wrapper.vm.description).toBe('')
    })
  })

  describe('Conditional Rendering Logic', () => {
    test('DashboardMain visibility depends on all conditions', () => {
      // Test all conditions must be true
      const conditions = [
        { state: 0, hasSolution: true, visible: false },
        { state: 1, hasSolution: false, visible: false },
        { state: 1, hasSolution: true, visible: true },
        { state: 2, hasSolution: true, visible: false }
      ]

      conditions.forEach(({ state, hasSolution, visible }) => {
        const mockExecution = {
          id: 1,
          name: 'Test Execution',
          state,
          hasSolution: vi.fn().mockReturnValue(hasSolution)
        }
        
        const { wrapper } = createWrapper(mockExecution)
        
        expect(wrapper.find('[data-testid="dashboard-main"]').exists()).toBe(visible)
      })
    })
  })
})
