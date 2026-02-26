import { Instance } from '@/app/models/Instance.ts'
import { Solution } from '@/app/models/Solution.ts'
import { Experiment } from '@/app/models/Experiment.ts'
import type { RouteRecordRaw } from 'vue-router'

/**
 * Definition for an app-specific section (top-level or subsection).
 * Used to build routes and drawer menu dynamically.
 */
export interface AppSectionDef {
  path: string
  name: string
  titleKey: string
  icon: string
  component: () => Promise<unknown>
  subPages?: AppSectionDef[]
}

/**
 * Menu item for the drawer (resolved from AppSectionDef).
 */
export interface AppSectionMenuItem {
  titleKey: string
  icon: string
  to: string
  subPages?: { titleKey: string; icon: string; to: string }[]
}

/**
 * Sub-section definition for a frontend-automation section.
 * Allows adding custom views (e.g. dashboards) inside a section that comes from the schema.
 */
export interface FrontendAutomationSubsectionDef {
  /** URL path segment (e.g. 'dashboard'). Full path will be /configuration/section/{sectionId}/{path}. */
  path: string
  name: string
  titleKey: string
  icon: string
  component: () => Promise<unknown>
}

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
      sendInstanceFilesAsZip: false,

      showTablesWithoutSchema: false,
      showOpenIdUsername: true,
      showExtraProjectExecutionColumns: {
        showUserName: false,
        showEndCreationDate: true,
        showTimeLimit: false,
        showUserFullName: true,
      },

      allowEditInstance: true,

      showDashboardMainView: true,

      latestPlanConfig: {
        enableLatestPlan: false,
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
      // Overridden from schema config when user enters the app (see general store setSchema + applySchemaConfigToAppConfig)
      solverConfig: {
        showSolverStep: true,
        defaultSolver: 'mip.gurobi',
      },
      configFieldsConfig: {
        showConfigFieldsStep: true,
        autoLoadValues: true,
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

  /** Sub-sections to add inside frontend-automation sections (section id -> list of extra views). */
  frontendAutomationSectionSubsections: {} as Record<
    string,
    FrontendAutomationSubsectionDef[]
  >,

  // App-specific sections: top-level sections and subsections (like Agent).
  // Built dynamically in router and drawer. Same pattern as dashboard/instanceDashboard
  // but for standalone sections, not nested under instance/result.
  appSections: [] as AppSectionDef[],
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

  /** App-specific sections for the drawer menu. */
  getAppSections(): AppSectionMenuItem[] {
    const sections = this.ensureConfig().appSections || []
    return sections.map((s) => ({
      titleKey: s.titleKey,
      icon: s.icon,
      to: s.path.startsWith('/') ? s.path : `/${s.path}`,
      subPages: s.subPages?.map((sub) => ({
        titleKey: sub.titleKey,
        icon: sub.icon,
        to: sub.path.startsWith('/') ? sub.path : `/${sub.path}`,
      })),
    }))
  }

  /** Routes for app-specific sections (and their subPages). Used by the router. */
  getAppSectionRoutes(): RouteRecordRaw[] {
    const sections = this.ensureConfig().appSections || []
    const routes: RouteRecordRaw[] = []
    for (const s of sections) {
      routes.push({
        path: s.path.replace(/^\//, ''),
        name: s.name,
        component: s.component,
        keepAlive: true,
      } as RouteRecordRaw)
      for (const sub of s.subPages || []) {
        routes.push({
          path: sub.path.replace(/^\//, ''),
          name: sub.name,
          component: sub.component,
          keepAlive: true,
        } as RouteRecordRaw)
      }
    }
    return routes
  }
}

const appConfig = new Config()
export default appConfig
