import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import HistoryExecutionView from '@/views/HistoryExecutionView.vue'
import { useGeneralStore } from '@/stores/general'

// Mock components
vi.mock('@/components/project-execution/ProjectExecutionsTable.vue', () => ({
  default: {
    name: 'ProjectExecutionsTable',
    template: '<div data-testid="project-executions-table">ProjectExecutionsTable</div>',
    props: ['executionsByDate', 'showFooter', 'showHeaders', 'formatDateByTime', 'useFixedWidth', 'loadingExecutions'],
    emits: ['loadExecution', 'deleteExecution']
  }
}))

// Mock Mango UI components
vi.mock('mango-ui', () => ({
  MTitleView: {
    name: 'MTitleView',
    template: '<div data-testid="m-title-view"><slot /></div>',
    props: ['icon', 'title', 'description']
  },
  MPanelData: {
    name: 'MPanelData',
    template: '<div data-testid="m-panel-data"><slot name="custom-checkbox" /><slot name="table" :itemData="data" :showHeaders="true" /></div>',
    props: ['data', 'checkboxOptions', 'language', 'noDataMessage'],
    emits: ['date-range-changed']
  }
}))

const createWrapper = () => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        versionHistory: {
          title: 'Execution History',
          description: 'View past executions',
          noData: 'No data available',
          from: 'From',
          to: 'To',
          today: 'Today',
          yesterday: 'Yesterday',
          last7days: 'Last 7 days',
          lastMonth: 'Last month',
          custom: 'Custom'
        },
        projectExecution: {
          snackbar: {
            succesSearch: 'Search successful',
            noDataSearch: 'No data found',
            errorSearch: 'Search error',
            successLoad: 'Execution loaded successfully',
            errorLoad: 'Error loading execution',
            successDelete: 'Execution deleted successfully',
            errorDelete: 'Error deleting execution'
          }
        }
      }
    }
  })

  // Mock the store
  const generalStore = useGeneralStore()
  generalStore.fetchExecutionsByDateRange = vi.fn()
  generalStore.fetchLoadedExecution = vi.fn()
  generalStore.deleteExecution = vi.fn()
  generalStore.setSelectedExecution = vi.fn()
  generalStore.loadedExecutions = []
  generalStore.addLoadedExecutionTab = vi.fn()
  generalStore.incrementTabBarKey = vi.fn()
  
  const mockShowSnackbar = vi.fn()

  const wrapper = mount(HistoryExecutionView, {
    global: {
      plugins: [vuetify, pinia, i18n],
      provide: {
        showSnackbar: mockShowSnackbar
      },
      stubs: {
        'MTitleView': { 
          name: 'MTitleView',
          template: '<div data-testid="m-title-view"></div>',
          props: ['icon', 'title', 'description']
        },
        'MPanelData': { 
          name: 'MPanelData',
          template: '<div data-testid="m-panel-data" class="mt-5"><slot>From To</slot></div>',
          props: ['data', 'checkboxOptions', 'language', 'noDataMessage']
        },
        ProjectExecutionsTable: true,
        'v-col': { template: '<div><slot /></div>' },
        'v-text-field': { 
          template: '<input />',
          props: ['label', 'type', 'modelValue'],
          emits: ['update:modelValue']
        }
      }
    }
  })

  return { wrapper, generalStore, mockShowSnackbar }
}

describe('HistoryExecutionView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    test('renders basic structure', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.find('.view-container').exists()).toBe(true)
      expect(wrapper.find('[data-testid="m-title-view"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="m-panel-data"]').exists()).toBe(true)
    })

    test('renders custom date range picker in MPanelData slot', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.text()).toContain('From')
      expect(wrapper.text()).toContain('To')
    })
  })

  describe('Component Props', () => {
    test('passes correct props to MTitleView', () => {
      const { wrapper } = createWrapper()
      const titleView = wrapper.findComponent({ name: 'MTitleView' })

      expect(titleView.props('icon')).toBe('mdi-history')
      expect(titleView.props('title')).toBe('Execution History')
      expect(titleView.props('description')).toBe('View past executions')
    })

    test('passes correct props to MPanelData', () => {
      const { wrapper } = createWrapper()
      const panelData = wrapper.findComponent({ name: 'MPanelData' })

      expect(Array.isArray(panelData.props('data'))).toBe(true)
      expect(Array.isArray(panelData.props('checkboxOptions'))).toBe(true)
      expect(panelData.props('language')).toBe('en')
      expect(panelData.props('noDataMessage')).toBe('No data available')
    })
  })

  describe('Data Properties', () => {
    test('has correct initial data structure', () => {
      const { wrapper } = createWrapper()
      
      expect(Array.isArray(wrapper.vm.data)).toBe(true)
      expect(wrapper.vm.dateOptionSelected).toBeNull()
      expect(wrapper.vm.selectedDates.startDate).toBeNull()
      expect(wrapper.vm.selectedDates.endDate).toBeNull()
      expect(wrapper.vm.customSelectedDates.startDate).toBeNull()
      expect(wrapper.vm.customSelectedDates.endDate).toBeNull()
      expect(wrapper.vm.loadingExecutions instanceof Set).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    test('title computed property returns correct value', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.title).toBe('Execution History')
    })

    test('description computed property returns correct value', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.description).toBe('View past executions')
    })

    test('locale computed property returns current locale', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.locale).toBe('en')
    })

    test('labels computed property returns correct options', () => {
      const { wrapper } = createWrapper()
      
      const labels = wrapper.vm.labels
      expect(labels).toHaveLength(5)
      expect(labels[0].value).toBe('today')
      expect(labels[1].value).toBe('yesterday')
      expect(labels[2].value).toBe('last7days')
      expect(labels[3].value).toBe('lastMonth')
      expect(labels[4].value).toBe('custom')
      expect(labels[4].isCustom).toBe(true)
    })
  })

  describe('Lifecycle Methods', () => {
    test('injects showSnackbar on created', () => {
      const { wrapper, mockShowSnackbar } = createWrapper()
      
      expect(wrapper.vm.showSnackbar).toBe(mockShowSnackbar)
    })

    test('sets dateOptionSelected to null on mounted', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.dateOptionSelected).toBeNull()
    })

    test('calls fetchData on activated', async () => {
      const { wrapper } = createWrapper()
      const fetchDataSpy = vi.spyOn(wrapper.vm, 'fetchData').mockImplementation(() => Promise.resolve())
      
      await wrapper.vm.$options.activated.call(wrapper.vm)
      
      expect(fetchDataSpy).toHaveBeenCalled()
    })
  })

  describe('Methods', () => {
    describe('fetchData', () => {
      test('calls store fetchExecutionsByDateRange with correct parameters', async () => {
        const { wrapper, generalStore } = createWrapper()
        generalStore.fetchExecutionsByDateRange.mockResolvedValue([])
        
        wrapper.vm.selectedDates.startDate = new Date('2023-01-01')
        wrapper.vm.selectedDates.endDate = new Date('2023-01-31')
        
        await wrapper.vm.fetchData()
        
        expect(generalStore.fetchExecutionsByDateRange).toHaveBeenCalledWith(
          wrapper.vm.selectedDates.startDate,
          wrapper.vm.selectedDates.endDate
        )
      })

      test('shows success message and formats data on successful fetch', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        const mockData = [
          { id: 1, name: 'Test', createdAt: '2023-01-01T10:30:00' }
        ]
        generalStore.fetchExecutionsByDateRange.mockResolvedValue(mockData)
        
        await wrapper.vm.fetchData()
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('Search successful')
        expect(wrapper.vm.data).toHaveLength(1)
      })

      test('shows no data message when no results', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchExecutionsByDateRange.mockResolvedValue(null)
        
        await wrapper.vm.fetchData()
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('No data found')
        expect(wrapper.vm.data).toEqual([])
      })

      test('shows error message on exception', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchExecutionsByDateRange.mockRejectedValue(new Error('Network error'))
        
        await wrapper.vm.fetchData()
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('Search error', 'error')
        expect(wrapper.vm.data).toEqual([])
      })
    })

    describe('formatData', () => {
      test('formats raw data correctly', () => {
        const { wrapper } = createWrapper()
        const rawData = [
          { id: 1, name: 'Test1', createdAt: '2023-01-01T10:30:45' },
          { id: 2, name: 'Test2', createdAt: '2023-01-01T14:15:30' },
          { id: 3, name: 'Test3', createdAt: '2023-01-02T09:00:00' }
        ]
        
        const result = wrapper.vm.formatData(rawData)
        
        expect(result).toHaveLength(2) // Two different dates
        expect(result[0].date).toBe('2023-01-01')
        expect(result[0].data).toHaveLength(2)
        expect(result[1].date).toBe('2023-01-02')
        expect(result[1].data).toHaveLength(1)
      })

      test('formats time correctly with padding', () => {
        const { wrapper } = createWrapper()
        const rawData = [
          { id: 1, name: 'Test', createdAt: '2023-01-01T09:05:30' }
        ]
        
        const result = wrapper.vm.formatData(rawData)
        
        expect(result[0].data[0].time).toBe('09:05')
      })

      test('handles empty data gracefully', () => {
        const { wrapper } = createWrapper()
        
        const result = wrapper.vm.formatData([])
        
        expect(result).toEqual([])
      })
    })

    describe('loadExecution', () => {
      test('loads execution successfully and updates state', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchLoadedExecution.mockResolvedValue(true)
        generalStore.loadedExecutions = []
        
        const execution = { id: 1, name: 'Test Execution' }
        
        await wrapper.vm.loadExecution(execution)
        
        expect(generalStore.fetchLoadedExecution).toHaveBeenCalledWith(1)
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(1)
        expect(generalStore.addLoadedExecutionTab).toHaveBeenCalledWith({
          value: 1,
          selected: true,
          name: 'Test Execution'
        })
        expect(mockShowSnackbar).toHaveBeenCalledWith('Execution loaded successfully')
      })

      test('manages loading state correctly', async () => {
        const { wrapper, generalStore } = createWrapper()
        generalStore.fetchLoadedExecution.mockResolvedValue(true)
        
        const execution = { id: 1, name: 'Test' }
        
        const loadPromise = wrapper.vm.loadExecution(execution)
        
        expect(wrapper.vm.loadingExecutions.has(1)).toBe(true)
        
        await loadPromise
        
        expect(wrapper.vm.loadingExecutions.has(1)).toBe(false)
      })

      test('handles existing tab correctly', async () => {
        const { wrapper, generalStore } = createWrapper()
        generalStore.fetchLoadedExecution.mockResolvedValue(true)
        generalStore.loadedExecutions = [
          { executionId: 1, name: 'Existing Tab', state: 1 }
        ]
        
        const execution = { id: 1, name: 'Test Execution' }
        
        await wrapper.vm.loadExecution(execution)
        
        expect(generalStore.addLoadedExecutionTab).not.toHaveBeenCalled()
        expect(generalStore.getLoadedExecutionTabs[0].selected).toBe(true)
      })

      test('shows error message on load failure', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchLoadedExecution.mockResolvedValue(false)
        
        const execution = { id: 1, name: 'Test' }
        
        await wrapper.vm.loadExecution(execution)
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('Error loading execution', 'error')
      })

      test('shows error message on exception', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchLoadedExecution.mockRejectedValue(new Error('Network error'))
        
        const execution = { id: 1, name: 'Test' }
        
        await wrapper.vm.loadExecution(execution)
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('Error loading execution', 'error')
      })

      test('handles execution without name gracefully', async () => {
        const { wrapper, generalStore } = createWrapper()
        generalStore.fetchLoadedExecution.mockResolvedValue(true)
        generalStore.loadedExecutions = []
        
        const execution = { id: 1 }
        
        await wrapper.vm.loadExecution(execution)
        
        expect(generalStore.addLoadedExecutionTab).toHaveBeenCalledWith({
          value: 1,
          selected: true,
          name: 'Execution 1'
        })
      })
    })

    describe('deleteExecution', () => {
      test('deletes execution successfully and refetches data', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.deleteExecution.mockResolvedValue(true)
        const fetchDataSpy = vi.spyOn(wrapper.vm, 'fetchData').mockImplementation(() => Promise.resolve())
        
        const execution = { id: 1, name: 'Test' }
        
        await wrapper.vm.deleteExecution(execution)
        
        expect(generalStore.deleteExecution).toHaveBeenCalledWith(1)
        expect(fetchDataSpy).toHaveBeenCalled()
        expect(mockShowSnackbar).toHaveBeenCalledWith('Execution deleted successfully')
      })

      test('shows error message on delete failure', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.deleteExecution.mockResolvedValue(false)
        
        const execution = { id: 1, name: 'Test' }
        
        await wrapper.vm.deleteExecution(execution)
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('Error deleting execution', 'error')
      })

      test('shows error message on exception', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.deleteExecution.mockRejectedValue(new Error('Network error'))
        
        const execution = { id: 1, name: 'Test' }
        
        await wrapper.vm.deleteExecution(execution)
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('Error deleting execution', 'error')
      })
    })
  })

  describe('Watchers', () => {
    test('dateOptionSelected watcher sets correct dates for today', async () => {
      const { wrapper } = createWrapper()
      
      await wrapper.setData({ dateOptionSelected: 'today' })
      
      const today = new Date()
      expect(wrapper.vm.selectedDates.startDate.toDateString()).toBe(today.toDateString())
      expect(wrapper.vm.selectedDates.endDate.toDateString()).toBe(today.toDateString())
    })

    test('dateOptionSelected watcher sets correct dates for yesterday', async () => {
      const { wrapper } = createWrapper()
      
      await wrapper.setData({ dateOptionSelected: 'yesterday' })
      
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(wrapper.vm.selectedDates.startDate.toDateString()).toBe(yesterday.toDateString())
      expect(wrapper.vm.selectedDates.endDate.toDateString()).toBe(yesterday.toDateString())
    })

    test('dateOptionSelected watcher sets correct dates for last7days', async () => {
      const { wrapper } = createWrapper()
      
      await wrapper.setData({ dateOptionSelected: 'last7days' })
      
      const today = new Date()
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      
      expect(wrapper.vm.selectedDates.startDate.toDateString()).toBe(lastWeek.toDateString())
      expect(wrapper.vm.selectedDates.endDate.toDateString()).toBe(today.toDateString())
    })

    test('dateOptionSelected watcher sets correct dates for lastMonth', async () => {
      const { wrapper } = createWrapper()
      
      await wrapper.setData({ dateOptionSelected: 'lastMonth' })
      
      const today = new Date()
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      
      expect(wrapper.vm.selectedDates.startDate.toDateString()).toBe(lastMonth.toDateString())
      expect(wrapper.vm.selectedDates.endDate.toDateString()).toBe(today.toDateString())
    })

    test('dateOptionSelected watcher clears dates for custom', async () => {
      const { wrapper } = createWrapper()
      
      await wrapper.setData({ dateOptionSelected: 'custom' })
      
      expect(wrapper.vm.selectedDates.startDate).toBeNull()
      expect(wrapper.vm.selectedDates.endDate).toBeNull()
    })

    test('customSelectedDates watcher updates selectedDates when custom is selected', async () => {
      const { wrapper } = createWrapper()
      
      await wrapper.setData({ dateOptionSelected: 'custom' })
      await wrapper.setData({ 
        customSelectedDates: { 
          startDate: '2023-01-01', 
          endDate: '2023-01-31' 
        } 
      })
      
      expect(wrapper.vm.selectedDates.startDate).toEqual(new Date('2023-01-01'))
      expect(wrapper.vm.selectedDates.endDate).toEqual(new Date('2023-01-31'))
    })

    test('selectedDates watcher calls fetchData', async () => {
      const { wrapper } = createWrapper()
      const fetchDataSpy = vi.spyOn(wrapper.vm, 'fetchData').mockImplementation(() => Promise.resolve())
      
      await wrapper.setData({ 
        selectedDates: { 
          startDate: new Date('2023-01-01'), 
          endDate: new Date('2023-01-31') 
        } 
      })
      
      expect(fetchDataSpy).toHaveBeenCalled()
    })
  })

  describe('Component Structure', () => {
    test('has correct CSS classes and structure', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.find('.view-container').exists()).toBe(true)
      const panelData = wrapper.find('[data-testid="m-panel-data"]')
      expect(panelData.exists()).toBe(true)
      expect(panelData.classes()).toContain('mt-5')
    })
  })

  describe('Edge Cases', () => {
    test('handles malformed date strings in formatData', () => {
      const { wrapper } = createWrapper()
      const rawData = [
        { id: 1, name: 'Test', createdAt: 'invalid-date' }
      ]
      
      expect(() => wrapper.vm.formatData(rawData)).not.toThrow()
    })

    test('handles missing createdAt field in formatData', () => {
      const { wrapper } = createWrapper()
      const rawData = [
        { id: 1, name: 'Test' }
      ]
      
      expect(() => wrapper.vm.formatData(rawData)).not.toThrow()
    })

    test('handles Set operations with loading executions', async () => {
      const { wrapper, generalStore } = createWrapper()
      generalStore.fetchLoadedExecution.mockResolvedValue(true)
      
      const execution = { id: 1, name: 'Test' }
      
      // Load multiple times to test Set behavior
      const promise1 = wrapper.vm.loadExecution(execution)
      const promise2 = wrapper.vm.loadExecution({ id: 2, name: 'Test2' })
      
      await Promise.all([promise1, promise2])
      
      expect(wrapper.vm.loadingExecutions.size).toBe(0)
    })
  })
})
