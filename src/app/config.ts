import { Instance } from '@/app/models/Instance.ts'
import { Solution } from '@/app/models/Solution.ts'
import { Experiment } from '@/app/models/Experiment.ts'
import i18n from '@/plugins/i18n'

// Create a function to get the app configuration
const createAppConfig = () => ({
  core: {
    Experiment: Experiment,
    Instance: Instance,
    Solution: Solution,
    parameters: {
      // Internal app configuration (not configurable via env vars/values.json)
      valuesJsonPath: '/values.json',
      
      // Project execution table configuration
      showUserFullName: true,
      showTablesWithoutSchema: false,
      showDashboardMainView: true,
      showExtraProjectExecutionColumns: {
        showUserName: false,
        showEndCreationDate: false,
        showTimeLimit: true,
        showUserFullName: false,
      },

      // Create new execution steps configuration
      solverConfig: {
        showSolverStep: true,
        defaultSolver: 'mip',
      },
      configFieldsConfig: {
        showConfigFieldsStep: true,
        autoLoadValues: false,
      },
      executionSolvers: ['mip.gurobi'],
      configFields: [
        {
          key: 'timeLimit',
          title: 'projectExecution.steps.step6.time',
          placeholder: 'projectExecution.steps.step6.timeLimitPlaceholder',
          suffix: 'projectExecution.steps.step6.secondsSuffix',
          icon: 'mdi-timer-sand',
          type: 'number',
        },
      ],
      fileProcessors: {
        // Define filename prefixes that need special processing and their corresponding processor methods
      },

      // Execution states configuration
      executionStates: {
        '1': {
          color: 'green',
          message: i18n.global.t('executionTable.executionSolvedCorrectly'),
          code: i18n.global.t('executionTable.success'),
        },
        '0': {
          color: 'purple',
          message: i18n.global.t('executionTable.executionRunning'),
          code: i18n.global.t('executionTable.loading'),
        },
        '-1': {
          color: 'red',
          message: i18n.global.t('executionTable.executionError'),
          code: i18n.global.t('executionTable.error'),
        },
        '-2': {
          color: 'red',
          message: i18n.global.t('executionTable.executionStopped'),
          code: i18n.global.t('executionTable.error'),
        },
        '-3': {
          color: 'red',
          message: i18n.global.t('executionTable.executionNotStarted'),
          code: i18n.global.t('executionTable.error'),
        },
        '-4': {
          color: 'orange',
          message: i18n.global.t('executionTable.executionNotRun'),
          code: i18n.global.t('executionTable.notRunByUser'),
        },
        '-5': {
          color: 'red',
          message: i18n.global.t('executionTable.executionUnknownError'),
          code: i18n.global.t('executionTable.error'),
        },
        '-6': {
          color: 'red',
          message: i18n.global.t('executionTable.executionFailedSaving'),
          code: i18n.global.t('executionTable.error'),
        },
        '2': {
          color: 'green',
          message: i18n.global.t('executionTable.executionLoadedManually'),
          code: i18n.global.t('executionTable.success'),
        },
        '-7': {
          color: 'red',
          message: i18n.global.t('executionTable.executionQueued'),
          code: i18n.global.t('executionTable.loading'),
        },
      },
      solutionStates: {
        1: {
          color: 'green',
          code: i18n.global.t('executionTable.optimal'),
          message: i18n.global.t('executionTable.optimalTooltip'),
        },
        5: {
          color: 'orange',
          code: i18n.global.t('executionTable.timeLimit'),
          message: i18n.global.t('executionTable.timeLimitTooltip'),
        },
        '-1': {
          color: 'red',
          code: i18n.global.t('executionTable.infeasible'),
          message: i18n.global.t('executionTable.infeasibleTooltip'),
        },
        '-3': {
          color: 'grey',
          code: i18n.global.t('executionTable.unknown'),
          message: i18n.global.t('executionTable.unknownTooltip'),
        },
        0: {
          color: 'grey',
          code: i18n.global.t('executionTable.notSolved'),
          message: i18n.global.t('executionTable.notSolvedTooltip'),
        },
        '-2': {
          color: 'red',
          code: i18n.global.t('executionTable.unbounded'),
          message: i18n.global.t('executionTable.unboundedTooltip'),
        },
        2: {
          color: 'green',
          code: i18n.global.t('executionTable.feasible'),
          message: i18n.global.t('executionTable.feasibleTooltip'),
        },
        3: {
          color: 'orange',
          code: i18n.global.t('executionTable.memoryLimit'),
          message: i18n.global.t('executionTable.memoryLimitTooltip'),
        },
        4: {
          color: 'orange',
          code: i18n.global.t('executionTable.nodeLimit'),
          message: i18n.global.t('executionTable.nodeLimitTooltip'),
        },
        '-5': {
          color: 'red',
          code: i18n.global.t('executionTable.licensingProblem'),
          message: i18n.global.t('executionTable.licensingProblemTooltip'),
        },
        '-4': {
          color: 'orange',
          code: i18n.global.t('executionTable.notRunByUser'),
          message: i18n.global.t('executionTable.notRunByUserTooltip'),
        },
      },
    },
  },

  // Dashboard configuration
  dashboardPages: [],
  dashboardRoutes: [],
  dashboardLayout: [],
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
}

const appConfig = new Config()
export default appConfig
