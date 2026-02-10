import { Instance } from '@/app/models/Instance.ts'
import { Solution } from '@/app/models/Solution.ts'
import { Experiment } from '@/app/models/Experiment.ts'

/**
 * Application configuration factory.
 * See README.md section "Internal app configuration" for detailed documentation.
 */
const createAppConfig = () => ({
  core: {
    Experiment: Experiment,
    Instance: Instance,
    Solution: Solution,
    parameters: {
      valuesJsonPath: '/values.json',
      useEtlBackend: false,
      schema: '' as string,
      showDashboardMainView: true,
      showTablesWithoutSchema: false,
      showOpenIdUsername: true,
      showExtraProjectExecutionColumns: {
        showUserName: false,
        showEndCreationDate: true,
        showTimeLimit: true,
        showUserFullName: true,
      },

      allowEditInstance: true,

      latestPlanConfig: {
        enableLatestPlan: true,
        defaultView: 'history-execution',
        showStarInTabBar: true,
      },

      sectionTitles: {
        executions: null as string | null,
        masterData: null as string | null,
        inputData: null as string | null,
        results: null as string | null,
      },

      enableMasterTableMatching: true,
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
      fileProcessors: {},

      enableAutoInstanceDashboard: false,
      enableAutoSolutionDashboard: false,

      tableDashboards: {
        instance: {},
        solution: {},
      },

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
