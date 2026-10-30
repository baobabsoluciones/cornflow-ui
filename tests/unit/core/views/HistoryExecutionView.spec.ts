import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import HistoryExecutionView from '@cornflow-ui/core/views/HistoryExecutionView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import appConfig from '@/app/config'

// Mock CoreTitleView component
vi.mock('@cornflow-ui/core/components/core/CoreTitleView.vue', () => ({
  default: {
    name: 'CoreTitleView',
    template: '<div data-testid="core-title-view"><slot /></div>',
    props: ['icon', 'title', 'description', 'dropdownItems'],
  },
}))

// The filter chips and the "Add filter" menu open popovers; here they only show what the view
// hands them and emit what a user would pick.
vi.mock('@cornflow-ui/core/components/core/filters/FilterChip.vue', () => ({
  default: {
    name: 'CoreFilterChip',
    template: '<div class="filter-chip-stub">{{ label }}</div>',
    props: {
      label: String,
      icon: String,
      value: { default: null },
      options: Array,
      allLabel: String,
      showCounts: Boolean,
      removable: Boolean,
      removeLabel: String,
      autoOpen: Boolean,
      keepOpenValue: { default: undefined },
    },
    emits: ['pick', 'remove'],
  },
}))
vi.mock('@cornflow-ui/core/components/core/filters/DateFilterChip.vue', () => ({
  default: {
    name: 'CoreDateFilterChip',
    template: '<div class="date-filter-stub">{{ label }}</div>',
    props: [
      'label',
      'modelValue',
      'presets',
      'from',
      'to',
      'fromLabel',
      'toLabel',
    ],
    emits: ['update:modelValue', 'update:from', 'update:to'],
  },
}))
vi.mock('@cornflow-ui/core/components/core/filters/AddFilterMenu.vue', () => ({
  default: {
    name: 'CoreAddFilterMenu',
    template: '<div class="add-filter-stub">{{ label }}</div>',
    props: ['label', 'searchPlaceholder', 'noMatchesText', 'groups'],
    emits: ['add'],
  },
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
          createNewExecution: 'Create new execution',
          list: {
            emptyTitle: 'No executions in these dates',
            emptyText: 'Executions you create appear here.',
            noResultsTitle: 'No execution matches the filters',
            noResultsText: 'Change the search.',
            limitAction: 'Last 7 days',
          },
          detail: {
            noSelectionTitle: 'No execution selected',
            noSelectionText: 'Select an execution.',
            deleteTitle: 'Delete this execution?',
            deleteMessage: '«{name}» will be removed from the history.',
            downloadExcel: 'Download Excel',
          },
          from: 'From',
          to: 'To',
          today: 'Today',
          yesterday: 'Yesterday',
          last7days: 'Last 7 days',
          lastMonth: 'Last month',
          custom: 'Custom',
          filterAll: 'All',
          filterBar: {
            search: 'Search execution…',
            addFilter: 'Add filter',
            searchField: 'Search field…',
            noFields: 'No field matches',
            clear: 'Clear filters',
            remove: 'Remove filter',
            date: 'Date',
            count: '{n} execution | {n} executions',
            limitNotice: 'Showing the {limit} most recent',
            groups: { execution: 'Execution', solution: 'Solution' },
            fields: {
              state: 'Execution state',
              solutionState: 'Solution state',
              user: 'User',
              solver: 'Solver',
              origin: 'Origin',
            },
            origin: { model: 'Model', replanning: 'Replanning' },
          },
        },
        projectExecution: {
          snackbar: {
            succesSearch: 'Search successful',
            noDataSearch: 'No data found',
            errorSearch: 'Search error',
            successLoad: 'Execution loaded successfully',
            errorLoad: 'Error loading execution',
            successDelete: 'Execution deleted successfully',
            errorDelete: 'Error deleting execution',
          },
        },
      },
    },
  })

  // Mock the store
  const generalStore = useGeneralStore()
  generalStore.fetchExecutionsByDateRange = vi.fn()
  generalStore.fetchLoadedExecution = vi.fn()
  generalStore.deleteExecution = vi.fn()
  generalStore.setSelectedExecution = vi.fn()
  generalStore.loadedExecutions = []

  const mockShowSnackbar = vi.fn()

  const wrapper = mount(HistoryExecutionView, {
    global: {
      plugins: [vuetify, pinia, i18n],
      provide: {
        showSnackbar: mockShowSnackbar,
      },
      stubs: {
        CoreTitleView: {
          name: 'CoreTitleView',
          template: '<div data-testid="core-title-view"></div>',
          props: ['icon', 'title', 'description', 'dropdownItems'],
        },
        teleport: true,
        'v-col': { template: '<div><slot /></div>' },
        'v-text-field': {
          template: '<span class="v-text-field-stub">{{ label }}</span>',
          props: ['label', 'type', 'modelValue'],
          emits: ['update:modelValue'],
        },
        'v-checkbox': {
          template: '<label class="v-checkbox-stub"><slot /></label>',
          props: ['modelValue', 'label', 'color'],
        },
        'v-select': {
          name: 'VSelect',
          template: '<div class="v-select-stub">{{ label }}</div>',
          props: ['modelValue', 'items', 'label'],
          emits: ['update:modelValue'],
        },
      },
    },
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
      expect(wrapper.find('[data-testid="core-title-view"]').exists()).toBe(
        true,
      )
      expect(wrapper.find('.history-list').exists()).toBe(true)
      expect(wrapper.find('[data-testid="history-detail"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="history-search"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="history-summary"]').exists()).toBe(
        true,
      )
    })

    test('hands the date chip its presets and the custom range labels', () => {
      const { wrapper } = createWrapper()
      const dateChip = wrapper.findComponent({ name: 'CoreDateFilterChip' })

      expect(
        dateChip.props('presets').map((preset: any) => preset.value),
      ).toEqual(['today', 'yesterday', 'last7days', 'lastMonth', 'custom'])
      expect(dateChip.props('fromLabel')).toBe('From')
      expect(dateChip.props('toLabel')).toBe('To')
    })
  })

  describe('Component Props', () => {
    test('passes correct props to CoreTitleView', () => {
      const { wrapper } = createWrapper()
      const titleView = wrapper.findComponent({ name: 'CoreTitleView' })

      expect(titleView.props('icon')).toBe('mdi-history')
      expect(titleView.props('title')).toBe('Execution History')
      expect(titleView.props('description')).toBe('View past executions')
    })

    test('shows the no-data message once nothing is loading', async () => {
      const { wrapper, generalStore } = createWrapper()
      generalStore.fetchExecutionsByDateRange.mockResolvedValue([])
      await flushPromises()

      expect(wrapper.find('.history-empty').text()).toContain(
        'No executions in these dates',
      )
    })
  })

  describe('Data Properties', () => {
    test('has correct initial data structure', () => {
      const { wrapper } = createWrapper()

      expect(Array.isArray(wrapper.vm.data)).toBe(true)
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

    test('opens on the last 30 days', async () => {
      const { wrapper } = createWrapper()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.dateOptionSelected).toBe('lastMonth')
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      expect(wrapper.vm.selectedDates.startDate.toDateString()).toBe(
        monthAgo.toDateString(),
      )
    })

    test('calls fetchData on activated', async () => {
      const { wrapper } = createWrapper()
      const fetchDataSpy = vi
        .spyOn(wrapper.vm, 'fetchData')
        .mockImplementation(() => Promise.resolve())

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
          wrapper.vm.selectedDates.endDate,
        )
      })

      test('shows success message and formats data on successful fetch', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        const mockData = [
          { id: 1, name: 'Test', createdAt: '2023-01-01T10:30:00' },
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
        generalStore.fetchExecutionsByDateRange.mockRejectedValue(
          new Error('Network error'),
        )

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
          { id: 3, name: 'Test3', createdAt: '2023-01-02T09:00:00' },
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
          { id: 1, name: 'Test', createdAt: '2023-01-01T09:05:30' },
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
      test('loads the execution and selects it', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchLoadedExecution.mockResolvedValue(true)
        generalStore.loadedExecutions = []

        const execution = { id: 1, name: 'Test Execution' }

        await wrapper.vm.loadExecution(execution)

        expect(generalStore.fetchLoadedExecution).toHaveBeenCalledWith(1)
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(1)
        expect(mockShowSnackbar).toHaveBeenCalledWith(
          'Execution loaded successfully',
        )
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

      test('shows error message on load failure', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchLoadedExecution.mockResolvedValue(false)

        const execution = { id: 1, name: 'Test' }

        await wrapper.vm.loadExecution(execution)

        expect(mockShowSnackbar).toHaveBeenCalledWith(
          'Error loading execution',
          'error',
        )
      })

      test('shows error message on exception', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchLoadedExecution.mockRejectedValue(
          new Error('Network error'),
        )

        const execution = { id: 1, name: 'Test' }

        await wrapper.vm.loadExecution(execution)

        expect(mockShowSnackbar).toHaveBeenCalledWith(
          'Error loading execution',
          'error',
        )
      })
    })

    describe('deleteExecution', () => {
      test('deletes execution successfully and refetches data', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.deleteExecution.mockResolvedValue(true)
        const fetchDataSpy = vi
          .spyOn(wrapper.vm, 'fetchData')
          .mockImplementation(() => Promise.resolve())

        const execution = { id: 1, name: 'Test' }

        await wrapper.vm.deleteExecution(execution)

        expect(generalStore.deleteExecution).toHaveBeenCalledWith(1)
        expect(fetchDataSpy).toHaveBeenCalled()
        expect(mockShowSnackbar).toHaveBeenCalledWith(
          'Execution deleted successfully',
        )
      })

      test('shows error message on delete failure', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.deleteExecution.mockResolvedValue(false)

        const execution = { id: 1, name: 'Test' }

        await wrapper.vm.deleteExecution(execution)

        expect(mockShowSnackbar).toHaveBeenCalledWith(
          'Error deleting execution',
          'error',
        )
      })

      test('shows error message on exception', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.deleteExecution.mockRejectedValue(
          new Error('Network error'),
        )

        const execution = { id: 1, name: 'Test' }

        await wrapper.vm.deleteExecution(execution)

        expect(mockShowSnackbar).toHaveBeenCalledWith(
          'Error deleting execution',
          'error',
        )
      })
    })
  })

  describe('Watchers', () => {
    test('dateOptionSelected watcher sets correct dates for today', async () => {
      const { wrapper } = createWrapper()

      await wrapper.setData({ dateOptionSelected: 'today' })

      const today = new Date()
      expect(wrapper.vm.selectedDates.startDate.toDateString()).toBe(
        today.toDateString(),
      )
      expect(wrapper.vm.selectedDates.endDate.toDateString()).toBe(
        today.toDateString(),
      )
    })

    test('dateOptionSelected watcher sets correct dates for yesterday', async () => {
      const { wrapper } = createWrapper()

      await wrapper.setData({ dateOptionSelected: 'yesterday' })

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(wrapper.vm.selectedDates.startDate.toDateString()).toBe(
        yesterday.toDateString(),
      )
      expect(wrapper.vm.selectedDates.endDate.toDateString()).toBe(
        yesterday.toDateString(),
      )
    })

    test('dateOptionSelected watcher sets correct dates for last7days', async () => {
      const { wrapper } = createWrapper()

      await wrapper.setData({ dateOptionSelected: 'last7days' })

      const today = new Date()
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)

      expect(wrapper.vm.selectedDates.startDate.toDateString()).toBe(
        lastWeek.toDateString(),
      )
      expect(wrapper.vm.selectedDates.endDate.toDateString()).toBe(
        today.toDateString(),
      )
    })

    test('dateOptionSelected watcher sets correct dates for lastMonth', async () => {
      const { wrapper } = createWrapper()

      await wrapper.setData({ dateOptionSelected: 'lastMonth' })

      const today = new Date()
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)

      expect(wrapper.vm.selectedDates.startDate.toDateString()).toBe(
        lastMonth.toDateString(),
      )
      expect(wrapper.vm.selectedDates.endDate.toDateString()).toBe(
        today.toDateString(),
      )
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
          endDate: '2023-01-31',
        },
      })

      // Picked days are read as local midnight, not UTC midnight
      expect(wrapper.vm.selectedDates.startDate).toEqual(new Date(2023, 0, 1))
      expect(wrapper.vm.selectedDates.endDate).toEqual(new Date(2023, 0, 31))
    })

    test('selectedDates watcher calls fetchData', async () => {
      const { wrapper } = createWrapper()
      const fetchDataSpy = vi
        .spyOn(wrapper.vm, 'fetchData')
        .mockImplementation(() => Promise.resolve())

      await wrapper.setData({
        selectedDates: {
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-31'),
        },
      })

      expect(fetchDataSpy).toHaveBeenCalled()
    })
  })

  describe('Executions history filters', () => {
    const PLANT = {
      key: 'plant_id',
      labelKey: 'Plant',
      joinFrom: 'plants.name',
    }
    const PROGRAM = {
      key: 'program_id',
      labelKey: 'Program',
      joinFrom: 'programs.name',
    }
    const plants = [
      { value: 1, title: 'North' },
      { value: 2, title: 'South' },
    ]
    const parameters = appConfig.getCore().parameters as Record<string, unknown>

    const chipOf = (wrapper: any, key: string) =>
      wrapper
        .findAllComponents({ name: 'CoreFilterChip' })
        .find(
          (chip: any) =>
            chip.attributes('data-testid') === `history-filter-${key}`,
        )

    afterEach(() => {
      parameters.executionFilters = []
    })

    test('shows no table filter when the app declares none', () => {
      const { wrapper } = createWrapper()

      expect(chipOf(wrapper, 'plant_id')).toBeUndefined()
    })

    test('offers "All" and the rows of the filter table, and sends the pick to the store', async () => {
      parameters.executionFilters = [PLANT]
      const { wrapper, generalStore } = createWrapper()
      generalStore.executionFilterOptions = { plant_id: plants }
      generalStore.executionFilterValues = { plant_id: null }
      generalStore.setExecutionFilterValue = vi.fn()
      await wrapper.vm.$nextTick()

      const chip = chipOf(wrapper, 'plant_id')
      expect(chip.props('label')).toBe('Plant')
      expect(chip.props('allLabel')).toBe('All')
      expect(chip.props('options')).toEqual(plants)
      expect(chip.props('value')).toBeNull()
      expect(chip.props('removable')).toBeFalsy()

      chip.vm.$emit('pick', 2)
      expect(generalStore.setExecutionFilterValue).toHaveBeenCalledWith(
        'plant_id',
        2,
      )
    })

    test('shows the picked value', async () => {
      parameters.executionFilters = [PLANT]
      const { wrapper, generalStore } = createWrapper()
      generalStore.executionFilterOptions = { plant_id: plants }
      generalStore.executionFilterValues = { plant_id: 2 }
      await wrapper.vm.$nextTick()

      expect(chipOf(wrapper, 'plant_id').props('value')).toBe(2)
    })

    test('hides a filter without options, as when the app has no frontend automation for its table', async () => {
      parameters.executionFilters = [PLANT, PROGRAM]
      const { wrapper, generalStore } = createWrapper()
      generalStore.executionFilterOptions = { plant_id: plants, program_id: [] }
      generalStore.executionFilterValues = { plant_id: null, program_id: null }
      await wrapper.vm.$nextTick()

      expect(chipOf(wrapper, 'plant_id')).toBeDefined()
      expect(chipOf(wrapper, 'program_id')).toBeUndefined()
    })

    test('lists the executions again when the picked filters change', async () => {
      parameters.executionFilters = [PLANT]
      const { wrapper, generalStore } = createWrapper()
      generalStore.executionFilterOptions = { plant_id: plants }
      generalStore.executionFilterValues = { plant_id: null }
      await wrapper.vm.$nextTick()
      const fetchDataSpy = vi
        .spyOn(wrapper.vm, 'fetchData')
        .mockImplementation(() => Promise.resolve())

      generalStore.executionFilterValues = { plant_id: 2 }
      await wrapper.vm.$nextTick()

      expect(fetchDataSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Filters on the loaded list', () => {
    const day = (date: string, rows: any[]) => ({ date, data: rows })
    const rowA = {
      id: 'a',
      name: 'North week 42',
      state: 1,
      config: { solver: 'gurobi' },
    }
    const rowB = {
      id: 'b',
      name: 'South week 42',
      state: 0,
      config: { solver: 'cbc' },
    }
    const rowC = {
      id: 'c',
      name: 'North replanned',
      state: 1,
      config: { solver: 'gurobi', replanning: true },
    }

    /** The history once its first list (the last 30 days) is in, with three executions. */
    const loaded = async () => {
      const result = createWrapper()
      result.generalStore.fetchExecutionsByDateRange.mockResolvedValue([])
      await flushPromises()
      result.wrapper.vm.data = [
        day('2026-10-14', [rowA, rowB]),
        day('2026-10-13', [rowC]),
      ]
      await result.wrapper.vm.$nextTick()
      return result
    }

    const addedChip = (wrapper: any, key: string) =>
      wrapper
        .findAllComponents({ name: 'CoreFilterChip' })
        .find(
          (chip: any) =>
            chip.attributes('data-testid') === `history-filter-${key}`,
        )

    test('the search keeps the executions whose name matches', async () => {
      const { wrapper } = await loaded()

      wrapper.vm.historyFilters.state.search = 'south'
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.filteredData).toEqual([day('2026-10-14', [rowB])])
      expect(wrapper.find('[data-testid="history-summary"]').text()).toContain(
        '1 execution',
      )
    })

    test('offers the filters that can be added, by group', async () => {
      const { wrapper } = await loaded()
      const menu = wrapper.findComponent({ name: 'CoreAddFilterMenu' })

      expect(
        menu
          .props('groups')
          .map((group: any) => [
            group.key,
            group.fields.map((field: any) => field.key),
          ]),
      ).toEqual([
        ['execution', ['state', 'user', 'origin']],
        ['solution', ['solutionState', 'solver']],
      ])
    })

    test('an added filter shows its values with counts and filters the list', async () => {
      const { wrapper } = await loaded()

      wrapper
        .findComponent({ name: 'CoreAddFilterMenu' })
        .vm.$emit('add', 'solver')
      await wrapper.vm.$nextTick()

      const chip = addedChip(wrapper, 'solver')
      expect(chip.props('removable')).toBe(true)
      expect(chip.props('showCounts')).toBe(true)
      expect(chip.props('autoOpen')).toBe(true)
      expect(chip.props('options')).toEqual([
        { value: 'cbc', title: 'cbc', count: 1 },
        { value: 'gurobi', title: 'gurobi', count: 2 },
      ])

      chip.vm.$emit('pick', 'gurobi')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.filteredData).toEqual([
        day('2026-10-14', [rowA]),
        day('2026-10-13', [rowC]),
      ])
    })

    test('the counts of a filter follow the other filters', async () => {
      const { wrapper } = await loaded()
      wrapper.vm.historyFilters.add('solver')
      wrapper.vm.historyFilters.add('origin')
      wrapper.vm.historyFilters.pick('origin', 'model')
      await wrapper.vm.$nextTick()

      expect(addedChip(wrapper, 'solver').props('options')).toEqual([
        { value: 'cbc', title: 'cbc', count: 1 },
        { value: 'gurobi', title: 'gurobi', count: 1 },
      ])
    })

    test('removing an added filter lists every row again', async () => {
      const { wrapper } = await loaded()
      wrapper.vm.historyFilters.add('solver')
      wrapper.vm.historyFilters.pick('solver', 'cbc')
      await wrapper.vm.$nextTick()

      addedChip(wrapper, 'solver').vm.$emit('remove')
      await wrapper.vm.$nextTick()

      expect(addedChip(wrapper, 'solver')).toBeUndefined()
      expect(wrapper.vm.executionCount).toBe(3)
    })

    test('"Clear filters" goes back to how the history opens', async () => {
      const { wrapper, generalStore } = await loaded()
      generalStore.executionFilterValues = { plant_id: 2 }
      generalStore.setExecutionFilterValue = vi.fn()
      wrapper.vm.historyFilters.state.search = 'north'
      wrapper.vm.historyFilters.add('solver')
      wrapper.vm.dateOptionSelected = 'today'
      await wrapper.vm.$nextTick()

      await wrapper
        .find('[data-testid="history-clear-filters"]')
        .trigger('click')

      expect(wrapper.vm.historyFilters.state.search).toBe('')
      expect(wrapper.vm.historyFilters.addedDefinitions).toEqual([])
      expect(wrapper.vm.dateOptionSelected).toBe('lastMonth')
      expect(generalStore.setExecutionFilterValue).toHaveBeenCalledWith(
        'plant_id',
        null,
      )
    })

    test('"Clear filters" is not offered while the history is as it opens', async () => {
      const { wrapper } = await loaded()

      expect(
        wrapper.find('[data-testid="history-clear-filters"]').exists(),
      ).toBe(false)
    })

    test('says when the list came back full', async () => {
      const { wrapper } = await loaded()
      wrapper.vm.selectedDates.startDate = new Date()
      wrapper.vm.data = [
        day(
          '2026-10-14',
          Array.from({ length: 100 }, (_, index) => ({
            ...rowA,
            id: `r${index}`,
          })),
        ),
      ]
      await wrapper.vm.$nextTick()

      const notice = wrapper.findComponent({ name: 'CoreAlert' })
      expect(notice.text()).toContain('Showing the 100 most recent')

      await notice.find('button').trigger('click')
      expect(wrapper.vm.dateOptionSelected).toBe('last7days')
    })

    test('says when no execution passes the filters, and clears them', async () => {
      const { wrapper } = await loaded()
      wrapper.vm.historyFilters.state.search = 'nothing like this'
      await wrapper.vm.$nextTick()

      const empty = wrapper.find('.history-empty')
      expect(empty.text()).toContain('No execution matches the filters')

      await empty.find('button').trigger('click')
      expect(wrapper.vm.historyFilters.state.search).toBe('')
    })
  })

  describe('List and detail', () => {
    const older = {
      id: 'older',
      name: 'Plan week 41',
      state: 1,
      createdAt: '2026-10-13T09:00:00Z',
      config: {},
    }
    const newer = {
      id: 'newer',
      name: 'Plan week 42',
      state: 1,
      createdAt: '2026-10-14T09:00:00Z',
      config: {},
    }

    const loaded = async () => {
      const result = createWrapper()
      result.generalStore.fetchExecutionsByDateRange.mockResolvedValue([
        older,
        newer,
      ])
      await flushPromises()
      return result
    }

    const detail = (wrapper: any) =>
      wrapper.findComponent({ name: 'ExecutionDetailHeader' })

    test('opens on the newest execution', async () => {
      const { wrapper } = await loaded()

      expect(wrapper.vm.selectedExecutionId).toBe('newer')
      expect(detail(wrapper).props('execution').name).toBe('Plan week 42')
    })

    test('picking a row shows its detail', async () => {
      const { wrapper } = await loaded()

      wrapper
        .findComponent({ name: 'ExecutionList' })
        .vm.$emit('select', 'older')
      await wrapper.vm.$nextTick()

      expect(detail(wrapper).props('execution').name).toBe('Plan week 41')
    })

    test('says so when no execution is selected', async () => {
      const { wrapper } = await loaded()
      wrapper.vm.data = []
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="history-detail"]').text()).toContain(
        'No execution selected',
      )
    })

    test('deleting asks first, naming the execution', async () => {
      const { wrapper, generalStore } = await loaded()

      detail(wrapper).vm.$emit('delete')
      await wrapper.vm.$nextTick()

      const dialog = wrapper.findComponent({ name: 'CoreConfirmDialog' })
      expect(dialog.props('modelValue')).toBe(true)
      expect(dialog.props('message')).toContain('Plan week 42')
      expect(generalStore.deleteExecution).not.toHaveBeenCalled()

      dialog.vm.$emit('cancel')
      await wrapper.vm.$nextTick()
      expect(dialog.props('modelValue')).toBe(false)
    })

    test('confirming deletes the execution and lists the rest again', async () => {
      const { wrapper, generalStore } = await loaded()
      generalStore.deleteExecution.mockResolvedValue(true)

      detail(wrapper).vm.$emit('delete')
      await wrapper.vm.$nextTick()
      generalStore.fetchExecutionsByDateRange.mockResolvedValue([older])
      wrapper.findComponent({ name: 'CoreConfirmDialog' }).vm.$emit('confirm')
      await flushPromises()

      expect(generalStore.deleteExecution).toHaveBeenCalledWith('newer')
      expect(wrapper.vm.executionToDelete).toBeNull()
      expect(wrapper.vm.selectedExecutionId).toBe('older')
    })

    test('downloads the Excel of an execution, and says so when it fails', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = await loaded()
      generalStore.getDataToDownload = vi
        .fn()
        .mockRejectedValue(new Error('no file'))

      await wrapper.vm.downloadExcel(newer)

      expect(generalStore.getDataToDownload).toHaveBeenCalledWith(
        'newer',
        true,
        true,
      )
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'inputOutputData.errorDownloadingExcel',
        'error',
      )
      expect(wrapper.vm.downloadingExecutions.has('newer')).toBe(false)
    })
  })

  describe('Component Structure', () => {
    test('has correct CSS classes and structure', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.find('.view-container').exists()).toBe(true)
      expect(wrapper.find('.history-list .history-filters').exists()).toBe(true)
      expect(wrapper.find('.history-list .history-summary').exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    test('handles malformed date strings in formatData', () => {
      const { wrapper } = createWrapper()
      const rawData = [{ id: 1, name: 'Test', createdAt: 'invalid-date' }]

      expect(() => wrapper.vm.formatData(rawData)).not.toThrow()
    })

    test('handles missing createdAt field in formatData', () => {
      const { wrapper } = createWrapper()
      const rawData = [{ id: 1, name: 'Test' }]

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
