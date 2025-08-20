import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import ProjectExecutionView from '@/views/ProjectExecutionView.vue'
import { useGeneralStore } from '@/stores/general'

// Mock components
vi.mock('@/components/project-execution/CreateExecutionCreateOrSearch.vue', () => ({
  default: {
    name: 'CreateExecutionCreateOrSearch',
    template: '<div data-testid="create-execution-create-or-search">CreateExecutionCreateOrSearch</div>',
    props: ['optionSelected'],
    emits: ['update:optionSelected']
  }
}))

vi.mock('@/components/project-execution/CreateExecutionNameDescription.vue', () => ({
  default: {
    name: 'CreateExecutionNameDescription',
    template: '<div data-testid="create-execution-name-description">CreateExecutionNameDescription</div>',
    props: ['name', 'description'],
    emits: ['update:name', 'update:description']
  }
}))

vi.mock('@/components/project-execution/CreateExecutionLoadInstance.vue', () => ({
  default: {
    name: 'CreateExecutionLoadInstance',
    template: '<div data-testid="create-execution-load-instance">CreateExecutionLoadInstance</div>',
    props: ['fileSelected', 'newExecution', 'existingInstanceErrors'],
    emits: ['fileSelected', 'instanceSelected', 'update:existingInstanceErrors']
  }
}))

vi.mock('@/components/project-execution/CreateExecutionCheckData.vue', () => ({
  default: {
    name: 'CreateExecutionCheckData',
    template: '<div data-testid="create-execution-check-data">CreateExecutionCheckData</div>',
    props: ['newExecution'],
    emits: ['update:instance', 'checks-launching']
  }
}))

vi.mock('@/components/project-execution/CreateExecutionConfigParams.vue', () => ({
  default: {
    name: 'CreateExecutionConfigParams',
    template: '<div data-testid="create-execution-config-params">CreateExecutionConfigParams</div>',
    modelValue: {},
    emits: ['update:modelValue']
  }
}))

vi.mock('@/components/project-execution/CreateExecutionSolve.vue', () => ({
  default: {
    name: 'CreateExecutionSolve',
    template: '<div data-testid="create-execution-solve">CreateExecutionSolve</div>',
    props: ['newExecution'],
    emits: ['resetAndLoadNewExecution']
  }
}))

vi.mock('@/components/core/DateRangePicker.vue', () => ({
  default: {
    name: 'DateRangePicker',
    template: '<div data-testid="date-range-picker">DateRangePicker</div>',
    props: ['startDateTitle', 'endDateTitle'],
    emits: ['start-date-change', 'end-date-change']
  }
}))

vi.mock('@/components/project-execution/ProjectExecutionsTable.vue', () => ({
  default: {
    name: 'ProjectExecutionsTable',
    template: '<div data-testid="project-executions-table">ProjectExecutionsTable</div>',
    props: ['executionsByDate'],
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
  MFormSteps: {
    name: 'MFormSteps',
    template: '<div data-testid="m-form-steps"><slot v-for="(step, index) in steps" :name="`step-${index}-content`" :key="index" /><slot v-for="(step, index) in steps" :name="`step-${index}-continue-button`" :key="index" /></div>',
    props: ['steps', 'disablePreviousButton', 'disableNextButton', 'currentStep', 'stepsColumnWidth', 'continueButtonText', 'previousButtonText'],
    emits: ['update:currentStep']
  },
  MFilterSearch: {
    name: 'MFilterSearch',
    template: '<div data-testid="m-filter-search">MFilterSearch</div>',
    emits: ['search']
  },
  MCheckboxOptions: {
    name: 'MCheckboxOptions',
    template: '<div data-testid="m-checkbox-options">MCheckboxOptions</div>',
    props: ['options', 'multiple'],
    emits: ['update:options']
  }
}))

const createWrapper = (appConfig = {}) => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        projectExecution: {
          title: 'Project Execution',
          description: 'Execute your project',
          continueButton: 'Continue',
          previousButton: 'Previous',
          snackbar: {
            succesSearch: 'Search successful',
            noDataSearch: 'No data found',
            errorSearch: 'Search error',
            successLoad: 'Execution loaded successfully',
            errorLoad: 'Error loading execution',
            successDelete: 'Execution deleted successfully',
            errorDelete: 'Error deleting execution'
          },
          steps: {
            step1: {
              title: 'Step 1',
              description: 'Choose option',
              titleContent: 'Create or Search'
            },
            step2: {
              title: 'Step 2',
              description: 'Name and description',
              titleContent: 'Execution Details',
              subtitleContent: 'Enter details'
            },
            step2Search: {
              title: 'Step 2 Search',
              description: 'Search executions',
              titleContent: 'Search Range',
              subtitleContent: 'Select dates',
              startDate: 'Start Date',
              endDate: 'End Date',
              search: 'Search'
            },
            step3: {
              title: 'Step 3',
              description: 'Load instance',
              titleContent: 'Instance',
              subtitleContent: 'Load your instance'
            },
            step4: {
              title: 'Step 4',
              description: 'Check data',
              titleContent: 'Validation',
              subtitleContent: 'Validate your data'
            },
            step5: {
              title: 'Step 5',
              description: 'Select solver',
              titleContent: 'Solver',
              subtitleContent: 'Choose solver'
            },
            step6: {
              title: 'Step 6',
              description: 'Config params',
              titleContent: 'Configuration',
              subtitleContent: 'Set parameters'
            },
            step7: {
              title: 'Step 7',
              description: 'Solve',
              titleContent: 'Execution',
              subtitleContent: 'Run execution'
            }
          }
        }
      }
    }
  })

  // Mock the store
  const generalStore = useGeneralStore()
  generalStore.appConfig = {
    parameters: {
      solverConfig: {
        showSolverStep: true,
        defaultSolver: 'default-solver'
      },
      configFieldsConfig: {
        showConfigFieldsStep: true,
        autoLoadValues: false
      },
      configFields: [],
      ...appConfig
    }
  }
  
  // Mock getters correctly
  Object.defineProperty(generalStore, 'getExecutionSolvers', {
    get: vi.fn(() => ['solver1', 'solver2']),
    configurable: true
  })
  generalStore.fetchExecutionsByDateRange = vi.fn()
  generalStore.fetchLoadedExecution = vi.fn()
  generalStore.deleteExecution = vi.fn()
  
  const mockShowSnackbar = vi.fn()

  const wrapper = mount(ProjectExecutionView, {
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
        MFormSteps: {
          name: 'MFormSteps',
          template: '<div data-testid="m-form-steps"><slot /></div>',
          props: ['steps', 'disablePreviousButton', 'disableNextButton', 'currentStep', 'stepsColumnWidth', 'continueButtonText', 'previousButtonText'],
          emits: ['update:currentStep']
        },
        MFilterSearch: {
          name: 'MFilterSearch',
          template: '<div data-testid="m-filter-search">MFilterSearch</div>',
          emits: ['search']
        },
        MCheckboxOptions: true,
        DateRangePicker: true,
        ProjectExecutionsTable: {
          name: 'ProjectExecutionsTable',
          template: '<div data-testid="project-executions-table">ProjectExecutionsTable</div>',
          props: ['executionsByDate']
        },
        CreateExecutionCreateOrSearch: true,
        CreateExecutionNameDescription: true,
        CreateExecutionLoadInstance: true,
        CreateExecutionCheckData: true,
        CreateExecutionConfigParams: true,
        CreateExecutionSolve: true,
        'v-card': { template: '<div class="v-card"><slot /></div>' },
        'v-row': { template: '<div><slot /></div>' },
        'v-btn': { 
          template: '<button><slot /></button>',
          props: ['color']
        },
        'v-icon': { template: '<i></i>' }
      }
    }
  })

  return { wrapper, generalStore, mockShowSnackbar }
}

describe('ProjectExecutionView', () => {
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
      expect(wrapper.find('[data-testid="m-form-steps"]').exists()).toBe(true)
    })

    test('renders execution table when searching with results', async () => {
      const { wrapper } = createWrapper()
      
      await wrapper.setData({ 
        optionSelected: 'searchExecution',
        searchExecution: true
      })

      expect(wrapper.find('.v-card').exists()).toBe(true)
      expect(wrapper.find('[data-testid="project-executions-table"]').exists()).toBe(true)
    })
  })

  describe('Component Props', () => {
    test('passes correct props to MTitleView', () => {
      const { wrapper } = createWrapper()
      const titleView = wrapper.findComponent({ name: 'MTitleView' })

      expect(titleView.props('icon')).toBe('mdi-chart-timeline-variant')
      expect(titleView.props('title')).toBe('Project Execution')
      expect(titleView.props('description')).toBe('Execute your project')
    })

    test('passes correct props to MFormSteps', () => {
      const { wrapper } = createWrapper()
      const formSteps = wrapper.findComponent({ name: 'MFormSteps' })

      expect(Array.isArray(formSteps.props('steps'))).toBe(true)
      expect(formSteps.props('stepsColumnWidth')).toBe('20vw')
      expect(formSteps.props('continueButtonText')).toBe('Continue')
      expect(formSteps.props('previousButtonText')).toBe('Previous')
    })
  })

  describe('Data Properties', () => {
    test('has correct initial data structure', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.optionSelected).toBeNull()
      expect(wrapper.vm.searchExecution).toBe(false)
      expect(Array.isArray(wrapper.vm.executionsByDate)).toBe(true)
      expect(Array.isArray(wrapper.vm.executionsByDateFiltered)).toBe(true)
      expect(wrapper.vm.selectedDates.startDate).toBeNull()
      expect(wrapper.vm.selectedDates.endDate).toBeNull()
      expect(wrapper.vm.currentStep).toBe(0)
      expect(wrapper.vm.newExecution.name).toBeNull()
      expect(wrapper.vm.newExecution.description).toBeNull()
      expect(wrapper.vm.searchExecutionText).toBe('')
      expect(wrapper.vm.checksLaunching).toBe(false)
    })
  })

  describe('Computed Properties', () => {
    test('title computed property returns correct value', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.title).toBe('Project Execution')
    })

    test('description computed property returns correct value', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.description).toBe('Execute your project')
    })

    test('disableNextButton works for nameDescription step', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.optionSelected = 'createExecution'
      wrapper.vm.currentStep = 1 // nameDescription step
      wrapper.vm.newExecution.name = null
      
      expect(wrapper.vm.disableNextButton).toBe(true)
      
      wrapper.vm.newExecution.name = 'Test Name'
      expect(wrapper.vm.disableNextButton).toBe(false)
    })

    test('disableNextButton works for loadInstance step', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.optionSelected = 'createExecution'
      wrapper.vm.currentStep = 2 // loadInstance step
      wrapper.vm.newExecution.instance = null
      
      expect(wrapper.vm.disableNextButton).toBe(true)
      
      wrapper.vm.newExecution.instance = { id: 1 }
      expect(wrapper.vm.disableNextButton).toBe(false)
    })

    test('disablePrevButton is true only for first step', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.currentStep = 0
      expect(wrapper.vm.disablePrevButton).toBe(true)
      
      wrapper.vm.currentStep = 1
      expect(wrapper.vm.disablePrevButton).toBe(false)
    })

    describe('steps computed property', () => {
      test('returns single step when no option selected', () => {
        const { wrapper } = createWrapper()
        
        wrapper.vm.optionSelected = null
        const steps = wrapper.vm.steps
        
        expect(steps).toHaveLength(1)
        expect(steps[0].key).toBe('createOrSearch')
      })

      test('returns search steps when searchExecution selected', () => {
        const { wrapper } = createWrapper()
        
        wrapper.vm.optionSelected = 'searchExecution'
        const steps = wrapper.vm.steps
        
        expect(steps).toHaveLength(2)
        expect(steps[0].key).toBe('createOrSearch')
        expect(steps[1].key).toBe('searchDateRange')
      })

      test('returns create steps when createExecution selected with all steps shown', () => {
        const { wrapper } = createWrapper()
        
        wrapper.vm.optionSelected = 'createExecution'
        const steps = wrapper.vm.steps
        
        expect(steps.length).toBeGreaterThan(4)
        expect(steps.some(s => s.key === 'createOrSearch')).toBe(true)
        expect(steps.some(s => s.key === 'nameDescription')).toBe(true)
        expect(steps.some(s => s.key === 'loadInstance')).toBe(true)
        expect(steps.some(s => s.key === 'checkData')).toBe(true)
        expect(steps.some(s => s.key === 'selectSolver')).toBe(true)
        expect(steps.some(s => s.key === 'configParams')).toBe(true)
        expect(steps.some(s => s.key === 'solve')).toBe(true)
      })

      test('excludes solver step when showSolverStep is false', () => {
        const { wrapper } = createWrapper({
          solverConfig: { showSolverStep: false, defaultSolver: 'default' }
        })
        
        wrapper.vm.optionSelected = 'createExecution'
        const steps = wrapper.vm.steps
        
        expect(steps.some(s => s.key === 'selectSolver')).toBe(false)
      })

      test('excludes config fields step when showConfigFieldsStep is false', () => {
        const { wrapper } = createWrapper({
          configFieldsConfig: { showConfigFieldsStep: false }
        })
        
        wrapper.vm.optionSelected = 'createExecution'
        const steps = wrapper.vm.steps
        
        expect(steps.some(s => s.key === 'configParams')).toBe(false)
      })
    })

    test('solvers computed property returns correctly formatted options', () => {
      const { wrapper } = createWrapper()
      
      const solvers = wrapper.vm.solvers
      
      expect(solvers).toHaveLength(2)
      expect(solvers[0].value).toBe('solver1')
      expect(solvers[0].text).toBe('solver1')
      expect(solvers[0].checked).toBe(false)
    })

    test('isConfigFieldsIncomplete checks field completeness', () => {
      const { wrapper } = createWrapper({
        configFields: [
          { key: 'field1', type: 'text' },
          { key: 'field2', type: 'number' }
        ]
      })
      
      // No config values set
      expect(wrapper.vm.isConfigFieldsIncomplete).toBe(true)
      
      // Partial config
      wrapper.vm.newExecution.config.field1 = 'value1'
      expect(wrapper.vm.isConfigFieldsIncomplete).toBe(true)
      
      // Complete config
      wrapper.vm.newExecution.config.field2 = 123
      expect(wrapper.vm.isConfigFieldsIncomplete).toBe(false)
    })
  })

  describe('Methods', () => {
    test('handleStepChange updates currentStep', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.handleStepChange(2)
      
      expect(wrapper.vm.currentStep).toBe(2)
    })

    test('handleStartDateChange updates selectedDates', () => {
      const { wrapper } = createWrapper()
      const testDate = new Date('2023-01-01')
      
      wrapper.vm.handleStartDateChange(testDate)
      
      expect(wrapper.vm.selectedDates.startDate).toBe(testDate)
    })

    test('handleEndDateChange updates selectedDates', () => {
      const { wrapper } = createWrapper()
      const testDate = new Date('2023-01-31')
      
      wrapper.vm.handleEndDateChange(testDate)
      
      expect(wrapper.vm.selectedDates.endDate).toBe(testDate)
    })

    test('handleInstanceFileSelected updates instanceFile', () => {
      const { wrapper } = createWrapper()
      const testFile = new File(['test'], 'test.json')
      
      wrapper.vm.handleInstanceFileSelected(testFile)
      
      expect(wrapper.vm.instanceFile).toBe(testFile)
    })

    test('handleInstanceSelected updates newExecution.instance', async () => {
      const { wrapper } = createWrapper()
      const testInstance = { id: 1, data: {} }
      
      await wrapper.vm.handleInstanceSelected(testInstance)
      
      expect(wrapper.vm.newExecution.instance).toStrictEqual(testInstance)
    })

    describe('searchByDates', () => {
      test('searches executions by date range successfully', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        const mockResults = [{ id: 1, name: 'Test' }]
        generalStore.fetchExecutionsByDateRange.mockResolvedValue(mockResults)
        
        wrapper.vm.selectedDates.startDate = new Date('2023-01-01')
        wrapper.vm.selectedDates.endDate = new Date('2023-01-31')
        
        await wrapper.vm.searchByDates()
        
        expect(generalStore.fetchExecutionsByDateRange).toHaveBeenCalledWith(
          wrapper.vm.selectedDates.startDate,
          wrapper.vm.selectedDates.endDate
        )
        expect(mockShowSnackbar).toHaveBeenCalledWith('Search successful')
        expect(wrapper.vm.executionsByDate).toEqual(mockResults)
        expect(wrapper.vm.searchExecution).toBe(true)
      })

      test('shows no data message when no results', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchExecutionsByDateRange.mockResolvedValue(null)
        
        wrapper.vm.selectedDates.startDate = new Date('2023-01-01')
        wrapper.vm.selectedDates.endDate = new Date('2023-01-31')
        
        await wrapper.vm.searchByDates()
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('No data found')
      })

      test('shows error message on exception', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchExecutionsByDateRange.mockRejectedValue(new Error('Network error'))
        
        wrapper.vm.selectedDates.startDate = new Date('2023-01-01')
        wrapper.vm.selectedDates.endDate = new Date('2023-01-31')
        
        await wrapper.vm.searchByDates()
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('Search error', 'error')
      })
    })

    describe('loadExecution', () => {
      test('loads execution successfully', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.fetchLoadedExecution.mockResolvedValue(true)
        
        const execution = { id: 1, name: 'Test' }
        
        await wrapper.vm.loadExecution(execution)
        
        expect(generalStore.fetchLoadedExecution).toHaveBeenCalledWith(1)
        expect(mockShowSnackbar).toHaveBeenCalledWith('Execution loaded successfully')
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
    })

    describe('deleteExecution', () => {
      test('deletes execution successfully', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.deleteExecution.mockResolvedValue(true)
        
        wrapper.vm.executionsByDate = [
          { id: 1, name: 'Test1' },
          { id: 2, name: 'Test2' }
        ]
        
        const execution = { id: 1, name: 'Test1' }
        
        await wrapper.vm.deleteExecution(execution)
        
        expect(generalStore.deleteExecution).toHaveBeenCalledWith(1)
        expect(wrapper.vm.executionsByDate).toHaveLength(1)
        expect(wrapper.vm.executionsByDate[0].id).toBe(2)
        expect(mockShowSnackbar).toHaveBeenCalledWith('Execution deleted successfully')
      })

      test('shows error message on delete failure', async () => {
        const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
        generalStore.deleteExecution.mockResolvedValue(false)
        
        const execution = { id: 1, name: 'Test' }
        
        await wrapper.vm.deleteExecution(execution)
        
        expect(mockShowSnackbar).toHaveBeenCalledWith('Error deleting execution', 'error')
      })
    })

    test('resetAndLoadNewExecution resets component data', () => {
      const { wrapper } = createWrapper()
      
      // Set some data
      wrapper.vm.optionSelected = 'createExecution'
      wrapper.vm.newExecution.name = 'Test'
      
      wrapper.vm.resetAndLoadNewExecution()
      
      // Should be reset to initial state
      expect(wrapper.vm.optionSelected).toBeNull()
      expect(wrapper.vm.newExecution.name).toBeNull()
    })

    test('handleSearch filters executions correctly', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.executionsByDate = [
        { name: 'Test Execution 1', description: 'First execution' },
        { name: 'Another Execution', description: 'Second execution' },
        { name: 'Test Execution 2', description: 'Third execution' }
      ]
      
      wrapper.vm.handleSearch('test')
      
      expect(wrapper.vm.executionsByDateFiltered).toHaveLength(2)
      expect(wrapper.vm.searchExecutionText).toBe('test')
    })

    test('getStepIndexByKey returns correct index', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.optionSelected = 'createExecution'
      
      const index = wrapper.vm.getStepIndexByKey('loadInstance')
      
      expect(typeof index).toBe('number')
      expect(index).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Watchers', () => {
    test('currentStep watcher resets search data when searchExecution selected', async () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.optionSelected = 'searchExecution'
      wrapper.vm.executionsByDate = [{ id: 1 }]
      wrapper.vm.searchExecution = true
      
      await wrapper.setData({ currentStep: 1 })
      
      expect(wrapper.vm.executionsByDate).toEqual([])
      expect(wrapper.vm.searchExecution).toBe(false)
    })

    test('optionSelected watcher sets default solver when showSolverStep is false', async () => {
      const { wrapper } = createWrapper({
        solverConfig: { showSolverStep: false, defaultSolver: 'test-solver' }
      })
      
      await wrapper.setData({ optionSelected: 'createExecution' })
      
      expect(wrapper.vm.newExecution.config.solver).toBe('test-solver')
    })
  })

  describe('Lifecycle Methods', () => {
    test('created sets default solver when showSolverStep is false', () => {
      const { wrapper } = createWrapper({
        solverConfig: { showSolverStep: false, defaultSolver: 'default-solver' }
      })
      
      expect(wrapper.vm.newExecution.config.solver).toBe('default-solver')
    })

    test('injects showSnackbar on created', () => {
      const { wrapper, mockShowSnackbar } = createWrapper()
      
      expect(wrapper.vm.showSnackbar).toBe(mockShowSnackbar)
    })
  })

  describe('Configuration-based Behavior', () => {
    test('loadConfigFieldValues loads values from instance data', async () => {
      const { wrapper } = createWrapper({
        configFields: [
          { key: 'field1', source: 'data1', param: 'value1', type: 'text' },
          { key: 'field2', source: 'data2', param: 'value2', type: 'number' },
          { key: 'field3', default: 'default-value', type: 'text' }
        ]
      })
      
      wrapper.vm.newExecution.instance = {
        data: {
          data1: { value1: 'loaded-value-1' },
          data2: { value2: '123' }
        }
      }
      
      await wrapper.vm.loadConfigFieldValues()
      
      expect(wrapper.vm.newExecution.config.field1).toBe('loaded-value-1')
      expect(wrapper.vm.newExecution.config.field2).toBe(123)
      expect(wrapper.vm.newExecution.config.field3).toBe('default-value')
    })

    test('loadConfigFieldValues handles arrayByValue lookup type', async () => {
      const { wrapper } = createWrapper({
        configFields: [
          { 
            key: 'field1', 
            source: 'arrayData', 
            lookupType: 'arrayByValue',
            lookupParam: 'name',
            param: 'test-item',
            lookupValue: 'value',
            type: 'text'
          }
        ]
      })
      
      wrapper.vm.newExecution.instance = {
        data: {
          arrayData: [
            { name: 'item1', value: 'value1' },
            { name: 'test-item', value: 'found-value' },
            { name: 'item3', value: 'value3' }
          ]
        }
      }
      
      await wrapper.vm.loadConfigFieldValues()
      
      expect(wrapper.vm.newExecution.config.field1).toBe('found-value')
    })
  })

  describe('Edge Cases', () => {
    test('handles null selectedDates in searchByDates', async () => {
      const { wrapper, generalStore } = createWrapper()
      generalStore.fetchExecutionsByDateRange.mockResolvedValue([])
      
      wrapper.vm.selectedDates.startDate = null
      wrapper.vm.selectedDates.endDate = null
      
      await wrapper.vm.searchByDates()
      
      expect(generalStore.fetchExecutionsByDateRange).toHaveBeenCalledWith(null, null)
    })

    test('handles empty search text', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.executionsByDate = [{ name: 'Test' }]
      
      wrapper.vm.handleSearch('')
      
      expect(wrapper.vm.executionsByDateFiltered).toEqual(wrapper.vm.executionsByDate)
    })

    test('handles missing instance in loadConfigFieldValues', async () => {
      const { wrapper } = createWrapper({
        configFields: [{ key: 'field1', source: 'data1', param: 'value1' }]
      })
      
      wrapper.vm.newExecution.instance = null
      
      expect(() => wrapper.vm.loadConfigFieldValues()).not.toThrow()
    })
  })

  describe('Component Structure', () => {
    test('has correct CSS classes and structure', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.find('.view-container').exists()).toBe(true)
      const formSteps = wrapper.find('[data-testid="m-form-steps"]')
      expect(formSteps.exists()).toBe(true)
    })
  })
})
