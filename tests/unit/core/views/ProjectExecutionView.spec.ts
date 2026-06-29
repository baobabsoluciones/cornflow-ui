import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import ProjectExecutionView from '@cornflow-ui/core/views/ProjectExecutionView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

// Mock components
vi.mock(
  '@cornflow-ui/core/components/project-execution/CreateExecutionCreateOrSearch.vue',
  () => ({
    default: {
      name: 'CreateExecutionCreateOrSearch',
      template:
        '<div data-testid="create-execution-create-or-search">CreateExecutionCreateOrSearch</div>',
      props: ['optionSelected'],
      emits: ['update:optionSelected'],
    },
  }),
)

vi.mock(
  '@cornflow-ui/core/components/project-execution/CreateExecutionNameDescription.vue',
  () => ({
    default: {
      name: 'CreateExecutionNameDescription',
      template:
        '<div data-testid="create-execution-name-description">CreateExecutionNameDescription</div>',
      props: ['name', 'description'],
      emits: ['update:name', 'update:description'],
    },
  }),
)

vi.mock(
  '@cornflow-ui/core/components/project-execution/CreateExecutionLoadInstance.vue',
  () => ({
    default: {
      name: 'CreateExecutionLoadInstance',
      template:
        '<div data-testid="create-execution-load-instance">CreateExecutionLoadInstance</div>',
      props: ['fileSelected', 'newExecution', 'existingInstanceErrors'],
      emits: [
        'fileSelected',
        'instanceSelected',
        'update:existingInstanceErrors',
      ],
    },
  }),
)

vi.mock(
  '@cornflow-ui/core/components/project-execution/CreateExecutionReviewInstance.vue',
  () => ({
    default: {
      name: 'CreateExecutionReviewInstance',
      template:
        '<div data-testid="create-execution-review-instance">CreateExecutionReviewInstance</div>',
      props: ['newExecution'],
      emits: ['update:instance'],
    },
  }),
)

vi.mock('@cornflow-ui/core/components/project-execution/CreateExecutionCheckData.vue', () => ({
  default: {
    name: 'CreateExecutionCheckData',
    template:
      '<div data-testid="create-execution-check-data">CreateExecutionCheckData</div>',
    props: ['newExecution'],
    emits: ['update:instance', 'checks-launching'],
  },
}))

vi.mock(
  '@cornflow-ui/core/components/project-execution/CreateExecutionConfigParams.vue',
  () => ({
    default: {
      name: 'CreateExecutionConfigParams',
      template:
        '<div data-testid="create-execution-config-params">CreateExecutionConfigParams</div>',
      modelValue: {},
      emits: ['update:modelValue'],
    },
  }),
)

vi.mock('@cornflow-ui/core/components/project-execution/CreateExecutionSolve.vue', () => ({
  default: {
    name: 'CreateExecutionSolve',
    template:
      '<div data-testid="create-execution-solve">CreateExecutionSolve</div>',
    props: ['newExecution'],
    emits: ['resetAndLoadNewExecution'],
  },
}))

vi.mock('@cornflow-ui/core/components/core/DateRangePicker.vue', () => ({
  default: {
    name: 'DateRangePicker',
    template: '<div data-testid="date-range-picker">DateRangePicker</div>',
    props: ['startDateTitle', 'endDateTitle'],
    emits: ['start-date-change', 'end-date-change'],
  },
}))

vi.mock('@cornflow-ui/core/components/project-execution/ProjectExecutionsTable.vue', () => ({
  default: {
    name: 'ProjectExecutionsTable',
    template:
      '<div data-testid="project-executions-table">ProjectExecutionsTable</div>',
    props: ['executionsByDate'],
    emits: ['loadExecution', 'deleteExecution'],
  },
}))

// Mock Mango UI components
vi.mock('mango-ui', () => ({
  MTitleView: {
    name: 'MTitleView',
    template: '<div data-testid="m-title-view"><slot /></div>',
    props: ['icon', 'title', 'description'],
  },
  MFormSteps: {
    name: 'MFormSteps',
    template:
      '<div data-testid="m-form-steps"><slot v-for="(step, index) in steps" :name="`step-${index}-content`" :key="index" /><slot v-for="(step, index) in steps" :name="`step-${index}-continue-button`" :key="index" /></div>',
    props: [
      'steps',
      'disablePreviousButton',
      'disableNextButton',
      'currentStep',
      'stepsColumnWidth',
      'continueButtonText',
      'previousButtonText',
    ],
    emits: ['update:currentStep'],
  },
  MFilterSearch: {
    name: 'MFilterSearch',
    template: '<div data-testid="m-filter-search">MFilterSearch</div>',
    emits: ['search'],
  },
  MCheckboxOptions: {
    name: 'MCheckboxOptions',
    template: '<div data-testid="m-checkbox-options">MCheckboxOptions</div>',
    props: ['options', 'multiple'],
    emits: ['update:options'],
  },
}))

const createWrapper = (appConfig = {}, routeQuery = {}) => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)

  // Create a router with the route query
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/project-execution',
        component: { template: '<div></div>' },
      },
    ],
  })

  // Navigate to the route with query parameters
  router.push({
    path: '/project-execution',
    query: routeQuery,
  })

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
            errorDelete: 'Error deleting execution',
          },
          steps: {
            step1: {
              title: 'Step 1',
              description: 'Choose option',
              titleContent: 'Create or Search',
            },
            step2: {
              title: 'Step 2',
              description: 'Name and description',
              titleContent: 'Execution Details',
              subtitleContent: 'Enter details',
            },
            step2Search: {
              title: 'Step 2 Search',
              description: 'Search executions',
              titleContent: 'Search Range',
              subtitleContent: 'Select dates',
              startDate: 'Start Date',
              endDate: 'End Date',
              search: 'Search',
            },
            step3: {
              title: 'Step 3',
              description: 'Load instance',
              titleContent: 'Instance',
              subtitleContent: 'Load your instance',
            },
            step4: {
              title: 'Step 4',
              description: 'Check data',
              titleContent: 'Validation',
              subtitleContent: 'Validate your data',
            },
            step5: {
              title: 'Step 5',
              description: 'Select solver',
              titleContent: 'Solver',
              subtitleContent: 'Choose solver',
            },
            step6: {
              title: 'Step 6',
              description: 'Config params',
              titleContent: 'Configuration',
              subtitleContent: 'Set parameters',
            },
            step7: {
              title: 'Step 7',
              description: 'Solve',
              titleContent: 'Execution',
              subtitleContent: 'Run execution',
            },
            step8: {
              title: 'Step 8',
              description: 'Solve',
              titleContent: 'Execution',
              subtitleContent: 'Run execution',
            },
            loadInstance: {
              title: 'Load Instance',
              description: 'Load instance',
              titleContent: 'Instance',
              subtitleContent: 'Load your instance',
            },
            reviewInstance: {
              title: 'Review Instance',
              description: 'Review instance',
              titleContent: 'Review',
              subtitleContent: 'Review your instance',
            },
            checkData: {
              title: 'Check Data',
              description: 'Check data',
              titleContent: 'Validation',
              subtitleContent: 'Validate your data',
            },
            selectSolver: {
              title: 'Select Solver',
              description: 'Select solver',
              titleContent: 'Solver',
              subtitleContent: 'Choose solver',
            },
            configParams: {
              title: 'Config Params',
              description: 'Config params',
              titleContent: 'Configuration',
              subtitleContent: 'Set parameters',
            },
            nameDescription: {
              title: 'Name Description',
              description: 'Name and description',
              titleContent: 'Execution Details',
              subtitleContent: 'Enter details',
            },
            solve: {
              title: 'Solve',
              description: 'Solve',
              titleContent: 'Execution',
              subtitleContent: 'Run execution',
            },
          },
        },
      },
    },
  })

  // Mock the store
  const generalStore = useGeneralStore()
  generalStore.appConfig = {
    parameters: {
      solverConfig: {
        showSolverStep: true,
        defaultSolver: 'default-solver',
      },
      configFieldsConfig: {
        showConfigFieldsStep: true,
        autoLoadValues: false,
      },
      configFields: [],
      ...appConfig,
    },
  }

  // Mock getters correctly
  Object.defineProperty(generalStore, 'getExecutionSolvers', {
    get: vi.fn(() => ['solver1', 'solver2']),
    configurable: true,
  })
  generalStore.fetchExecutionsByDateRange = vi.fn()
  generalStore.fetchLoadedExecution = vi.fn()
  generalStore.deleteExecution = vi.fn()

  const mockShowSnackbar = vi.fn()

  const wrapper = mount(ProjectExecutionView, {
    global: {
      plugins: [vuetify, pinia, i18n, router],
      provide: {
        showSnackbar: mockShowSnackbar,
      },
      stubs: {
        MTitleView: {
          name: 'MTitleView',
          template: '<div data-testid="m-title-view"><slot /></div>',
          props: ['icon', 'title', 'description'],
        },
        MFormSteps: {
          name: 'MFormSteps',
          template: '<div data-testid="m-form-steps"><slot /></div>',
          props: [
            'steps',
            'disablePreviousButton',
            'disableNextButton',
            'currentStep',
            'stepsColumnWidth',
            'continueButtonText',
            'previousButtonText',
          ],
          emits: ['update:currentStep'],
        },
        MFilterSearch: {
          name: 'MFilterSearch',
          template: '<div data-testid="m-filter-search">MFilterSearch</div>',
          emits: ['search'],
        },
        MCheckboxOptions: true,
        DateRangePicker: true,
        ProjectExecutionsTable: {
          name: 'ProjectExecutionsTable',
          template:
            '<div data-testid="project-executions-table">ProjectExecutionsTable</div>',
          props: ['executionsByDate'],
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
          props: ['color'],
        },
        'v-icon': { template: '<i></i>' },
      },
    },
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

    test('renders create execution form by default', async () => {
      const { wrapper } = createWrapper()

      expect(wrapper.find('[data-testid="m-form-steps"]').exists()).toBe(true)
      // Component now always shows create execution form
      expect(wrapper.vm.steps.length).toBeGreaterThan(4)
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
      expect(formSteps.props('stepsColumnWidth')).toBe('20%')
      expect(formSteps.props('continueButtonText')).toBe('Continue')
      expect(formSteps.props('previousButtonText')).toBe('Previous')
    })
  })

  describe('Data Properties', () => {
    test('has correct initial data structure', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.vm.currentStep).toBe(0)
      expect(wrapper.vm.newExecution.name).toBeNull()
      expect(wrapper.vm.newExecution.description).toBeNull()
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

      // Find the actual index of nameDescription step
      const nameDescriptionStepIndex = wrapper.vm.steps.findIndex(
        (step) => step.key === 'nameDescription',
      )
      expect(nameDescriptionStepIndex).toBeGreaterThanOrEqual(0)

      wrapper.vm.currentStep = nameDescriptionStepIndex
      wrapper.vm.newExecution.name = null

      expect(wrapper.vm.disableNextButton).toBe(true)

      wrapper.vm.newExecution.name = 'Test Name'
      expect(wrapper.vm.disableNextButton).toBe(false)
    })

    test('disableNextButton works for loadInstance step', () => {
      const { wrapper } = createWrapper()

      // Find the actual index of loadInstance step
      const loadInstanceStepIndex = wrapper.vm.steps.findIndex(
        (step) => step.key === 'loadInstance',
      )
      expect(loadInstanceStepIndex).toBeGreaterThanOrEqual(0)

      wrapper.vm.currentStep = loadInstanceStepIndex
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
      test('returns create execution steps by default', () => {
        const { wrapper } = createWrapper()

        const steps = wrapper.vm.steps

        expect(steps.length).toBeGreaterThan(4)
        expect(steps.some((s) => s.key === 'nameDescription')).toBe(true)
        expect(steps.some((s) => s.key === 'loadInstance')).toBe(true)
        expect(steps.some((s) => s.key === 'checkData')).toBe(true)
        expect(steps.some((s) => s.key === 'selectSolver')).toBe(true)
      })

      test('includes all create execution steps', () => {
        const { wrapper } = createWrapper()

        const steps = wrapper.vm.steps

        expect(steps.length).toBeGreaterThan(4)
        expect(steps.some((s) => s.key === 'nameDescription')).toBe(true)
        expect(steps.some((s) => s.key === 'loadInstance')).toBe(true)
        expect(steps.some((s) => s.key === 'checkData')).toBe(true)
        expect(steps.some((s) => s.key === 'selectSolver')).toBe(true)
        expect(steps.some((s) => s.key === 'configParams')).toBe(true)
        expect(steps.some((s) => s.key === 'solve')).toBe(true)
      })

      test('excludes solver step when showSolverStep is false', () => {
        const { wrapper } = createWrapper({
          solverConfig: { showSolverStep: false, defaultSolver: 'default' },
        })

        wrapper.vm.optionSelected = 'createExecution'
        const steps = wrapper.vm.steps

        expect(steps.some((s) => s.key === 'selectSolver')).toBe(false)
      })

      test('excludes config fields step when showConfigFieldsStep is false', () => {
        const { wrapper } = createWrapper({
          configFieldsConfig: { showConfigFieldsStep: false },
        })

        wrapper.vm.optionSelected = 'createExecution'
        const steps = wrapper.vm.steps

        expect(steps.some((s) => s.key === 'configParams')).toBe(false)
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
          { key: 'field2', type: 'number' },
        ],
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

    test('handleFilesSelected updates selectedFiles', () => {
      const { wrapper } = createWrapper()
      const testFiles = [new File(['test'], 'test.json')]

      wrapper.vm.handleFilesSelected(testFiles)

      expect(wrapper.vm.selectedFiles).toEqual(testFiles)
    })

    test('handleInstanceSelected updates newExecution.instance', async () => {
      const { wrapper } = createWrapper()
      const testInstance = { id: 1, data: {} }

      await wrapper.vm.handleInstanceSelected(testInstance)

      expect(wrapper.vm.newExecution.instance).toStrictEqual(testInstance)
    })

    test('resetAndLoadNewExecution resets component data', () => {
      const { wrapper } = createWrapper()

      // Set some data
      wrapper.vm.newExecution.name = 'Test'

      wrapper.vm.resetAndLoadNewExecution()

      // Should be reset to initial state
      expect(wrapper.vm.newExecution.name).toBeNull()
    })
  })

  describe('Watchers', () => {
    test('optionSelected watcher sets default solver when showSolverStep is false', async () => {
      const { wrapper } = createWrapper({
        solverConfig: { showSolverStep: false, defaultSolver: 'test-solver' },
      })

      await wrapper.setData({ optionSelected: 'createExecution' })

      expect(wrapper.vm.newExecution.config.solver).toBe('test-solver')
    })
  })

  describe('Lifecycle Methods', () => {
    test('created sets default solver when showSolverStep is false', () => {
      const { wrapper } = createWrapper({
        solverConfig: {
          showSolverStep: false,
          defaultSolver: 'default-solver',
        },
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
          { key: 'field3', default: 'default-value', type: 'text' },
        ],
      })

      wrapper.vm.newExecution.instance = {
        data: {
          data1: { value1: 'loaded-value-1' },
          data2: { value2: '123' },
        },
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
            type: 'text',
          },
        ],
      })

      wrapper.vm.newExecution.instance = {
        data: {
          arrayData: [
            { name: 'item1', value: 'value1' },
            { name: 'test-item', value: 'found-value' },
            { name: 'item3', value: 'value3' },
          ],
        },
      }

      await wrapper.vm.loadConfigFieldValues()

      expect(wrapper.vm.newExecution.config.field1).toBe('found-value')
    })
  })

  describe('Edge Cases', () => {
    test('handles missing instance in loadConfigFieldValues', async () => {
      const { wrapper } = createWrapper({
        configFields: [{ key: 'field1', source: 'data1', param: 'value1' }],
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

  describe('Step change with pending changes', () => {
    test('handleStepChange blocks navigation and shows modal when on reviewInstance with pending changes', async () => {
      const { wrapper } = createWrapper()
      // Move to reviewInstance step
      const reviewIndex = wrapper.vm.steps.findIndex(
        (s) => s.key === 'reviewInstance',
      )
      wrapper.vm.currentStep = reviewIndex
      wrapper.vm.hasPendingTableChanges = true
      const before = wrapper.vm.currentStep

      await wrapper.vm.handleStepChange(reviewIndex + 1)

      expect(wrapper.vm.showUnsavedChangesModal).toBe(true)
      expect(wrapper.vm.pendingStepChange).toBe(reviewIndex + 1)
      // Step does not advance
      expect(wrapper.vm.currentStep).toBe(before)
    })

    test('handleStayOnStep closes the modal and clears pending step change', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.pendingStepChange = 3
      wrapper.vm.showUnsavedChangesModal = true

      wrapper.vm.handleStayOnStep()

      expect(wrapper.vm.pendingStepChange).toBeNull()
      expect(wrapper.vm.showUnsavedChangesModal).toBe(false)
    })

    test('handleLeaveStep clears changes and proceeds with the pending step', () => {
      const { wrapper } = createWrapper()
      const clearSpy = vi.spyOn(wrapper.vm.tableChanges, 'clearAllChanges')
      const proceedSpy = vi
        .spyOn(wrapper.vm, 'proceedWithStepChange')
        .mockResolvedValue(undefined)
      wrapper.vm.pendingStepChange = 2
      wrapper.vm.hasPendingTableChanges = true

      wrapper.vm.handleLeaveStep()

      expect(clearSpy).toHaveBeenCalled()
      expect(wrapper.vm.hasPendingTableChanges).toBe(false)
      expect(proceedSpy).toHaveBeenCalledWith(2)
      expect(wrapper.vm.showUnsavedChangesModal).toBe(false)
    })

    test('handleStepChange proceeds normally when no pending changes', async () => {
      const { wrapper } = createWrapper()
      const proceedSpy = vi
        .spyOn(wrapper.vm, 'proceedWithStepChange')
        .mockResolvedValue(undefined)

      await wrapper.vm.handleStepChange(1)

      expect(proceedSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('External ETL submit on leaving reviewInstance', () => {
    test('submitExternalEtlUpdate applies returned data and resets the flow', async () => {
      const { wrapper, generalStore } = createWrapper()
      generalStore.appConfig.Instance = vi.fn(function (id, data) {
        return { id, data }
      })
      Object.defineProperty(generalStore, 'getSchemaConfig', {
        get: () => ({ instanceSchema: {}, instanceChecksSchema: {} }),
        configurable: true,
      })
      Object.defineProperty(generalStore, 'getSchemaName', {
        get: () => 'schema',
        configurable: true,
      })
      wrapper.vm.newExecution.instance = { data: { t: [] } }
      wrapper.vm.externalEtlFlow.submitUpdate = vi
        .fn()
        .mockResolvedValue({ data: { t: [1] }, warning: null })
      const resetSpy = vi.spyOn(wrapper.vm.externalEtlFlow, 'reset')

      const aborted = await wrapper.vm.submitExternalEtlUpdate()

      expect(aborted).toBe(false)
      expect(wrapper.vm.externalEtlFlow.submitUpdate).toHaveBeenCalled()
      expect(resetSpy).toHaveBeenCalled()
      expect(wrapper.vm.newExecution.instance.data).toEqual({ t: [1] })
    })

    test('submitExternalEtlUpdate shows a warning snackbar when one is returned', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      generalStore.appConfig.Instance = vi.fn(function (id, data) {
        return { id, data }
      })
      Object.defineProperty(generalStore, 'getSchemaConfig', {
        get: () => ({ instanceSchema: {}, instanceChecksSchema: {} }),
        configurable: true,
      })
      Object.defineProperty(generalStore, 'getSchemaName', {
        get: () => 'schema',
        configurable: true,
      })
      wrapper.vm.newExecution.instance = { data: { t: [] } }
      wrapper.vm.externalEtlFlow.submitUpdate = vi
        .fn()
        .mockResolvedValue({ data: {}, warning: 'heads up' })

      await wrapper.vm.submitExternalEtlUpdate()

      expect(mockShowSnackbar).toHaveBeenCalledWith('heads up', 'warning', {
        persistent: true,
      })
    })

    test('submitExternalEtlUpdate returns true (aborts) on error', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper()
      wrapper.vm.newExecution.instance = { data: { t: [] } }
      wrapper.vm.externalEtlFlow.submitUpdate = vi
        .fn()
        .mockRejectedValue(new Error('etl failed'))
      const keyBefore = wrapper.vm.formStepsKey

      const aborted = await wrapper.vm.submitExternalEtlUpdate()

      expect(aborted).toBe(true)
      expect(mockShowSnackbar).toHaveBeenCalledWith('etl failed', 'error')
      expect(wrapper.vm.formStepsKey).toBe(keyBefore + 1)
    })

    test('submitExternalEtlUpdate returns false when no instance data', async () => {
      const { wrapper } = createWrapper()
      wrapper.vm.newExecution.instance = null
      const aborted = await wrapper.vm.submitExternalEtlUpdate()
      expect(aborted).toBe(false)
    })

    test('handleExternalEtlData forwards raw data to the flow', () => {
      const { wrapper } = createWrapper()
      const initSpy = vi.spyOn(
        wrapper.vm.externalEtlFlow,
        'initializeFromEtlResponse',
      )
      wrapper.vm.handleExternalEtlData({ tables: {} })
      expect(initSpy).toHaveBeenCalledWith({ tables: {} })
    })
  })

  describe('validateInstanceSchema', () => {
    test('returns early when there is no instance', async () => {
      const { wrapper } = createWrapper()
      wrapper.vm.newExecution.instance = null
      await wrapper.vm.validateInstanceSchema()
      expect(wrapper.vm.existingInstanceErrors).toBeNull()
    })

    test('clears errors when validation passes', async () => {
      const { wrapper } = createWrapper()
      wrapper.vm.existingInstanceErrors = 'old'
      wrapper.vm.newExecution.instance = {
        checkSchema: vi.fn().mockResolvedValue([]),
      }
      await wrapper.vm.validateInstanceSchema()
      expect(wrapper.vm.existingInstanceErrors).toBeNull()
    })

    test('sets errors and shows a snackbar when validation fails', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper()
      wrapper.vm.newExecution.instance = {
        checkSchema: vi
          .fn()
          .mockResolvedValue([{ instancePath: '/x', message: 'bad', keyword: 'type', schemaPath: '#', params: {} }]),
      }
      await wrapper.vm.validateInstanceSchema()
      expect(wrapper.vm.existingInstanceErrors).toBeTruthy()
      expect(mockShowSnackbar).toHaveBeenCalled()
    })

    test('handles exceptions thrown during validation', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper()
      wrapper.vm.newExecution.instance = {
        checkSchema: vi.fn().mockRejectedValue(new Error('schema boom')),
      }
      await wrapper.vm.validateInstanceSchema()
      expect(wrapper.vm.existingInstanceErrors).toContain('schema boom')
      expect(mockShowSnackbar).toHaveBeenCalled()
    })
  })

  describe('step ordering helpers', () => {
    test('calculates name/solve order with both optional steps shown', () => {
      const { wrapper } = createWrapper({
        solverConfig: { showSolverStep: true, defaultSolver: 'd' },
        configFieldsConfig: { showConfigFieldsStep: true, autoLoadValues: false },
      })
      expect(wrapper.vm.calculateNameDescriptionStepOrder()).toBe(6)
      expect(wrapper.vm.calculateSolveStepOrder()).toBe(7)
    })

    test('calculates name/solve order with no optional steps', () => {
      const { wrapper } = createWrapper({
        solverConfig: { showSolverStep: false, defaultSolver: 'd' },
        configFieldsConfig: { showConfigFieldsStep: false, autoLoadValues: false },
      })
      expect(wrapper.vm.calculateNameDescriptionStepOrder()).toBe(4)
      expect(wrapper.vm.calculateSolveStepOrder()).toBe(5)
    })

    test('reviewInstanceStepIndex resolves the review step position', () => {
      const { wrapper } = createWrapper()
      const idx = wrapper.vm.reviewInstanceStepIndex
      expect(wrapper.vm.steps[idx].key).toBe('reviewInstance')
    })
  })

  describe('config field value extraction', () => {
    test('getArrayByValueLookup finds the matching entry value', () => {
      const { wrapper } = createWrapper()
      const arr = [
        { code: 'a', val: 1 },
        { code: 'b', val: 2 },
      ]
      const result = wrapper.vm.getArrayByValueLookup(
        { lookupParam: 'code', param: 'b', lookupValue: 'val' },
        arr,
      )
      expect(result).toBe(2)
    })

    test('getArrayByValueLookup returns undefined when not found', () => {
      const { wrapper } = createWrapper()
      const result = wrapper.vm.getArrayByValueLookup(
        { lookupParam: 'code', param: 'z', lookupValue: 'val' },
        [{ code: 'a', val: 1 }],
      )
      expect(result).toBeUndefined()
    })

    test('convertValueByType converts floats, numbers and passthrough', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.vm.convertValueByType('1.5', 'float')).toBe(1.5)
      expect(wrapper.vm.convertValueByType('3', 'number')).toBe(3)
      expect(wrapper.vm.convertValueByType('keep', 'string')).toBe('keep')
    })

    test('hasValidDataSource reflects presence of source data', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.newExecution.instance = { data: { src: { a: 1 } } }
      expect(wrapper.vm.hasValidDataSource({ source: 'src' })).toBeTruthy()
      expect(wrapper.vm.hasValidDataSource({ source: 'missing' })).toBeFalsy()
    })

    test('extractFieldValue falls back to default without a valid source', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.newExecution.instance = { data: {} }
      expect(
        wrapper.vm.extractFieldValue({ source: 'x', default: 'def' }),
      ).toBe('def')
    })
  })

  describe('exit confirmation flow', () => {
    test('hasProgressToLose is true when a name is set', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.newExecution.name = 'My Execution'
      expect(wrapper.vm.hasProgressToLose()).toBeTruthy()
    })

    test('hasProgressToLose is false with a fresh state', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.newExecution = {
        instance: null,
        config: {},
        name: null,
        description: null,
      }
      wrapper.vm.selectedFiles = []
      wrapper.vm.currentStep = 0
      expect(wrapper.vm.hasProgressToLose()).toBeFalsy()
    })

    test('handleCancelExit closes the modal and cancels navigation', () => {
      const { wrapper } = createWrapper()
      const next = vi.fn()
      wrapper.vm.pendingNavigation = next
      wrapper.vm.showExitConfirmationModal = true

      wrapper.vm.handleCancelExit()

      expect(wrapper.vm.showExitConfirmationModal).toBe(false)
      expect(next).toHaveBeenCalledWith(false)
      expect(wrapper.vm.pendingNavigation).toBeNull()
    })

    test('handleConfirmExit resets data and navigates', async () => {
      const { wrapper } = createWrapper()
      const next = vi.fn()
      wrapper.vm.pendingNavigation = next
      wrapper.vm.pendingNavigationTo = { path: '/somewhere' }
      wrapper.vm.newExecution.name = 'dirty'
      wrapper.vm.showExitConfirmationModal = true

      wrapper.vm.handleConfirmExit()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.showExitConfirmationModal).toBe(false)
      expect(wrapper.vm.pendingNavigation).toBeNull()
      expect(next).toHaveBeenCalled()
    })
  })

  describe('beforeRouteLeave guard', () => {
    test('allows navigation when execution was already launched', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.executionAlreadyLaunched = true
      const next = vi.fn()
      wrapper.vm.$options.beforeRouteLeave.call(wrapper.vm, {}, {}, next)
      expect(next).toHaveBeenCalledWith()
    })

    test('allows navigation when there is no progress to lose', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.executionAlreadyLaunched = false
      vi.spyOn(wrapper.vm, 'hasProgressToLose').mockReturnValue(false)
      wrapper.vm.hasPendingTableChanges = false
      const next = vi.fn()
      wrapper.vm.$options.beforeRouteLeave.call(wrapper.vm, {}, {}, next)
      expect(next).toHaveBeenCalledWith()
    })

    test('shows the confirmation modal when there is progress to lose', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.executionAlreadyLaunched = false
      vi.spyOn(wrapper.vm, 'hasProgressToLose').mockReturnValue(true)
      const next = vi.fn()
      const to = { path: '/x' }
      wrapper.vm.$options.beforeRouteLeave.call(wrapper.vm, to, {}, next)
      expect(wrapper.vm.showExitConfirmationModal).toBe(true)
      expect(wrapper.vm.pendingNavigation).toBe(next)
      expect(wrapper.vm.pendingNavigationTo).toEqual(to)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('loadInstanceStepBlocked computed', () => {
    test('returns false when not on the loadInstance step', () => {
      const { wrapper } = createWrapper()
      // default currentStep is 0 (loadInstance in non-edit mode) — force a non-load step
      const reviewIndex = wrapper.vm.steps.findIndex(
        (s) => s.key === 'reviewInstance',
      )
      wrapper.vm.currentStep = reviewIndex
      expect(wrapper.vm.loadInstanceStepBlocked).toBe(false)
    })

    test('is blocked on loadInstance step when no instance and no etl', () => {
      const { wrapper } = createWrapper()
      const loadIndex = wrapper.vm.steps.findIndex(
        (s) => s.key === 'loadInstance',
      )
      wrapper.vm.currentStep = loadIndex
      wrapper.vm.newExecution.instance = null
      expect(wrapper.vm.loadInstanceStepBlocked).toBe(true)
    })

    test('is blocked when there are existing instance errors', () => {
      const { wrapper } = createWrapper()
      const loadIndex = wrapper.vm.steps.findIndex(
        (s) => s.key === 'loadInstance',
      )
      wrapper.vm.currentStep = loadIndex
      wrapper.vm.newExecution.instance = { data: {} }
      wrapper.vm.existingInstanceErrors = 'boom'
      expect(wrapper.vm.loadInstanceStepBlocked).toBe(true)
    })
  })
})
