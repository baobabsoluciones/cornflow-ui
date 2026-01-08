import { Instance } from '@/app/models/Instance.ts'
import { Solution } from '@/app/models/Solution.ts'
import { Experiment } from '@/app/models/Experiment.ts'

// Create a function to get the app configuration
const createAppConfig = () => ({
  core: {
    Experiment: Experiment,
    Instance: Instance,
    Solution: Solution,
    parameters: {
      valuesJsonPath: '/values.json',
      useEtlBackend: true,

      // Project execution table configuration
      showTablesWithoutSchema: false,
      showExtraProjectExecutionColumns: {
        showUserName: false,
        showEndCreationDate: false,
        showTimeLimit: true,
        showUserFullName: false,
      },

      // Instance editing configuration
      allowEditInstance: true,

      // Latest plan (Actual plan) configuration
      latestPlanConfig: {
        // Default view to navigate to after login when latest plan is loaded
        // Options: 'history-execution', 'dashboard', 'input-data', 'results'
        defaultView: 'history-execution',
        // Whether to show the star icon in the tab bar for the latest plan
        showStarInTabBar: true,
      },

      // Section titles configuration (i18n keys)
      // These allow customizing the navigation section titles
      // Set to null/undefined to use default translations from 'navigation.*'
      // Set to a custom i18n key to use app-specific translations from 'app.sectionTitles.*'
      sectionTitles: {
        // Execution history section title
        // Default: 'navigation.executions' -> 'Executions'
        executions: null as string | null,

        // Master/Configuration data section title
        // Default: 'navigation.masterData' -> 'Configuration tables'
        // Custom: 'app.sectionTitles.masterData' -> 'Master data' / 'Datos maestros'
        masterData: null as string | null,

        // Input data section title
        // Default: 'navigation.inputData' -> 'Input data'
        // Custom: 'app.sectionTitles.inputData' -> 'Current case data' / 'Datos del caso actual'
        inputData: null as string | null,

        // Results/Output data section title
        // Default: 'navigation.results' -> 'Results'
        // Custom: 'app.sectionTitles.results' -> 'Current case results' / 'Resultados del caso actual'
        results: null as string | null,
      },

      // Solver configuration
      solverConfig: {
        showSolverStep: true,
        defaultSolver: 'mip',
      },
      configFieldsConfig: {
        showConfigFieldsStep: false,
        autoLoadValues: false,
      },
      executionSolvers: ['mip.gurobi'],
      configFields: [
        {
          key: 'timeLimit',
          title: 'projectExecution.steps.step7.time',
          placeholder: 'projectExecution.steps.step7.timeLimitPlaceholder',
          suffix: 'projectExecution.steps.step7.secondsSuffix',
          icon: 'mdi-timer-sand',
          type: 'number',
        },
      ],
      fileProcessors: {
        // Define filename prefixes that need special processing and their corresponding processor methods
      },

      // Auto dashboard configuration
      enableAutoInstanceDashboard: false,
      enableAutoSolutionDashboard: false,

      // Table-specific dashboard configuration
      // Allows custom widgets and per-table control of auto dashboards
      tableDashboards: {
        // Configuration for instance tables
        instance: {
          // Example: Show only custom widgets, no auto-generated widgets
          // otraTabla: {
          //   showAutoDashboards: false, // Disable auto-generated widgets for this table
          //   customWidgets: [
          //     {
          //       component: 'CustomWidget',
          //       props: {},
          //       position: 'side',
          //     },
          //   ],
          // },
        },
        // Configuration for solution tables
        solution: {
          // Same structure as instance
        },
      },

      // States for execution and solution
      // Store translation keys instead of translated values for reactivity
      executionStates: {
        '1': {
          color: 'green',
          messageKey: 'executionTable.executionSolvedCorrectly',
          codeKey: 'executionTable.success',
        },
        '0': {
          color: 'purple',
          messageKey: 'executionTable.executionRunning',
          codeKey: 'executionTable.loading',
        },
        '-1': {
          color: 'red',
          messageKey: 'executionTable.executionError',
          codeKey: 'executionTable.error',
        },
        '-2': {
          color: 'red',
          messageKey: 'executionTable.executionStopped',
          codeKey: 'executionTable.error',
        },
        '-3': {
          color: 'red',
          messageKey: 'executionTable.executionNotStarted',
          codeKey: 'executionTable.error',
        },
        '-4': {
          color: 'orange',
          messageKey: 'executionTable.executionNotRun',
          codeKey: 'executionTable.notRunByUser',
        },
        '-5': {
          color: 'red',
          messageKey: 'executionTable.executionUnknownError',
          codeKey: 'executionTable.error',
        },
        '-6': {
          color: 'red',
          messageKey: 'executionTable.executionFailedSaving',
          codeKey: 'executionTable.error',
        },
        '2': {
          color: 'green',
          messageKey: 'executionTable.executionLoadedManually',
          codeKey: 'executionTable.success',
        },
        '-7': {
          color: 'red',
          messageKey: 'executionTable.executionQueued',
          codeKey: 'executionTable.loading',
        },
      },
      solutionStates: {
        1: {
          color: 'green',
          codeKey: 'executionTable.optimal',
          messageKey: 'executionTable.optimalTooltip',
        },
        5: {
          color: 'orange',
          codeKey: 'executionTable.timeLimit',
          messageKey: 'executionTable.timeLimitTooltip',
        },
        '-1': {
          color: 'red',
          codeKey: 'executionTable.infeasible',
          messageKey: 'executionTable.infeasibleTooltip',
        },
        '-3': {
          color: 'grey',
          codeKey: 'executionTable.unknown',
          messageKey: 'executionTable.unknownTooltip',
        },
        0: {
          color: 'grey',
          codeKey: 'executionTable.notSolved',
          messageKey: 'executionTable.notSolvedTooltip',
        },
        '-2': {
          color: 'red',
          codeKey: 'executionTable.unbounded',
          messageKey: 'executionTable.unboundedTooltip',
        },
        2: {
          color: 'green',
          codeKey: 'executionTable.feasible',
          messageKey: 'executionTable.feasibleTooltip',
        },
        3: {
          color: 'orange',
          codeKey: 'executionTable.memoryLimit',
          messageKey: 'executionTable.memoryLimitTooltip',
        },
        4: {
          color: 'orange',
          codeKey: 'executionTable.nodeLimit',
          messageKey: 'executionTable.nodeLimitTooltip',
        },
        '-5': {
          color: 'red',
          codeKey: 'executionTable.licensingProblem',
          messageKey: 'executionTable.licensingProblemTooltip',
        },
        '-4': {
          color: 'orange',
          codeKey: 'executionTable.notRunByUser',
          messageKey: 'executionTable.notRunByUserTooltip',
        },
      },
    },
  },

  // Dashboard configuration
  dashboardPages: [],
  dashboardRoutes: [],
  dashboardLayout: [],

  // Instance dashboard configuration (for input data)
  instanceDashboardPages: [],
  instanceDashboardRoutes: [],
  instanceDashboardLayout: [],
})

class Config {
  private config: ReturnType<typeof createAppConfig> | null = null

  constructor() {
    // Don't initialize in constructor
  }

  // Initialize or update config
  updateConfig() {
    this.config = createAppConfig()
  }

  private ensureConfig() {
    if (!this.config) {
      this.config = createAppConfig()
    }
    return this.config
  }

  getCore() {
    return this.ensureConfig().core
  }

  getDashboardPages() {
    return this.ensureConfig().dashboardPages
  }

  getDashboardRoutes() {
    return this.ensureConfig().dashboardRoutes
  }

  getDashboardLayout() {
    return this.ensureConfig().dashboardLayout
  }

  getInstanceDashboardPages() {
    return this.ensureConfig().instanceDashboardPages
  }

  getInstanceDashboardRoutes() {
    return this.ensureConfig().instanceDashboardRoutes
  }

  getInstanceDashboardLayout() {
    return this.ensureConfig().instanceDashboardLayout
  }
}

const appConfig = new Config()
export default appConfig
