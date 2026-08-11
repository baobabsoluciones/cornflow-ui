import { Instance } from '@/app/models/Instance.ts'
import { Solution } from '@/app/models/Solution.ts'
import { Experiment } from '@/app/models/Experiment.ts'
import type { RouteRecordRaw } from 'vue-router'

/**
 * Definition for an app-specific section (top-level or subsection).
 * Used to build routes and drawer menu dynamically.
 */
export interface AppSectionDef {
  /**
   * URL segment for a leaf or a section that has its own view.
   * Omit for a drawer-only group header (parent with `subPages` only).
   */
  path?: string
  name: string
  titleKey: string
  icon: string
  component?: () => Promise<unknown>
  subPages?: AppSectionDef[]
  /**
   * When true, the drawer hides this entry until an execution is selected
   * (same behaviour as Input data / Results).
   */
  requiresSelectedExecution?: boolean
  /**
   * When true, shows a loading overlay on route enter until the view calls
   * `setPageReady()` from `useAppSectionPageReady()`.
   */
  showsLoadingOnEnter?: boolean
}

/**
 * Menu item for the drawer (resolved from AppSectionDef).
 */
export interface AppSectionMenuItem {
  titleKey: string
  icon: string
  /** Omitted when the section is a non-navigable group header (only subPages). */
  to?: string
  subPages?: {
    titleKey: string
    icon: string
    to: string
    requiresSelectedExecution?: boolean
  }[]
  requiresSelectedExecution?: boolean
}

/**
 * A file entry shown in the Help Center download list.
 * Configure via `helpMenuFiles` in `createAppConfig`.
 */
export interface HelpMenuDownloadableFile {
  /** i18n key for the label shown next to the download icon. */
  labelKey: string
  /**
   * Path relative to the public directory. Use `{lang}` as a placeholder
   * if the file varies by locale (e.g. `'manual/user_manual_{lang}.pdf'`).
   */
  publicPath: string
  /** `download` attribute value. Defaults to the filename from `publicPath`. */
  downloadName?: string
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

function normalizeAppSectionPath(path: string | undefined): string | undefined {
  if (path === undefined || path === '') return undefined
  return path.startsWith('/') ? path : `/${path}`
}

function mapAppSectionDefToMenuItem(section: AppSectionDef): AppSectionMenuItem {
  return {
    titleKey: section.titleKey,
    icon: section.icon,
    to: normalizeAppSectionPath(section.path),
    requiresSelectedExecution: section.requiresSelectedExecution === true,
    subPages: section.subPages?.map((sub) => ({
      titleKey: sub.titleKey,
      icon: sub.icon,
      to: normalizeAppSectionPath(sub.path)!,
      requiresSelectedExecution: sub.requiresSelectedExecution === true,
    })),
  }
}

/** Route meta derived from an app section definition. */
export interface AppSectionRouteMeta {
  showsLoadingOnEnter?: boolean
}

function mapAppSectionDefToRouteMeta(
  section: AppSectionDef,
): AppSectionRouteMeta {
  return {
    showsLoadingOnEnter: section.showsLoadingOnEnter === true,
  }
}

function mapAppSectionDefToRoute(section: AppSectionDef): RouteRecordRaw | null {
  if (!section.path || !section.component) return null

  return {
    path: section.path.replace(/^\//, ''),
    name: section.name,
    component: section.component,
    keepAlive: true,
    meta: mapAppSectionDefToRouteMeta(section),
  } as unknown as RouteRecordRaw
}

function collectAppSectionRoutePrefixes(
  sections: AppSectionDef[],
  predicate: (section: AppSectionDef) => boolean,
): string[] {
  const prefixes: string[] = []

  const collect = (items: AppSectionDef[]) => {
    for (const item of items) {
      if (predicate(item) && item.path) {
        const path = normalizeAppSectionPath(item.path)
        if (path) prefixes.push(path)
      }
      if (item.subPages?.length) collect(item.subPages)
    }
  }

  collect(sections)
  return prefixes
}

function collectInstanceDependentAppRoutePrefixes(
  sections: AppSectionDef[],
): string[] {
  return collectAppSectionRoutePrefixes(
    sections,
    (item) => item.requiresSelectedExecution === true,
  )
}

function collectLoadingOnEnterAppRoutePrefixes(
  sections: AppSectionDef[],
): string[] {
  return collectAppSectionRoutePrefixes(
    sections,
    (item) => item.showsLoadingOnEnter === true,
  )
}
/** Declarative rules for master vs uploaded row matching and display normalization (per table key). */
export type MasterTableMatchingDictionaryRule = {
  sourceTable: string
  keyField: string
  valueField: string
  targetFields: string[]
}

export type MasterTableCompareStrategy = {
  matchFields: string[]
  dictionaries?: Record<string, MasterTableMatchingDictionaryRule>
}

export type MasterTableMatchingConfig = {
  compareStrategies: Record<string, MasterTableCompareStrategy>
}

/**
 * A parameter field shown in the ETL “alternative parameters” column of the load instance step.
 * Each field maps to a cell in instance.data via `instancePath` (`tableName.column`).
 * Used in `etl.alternativeParameterFields` in `src/app/config.ts`.
 */
export interface LoadInstanceAlternativeParamField {
  /** Stable id for the form model (unique within the list). */
  id: string
  /** i18n key for the field label. */
  titleKey: string
  /** Optional i18n key for placeholder text. */
  placeholderKey?: string
  type: 'date' | 'text' | 'number'
  /**
   * Target location in instance.data: `tableName.column`, e.g. `parameters.start_date`.
   * Multiple fields with the same table name are merged into one row (first row per table).
   */
  instancePath: string
  /** When true, “Load parameters” is disabled until the value is set. Default true. */
  required?: boolean
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
      /**
       * ETL configuration. Only relevant when useEtlBackend is true.
       * - useEtlBackend: send files to backend ETL; response is used as instance data.
       * - sendInstanceFilesAsZip: zip all files before sending to the ETL endpoint.
       * - enableEtlMetadataAndReview: expect __metadata__ in the ETL response, show the
       *   review step with table/parameter switches, and call POST /etl/update/ on advance.
       * - sendSchema: include the schema name (from config.schema) as a query param (?schema=).
       * - enableLoadFromDb: show “Obtener todos los datos de base de datos” button alongside
       *   “Cargar archivos”. Clicking it calls POST /etl/ with no files (just schema if sendSchema).
       *   Continue is always blocked until the user loads data via either button.
       * - alternativeParameterFields: show a form column next to the dropzone so users can
       *   fill in parameters that are sent as an XLSX to the ETL endpoint instead of uploading.
       *   See README “ETL — load instance step” for full details.
       */
      etl: {
        useEtlBackend: false,
        sendInstanceFilesAsZip: false,
        enableEtlMetadataAndReview: false,
        sendSchema: false,
        enableLoadFromDb: false,
        alternativeParameterFields: [] as LoadInstanceAlternativeParamField[],
      },
      showTablesWithoutSchema: false,
      showOpenIdUsername: true,
      showExtraProjectExecutionColumns: {
        showUserName: false,
        showEndCreationDate: true,
        showTimeLimit: false,
        showUserFullName: true,
      },

      allowEditInstance: true,

      /**
       * When true, downloading an execution's solution/instance fetches a backend-generated
       * zip via `GET /execution/files/<execution_id>/` instead of building Excel files
       * locally from `experiment.downloadExcel(...)`.
       *
       * Backend response semantics (see README — Execution files download):
       * - HTTP 200 (zip): download the response body as a file.
       * - HTTP 400 with `{ status: 0 | -1, error }`: no backend file available. Fall back
       *   to the local Excel generation flow.
       * - HTTP 400 with `{ status: -2 | -3, error }`: files outdated/deleted. Trigger
       *   regeneration through the data-checks-kpis workflow, then retry.
       * - HTTP 404: execution not found / not accessible. Surface the error.
       * - HTTP 501: execution files deactivated for this deployment. Fall back to the
       *   local Excel generation flow.
       *
       * When false, the app keeps the current behavior (local Excel build in
       * `ExecutionRepository.getDataToDownload`).
       */
      useBackendExecutionFilesDownload: false,

      showDashboardMainView: false,

      /**
       * Default landing view after login (route path segment, e.g. 'history-execution').
       * If the user's role forbids this view, the role's own `defaultView` (from rolesConfig) is used,
       * or the first allowed view from the priority list as ultimate fallback.
       */
      defaultView: 'history-execution',

      latestPlanConfig: {
        enableLatestPlan: false,
        showStarInTabBar: false,
        enableUpToDateTracking: false,
      },

      sectionTitles: {
        executions: null as string | null,
        masterData: null as string | null,
        inputData: null as string | null,
        results: null as string | null,
      },

      /** When true, master-data changes show a global banner with a button to start replanning (not automatic). */
      enableRecalculationOnMasterEdit: true,

      enableHistoricalKpis: true,
      enableKpisResponseMerge: true,
      /**
       * Controls how KPI tables are shown in the Results section when the API returns a
       * separate `kpis` object alongside `data`.
       * - 'disabled': No special handling; everything merged into solution.data as-is.
       * - 'separate': Show solution tables, then the KPI tables group, then validations (when present).
       */
      kpiTablesDisplayMode: 'disabled' as 'disabled' | 'separate',

      /**
       * When true, admin users see the Roles Management section in the drawer and can access /roles-management.
       * Set to false to hide it even for admins.
       */
      enableRolesManagement: true,

      /**
       * When true, admins can create, rename, and delete role definitions in Roles Management (left panel).
       * When false, the role list is read-only; user–role assignment (right panel) is unchanged.
       */
      allowEditRoles: false,

      enableWarnings: false,

      enableSolutionRecalculation: false,

      enableMasterTableMatching: false,
      
      /**
       * When true, shows the "Replace master with uploaded data" option next to "Use database data"
       * for tables that support overwrite_all. When the backend returns offer_force_retry (e.g.
       * dependent items), a confirmation dialog allows the user to force overwrite (retry with force=true).
       */
      enableReplaceMasterWithUploaded: false,

        /**
       * When true, the master-data section shows the "Edit all master tables" dropdown action,
       * which opens a single modal to upload / overwrite / bulk-update every master table at once
       * via POST /edit-all-tables/. Independent from `enableReplaceMasterWithUploaded` (that one
       * only controls the per-table "Save to master" action in the instance review step).
       */
        enableEditAllMasterTables: false,

      /**
       * When true, if any instance-check table marked with is_warning=false in the schema
       * contains rows after checks run, the user is blocked from advancing to the next step.
       * Requires the parent stepper to listen to the 'blocking-errors' emit from CreateExecutionCheckData.
       */
      enableBlockAdvanceOnCheckErrors: false,

      /**
       * Master table matching: optional per-table business keys (`matchFields`) and
       * dictionary-based display normalization before diff (see `applyMasterTableDisplayNormalization` in schemaUtils).
       */
      masterTableMatchingConfig: {
        compareStrategies: {},
      } satisfies MasterTableMatchingConfig,

      /**
       * Agent (core): disabled by default. `runtime` is an optional scaffold so each deployment
       * only fills paths/adapters. Add `mentions` only with a real `adapter` and/or non-empty
       * `sources` (each entry must supply `listPath`, `rowMapping`, `outgoingTemplate`, etc.).
       */
      agent: {
        enabled: false as boolean,
        runtime: {
          stream: {
            // isExternal: false, // true → GET/POST under {backend}/external/...
            // path: '/agent/', // defaults to `/agent/` in AgentRepository
          },
          // @-mentions: enable with `adapter` + `listPath`, or non-empty `sources[]`.
          // mentions: {
          //   defaultLimit: 200,
          //   listPath: '/your-list-endpoint/',
          //   adapter: createHttpListMentionsAdapter({
          //     idKeys: ['id'],
          //     labelKeys: ['name', 'label'],
          //     aliasKeyGroups: [['code', 'alias']],
          //   }),
          //   // outgoingTemplate: 'entity id {id}',
          //   // sources: [
          //   //   {
          //   //     key: 'list_a',
          //   //     listPath: '/other-list/',
          //   //     rowMapping: { idKeys: ['id'], labelKeys: ['name'] },
          //   //     outgoingTemplate: 'record_ref {id}',
          //   //   },
          //   // ],
          // },
          // ui: {
          //   showResponseTime: true,
          // },
        },
      },

      // Overridden from schema config when user enters the app (see general store setSchema + applySchemaConfigToAppConfig)
      solverConfig: {
        showSolverStep: true,
        defaultSolver: 'mip.gurobi',
      },
      configFieldsConfig: {
        showConfigFieldsStep: true,
        autoLoadValues: false,
      },
      executionSolvers: ['mip.gurobi'],
      configFields: [
        {
          key: 'timeLimit',
          title: 'projectExecution.steps.step7.time',
          placeholder: 'projectExecution.steps.step7.timeLimitPlaceholder',
          suffix: 'projectExecution.steps.step7.secondsSuffix',
          // Optional: set minutes: true to use/display timeLimit in minutes.
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

  /**
   * Files shown in the Help Center download list.
   * Each entry renders as a download link with an icon.
   * Use `{lang}` in `publicPath` for language-aware files.
   */
  helpMenuFiles: [
    {
      labelKey: 'helpMenu.download',
      publicPath: 'manual/user_manual_{lang}.pdf',
      downloadName: 'user_manual.pdf',
    },
  ] as HelpMenuDownloadableFile[],

  /** Drawer links for extra dashboard tabs (title + route). Usually paired with `dashboardRoutes`. */
  dashboardPages: [],
  /** Child routes under `/` for custom dashboards; import your views here per project. */
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
    return sections.map(mapAppSectionDefToMenuItem)
  }

  /**
   * Route prefixes for app-specific pages that require a selected execution.
   * Used by IndexView to redirect to history when the instance is cleared.
   */
  getInstanceDependentAppRoutePrefixes(): string[] {
    const sections = this.ensureConfig().appSections || []
    return collectInstanceDependentAppRoutePrefixes(sections)
  }

  /**
   * Route prefixes for app-specific pages that show a loading overlay on enter.
   * Used by AppView and `useAppSectionPageReady()`.
   */
  getLoadingOnEnterAppRoutePrefixes(): string[] {
    const sections = this.ensureConfig().appSections || []
    return collectLoadingOnEnterAppRoutePrefixes(sections)
  }

  /** Whether the given path belongs to an app section with `showsLoadingOnEnter`. */
  isAppSectionShowsLoadingOnEnter(path: string): boolean {
    return this.getLoadingOnEnterAppRoutePrefixes().some((prefix) =>
      path.startsWith(prefix),
    )
  }

  /** Routes for app-specific sections (and their subPages). Used by the router. */
  getAppSectionRoutes(): RouteRecordRaw[] {
    const sections = this.ensureConfig().appSections || []
    const routes: RouteRecordRaw[] = []

    for (const section of sections) {
      const route = mapAppSectionDefToRoute(section)
      if (route) routes.push(route)

      for (const subPage of section.subPages || []) {
        const subRoute = mapAppSectionDefToRoute(subPage)
        if (subRoute) routes.push(subRoute)
      }
    }

    return routes
  }

  /** Sub-sections for a frontend-automation section (for drawer menu and route resolution). */
  getFrontendAutomationSectionSubsections(
    sectionId: string,
  ): FrontendAutomationSubsectionDef[] {
    const map = this.ensureConfig().frontendAutomationSectionSubsections ?? {}
    return map[sectionId] ?? []
  }

  /** Get a single subsection def by section id and path segment. Used by the subsection wrapper view. */
  getFrontendAutomationSubsectionDef(
    sectionId: string,
    subsectionPath: string,
  ): FrontendAutomationSubsectionDef | null {
    const list = this.getFrontendAutomationSectionSubsections(sectionId)
    return list.find((def) => def.path === subsectionPath) ?? null
  }

  getHelpMenuFiles(): HelpMenuDownloadableFile[] {
    return this.ensureConfig().helpMenuFiles ?? []
  }
}

const appConfig = new Config()
export default appConfig
