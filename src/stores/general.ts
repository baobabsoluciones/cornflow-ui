import { defineStore, acceptHMRUpdate } from 'pinia'
import { markRaw } from 'vue'
import session from '@cornflow-ui/core/services/AuthService'
import appConfig from '@/app/config'
import config from '@cornflow-ui/core/config'
import { mainLogo as logo, fullLogo } from '@cornflow-ui/core/utils/assets'

import { SchemaConfig } from '@cornflow-ui/core/models/SchemaConfig'
import { Execution } from '@cornflow-ui/core/models/Execution'
import { LoadedExecution } from '@cornflow-ui/core/models/LoadedExecution'

import SchemaRepository from '@cornflow-ui/core/repositories/SchemaRepository'
import UserRepository from '@cornflow-ui/core/repositories/UserRepository'
import ExecutionRepository from '@cornflow-ui/core/repositories/ExecutionRepository'
import InstanceRepository from '@cornflow-ui/core/repositories/InstanceRepository'
import LicenceRepository from '@cornflow-ui/core/repositories/LicenceRepository'
import VersionRepository from '@cornflow-ui/core/repositories/VersionRepository'
import {
  runPremiumInitialDataHooks,
  runPremiumActiveSchemaChangedHooks,
  runPremiumGlobalContextChangedHooks,
  loadPremiumMasterDataConfig,
} from '@cornflow-ui/core/plugins/extensions'
import RoleRepository from '@cornflow-ui/core/repositories/RoleRepository'
import WarningsRepository from '@cornflow-ui/core/repositories/WarningsRepository'
import type { Warning } from '@cornflow-ui/core/repositories/WarningsRepository'
import GlobalContextRepository from '@cornflow-ui/core/repositories/GlobalContextRepository'
import type {
  GlobalContextDimension,
  GlobalContextOption,
  GlobalContextValues,
} from '@cornflow-ui/core/types/globalContext'
import {
  readGlobalContextDimensions,
  hasContextValue,
  isSameContextValue,
  toContextConfig,
  toContextQueryParams,
} from '@cornflow-ui/core/utils/globalContext'

import { toUTCDayBoundary } from '@cornflow-ui/core/utils/date'

// Import utility functions
import {
  ConfigurationData,
  AutomationSectionDef,
  AutomationGroupDef,
} from '@cornflow-ui/core/types/frontendAutomation'
import { TableSchema } from '@cornflow-ui/core/config/views'
import { i18n, locale } from '@cornflow-ui/core/plugins/i18n'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import {
  resolveTableConfigTitles,
  getExecutionConfigFromSchemaConfig,
  mergeAppConfigFields,
  type ExecutionConfigField,
} from '@cornflow-ui/core/utils/schemaUtils'
import {
  filterTablesByUserSchemas,
  filterTablesByCurrentSchema,
} from '@cornflow-ui/core/services/FrontendAutomationService'
import { hasAnyChecksData } from '@cornflow-ui/core/utils/dataChecks'

export type HistoricalBannerMode =
  | 'idle'
  | 'creating'
  | 'data_check'
  | 'polling'
  | 'done'
  | 'checks_error'
  | 'checks_warning'
  | 'error'

export interface HistoricalState {
  execution: LoadedExecution | null
  dateRange: { from: string; to: string }
  bannerMode: HistoricalBannerMode
  executionId: string | null
  errorMessage: string | null
  checksData: Record<string, any[]> | null
  /** Keys of check tables defined as is_warning:true in the schema (warnings only, not errors). */
  checksWarningKeys: string[] | null
}

function extractWarningKeysFromSchema(solutionChecksSchema: any): string[] {
  if (!solutionChecksSchema?.properties) return []
  return Object.entries(solutionChecksSchema.properties)
    .filter(([, prop]: [string, any]) => prop?.is_warning === true)
    .map(([key]) => key)
}

function buildNonEmptyChecksMap(dataChecks: any): Record<string, any[]> {
  const checksMap: Record<string, any[]> = {}
  if (dataChecks && typeof dataChecks === 'object') {
    for (const [key, val] of Object.entries(dataChecks)) {
      if (Array.isArray(val) && val.length > 0) {
        checksMap[key] = val
      }
    }
  }
  return checksMap
}

const HISTORICAL_POLL_MS = 4000
let historicalPollTimer: ReturnType<typeof setTimeout> | null = null

// Module-scoped mirror of the store's auto-load interval so it can be cleared
// on hot-module replacement (see the `import.meta.hot` block at the bottom).
// Without this, Vite HMR leaves the previous module's `setInterval` running
// during development, stacking up zombie pollers that flood the backend.
let autoLoadPollTimer: ReturnType<typeof setInterval> | null = null

function clearHistoricalPollTimer() {
  if (historicalPollTimer) {
    clearTimeout(historicalPollTimer)
    historicalPollTimer = null
  }
}

/** sessionStorage key of the DAG the session works on (only with several DAGs). */
const ACTIVE_SCHEMA_STORAGE_KEY = 'activeSchema'
/** sessionStorage key prefix of the picked global-context values, one entry per DAG. */
const GLOBAL_CONTEXT_STORAGE_PREFIX = 'globalContext:'

function readStoredActiveSchema(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_SCHEMA_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeActiveSchema(schema: string): void {
  try {
    sessionStorage.setItem(ACTIVE_SCHEMA_STORAGE_KEY, schema)
  } catch {
    /* storage unavailable: the choice lasts until the page is reloaded */
  }
}

function readStoredContext(schema: string): GlobalContextValues {
  try {
    const stored = sessionStorage.getItem(GLOBAL_CONTEXT_STORAGE_PREFIX + schema)
    const parsed = stored ? JSON.parse(stored) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function storeContext(schema: string, values: GlobalContextValues): void {
  try {
    sessionStorage.setItem(
      GLOBAL_CONTEXT_STORAGE_PREFIX + schema,
      JSON.stringify(values),
    )
  } catch {
    /* storage unavailable: the choice lasts until the page is reloaded */
  }
}

function clearStoredSessionChoices(): void {
  try {
    sessionStorage.removeItem(ACTIVE_SCHEMA_STORAGE_KEY)
    const contextKeys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(GLOBAL_CONTEXT_STORAGE_PREFIX)) contextKeys.push(key)
    }
    contextKeys.forEach((key) => sessionStorage.removeItem(key))
  } catch {
    /* storage unavailable: nothing was kept */
  }
}

/**
 * Value a dimension starts with: the previous one while the user may still pick it; otherwise
 * "All" when the dimension allows it, or the first option.
 */
function pickContextValue(
  dimension: GlobalContextDimension,
  options: GlobalContextOption[],
  previous: unknown,
): unknown {
  if (hasContextValue(previous)) {
    const kept = options.find((option) => isSameContextValue(option.value, previous))
    if (kept) return kept.value
  }
  if (dimension.allowEmpty) return null
  return options[0]?.value ?? null
}

/** Settings the schema config overrides, as the app declares them (see `restoreAppSolverDefaults`). */
function snapshotAppSolverDefaults(parameters: Record<string, any>) {
  return {
    defaultSolver: parameters?.solverConfig?.defaultSolver as string | undefined,
    executionSolvers: [...((parameters?.executionSolvers as string[]) ?? [])],
  }
}

export const useGeneralStore = defineStore('general', {
  state: () => ({
    schemaRepository: new SchemaRepository(),
    executionRepository: new ExecutionRepository(),
    instanceRepository: new InstanceRepository(),
    userRepository: new UserRepository(),
    licenceRepository: new LicenceRepository(),
    versionRepository: new VersionRepository(),
    roleRepository: new RoleRepository(),
    warningsRepository: new WarningsRepository(),
    globalContextRepository: new GlobalContextRepository(),
    warnings: [] as Warning[],
    notifications: [] as {
      message: string
      type: 'success' | 'warning' | 'info' | 'error'
    }[],
    licences: [],
    user: {},
    logo: logo,
    fullLogo: fullLogo,
    /** DAG the session works on; empty means `config.schema`. */
    schema: '',
    /** DAG the deployment opens with (`config.schema` before any switch). */
    defaultSchema: config.schema,
    /**
     * DAGs of `config.schemas` the user may switch between. Empty unless the deployment lists
     * several DAGs.
     */
    availableSchemas: [] as string[],
    /** True when the deployment lists several DAGs and Cornflow grants the user none of them. */
    noSchemaAccess: false,
    schemaConfig: {} as SchemaConfig,
    appConfig: appConfig.getCore(),
    /**
     * `configFields` as `src/app/config.ts` declares them. `applySchemaConfigToAppConfig` merges
     * them with the schema's, so they are kept apart from `appConfig.parameters.configFields`.
     */
    appConfigFields: (appConfig.getCore().parameters.configFields ??
      []) as ExecutionConfigField[],
    /** Solver settings as `src/app/config.ts` declares them (see `restoreAppSolverDefaults`). */
    appSolverDefaults: snapshotAppSolverDefaults(appConfig.getCore().parameters),
    /** Picked value per global-context dimension; `null` is "All". Empty without a global context. */
    globalContext: {} as GlobalContextValues,
    /** Options the user may pick, per global-context dimension. */
    globalContextOptions: {} as Record<string, GlobalContextOption[]>,
    appDashboardRoutes: appConfig.getDashboardRoutes(),
    appDashboardPages: appConfig.getDashboardPages(),
    appDashboardLayout: appConfig.getDashboardLayout(),
    appInstanceDashboardRoutes: appConfig.getInstanceDashboardRoutes(),
    appInstanceDashboardPages: appConfig.getInstanceDashboardPages(),
    appInstanceDashboardLayout: appConfig.getInstanceDashboardLayout(),
    lastExecutions: [] as Execution[],
    loadedExecutions: [] as LoadedExecution[],
    selectedExecution: null,
    autoLoadInterval: null,
    /** Guards against overlapping auto-load ticks when a poll is still in flight. */
    autoLoadTickInFlight: false,
    isDrawerPinned: false, // New state for drawer pin status
    uploadComponentKey: 0,
    tabBarKey: 0,
    cornflowVersion: '',
    configurations: null as ConfigurationData | null,
    rawConfigurations: null as ConfigurationData | null, // Store raw configurations with original multilingual data
    /** Section definitions from frontend-automation (available_automations.sections). When set, drawer shows these sections above the default Master data block. Sorted by order. */
    masterDataSections: null as AutomationSectionDef[] | null,
    /** Group definitions from frontend-automation (available_automations.groups). Used to sort groups within sections. Sorted by order. */
    masterDataGroups: null as AutomationGroupDef[] | null,
    /** True while initial data (schema, configurations, drawer tables) is loading after login. */
    initialDataLoading: false,
    /** True once initializeData has been called at least once (prevents duplicate fetches). */
    dataInitialized: false,

    /** Historical KPIs execution state (persists across navigation). */
    historical: {
      execution: null,
      dateRange: { from: '', to: '' },
      bannerMode: 'idle',
      executionId: null,
      errorMessage: null,
      checksData: null,
      checksWarningKeys: null,
    } as HistoricalState,
  }),
  actions: {
    async initializeData() {
      if (this.dataInitialized) return
      this.dataInitialized = true
      this.initialDataLoading = true
      try {
        // Ensure the API client has the token loaded
        const apiClient = await import('@cornflow-ui/core/api/Api')
        apiClient.default.initializeToken?.()

        await this.fetchUser()
        await this.fetchCornflowVersion()
        await this.resolveActiveSchema()
        if (!this.noSchemaAccess) {
          await this.setSchema()
          await this.setConfigurations()
          await this.loadGlobalContext()
        }
        await this.fetchLicences()
        await this.fetchWarnings()

        // Let premium modules run their post-login init (e.g. latest-plan
        // prefetch). The core does not know about any specific module.
        await runPremiumInitialDataHooks()
      } finally {
        this.initialDataLoading = false
      }
    },

    async fetchWarnings() {
      if (!this.appConfig.parameters.enableWarnings) return
      try {
        this.warnings = await this.warningsRepository.getWarnings()
      } catch {
        this.warnings = []
      }
    },

    async fetchUser() {
      try {
        const userId = session.getUserId()
        const [user, allAssignments] = await Promise.all([
          this.userRepository.getUserById(userId),
          this.roleRepository.getAllUserRoleAssignments().catch(() => [] as import('@cornflow-ui/core/repositories/RoleRepository').UserRoleAssignment[]),
        ])
        // Filter assignments that belong to the current user
        const myAssignments = allAssignments.filter(
          (a) => String(a.user_id) === String(userId),
        )
        user.roles = myAssignments.map((a) => ({ id: a.role_id, name: a.role }))
        this.user = user

        // Derive admin status and role names; persist both for route guards (available before store is ready)
        const isAdmin = myAssignments.some((a: import('@cornflow-ui/core/repositories/RoleRepository').UserRoleAssignment) => a.role === 'admin')
        sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false')
        const roleNames = myAssignments.map((a: import('@cornflow-ui/core/repositories/RoleRepository').UserRoleAssignment) => a.role)
        sessionStorage.setItem('userRoles', JSON.stringify(roleNames))
      } catch (error) {
        console.error('Error getting user', error)
      }
    },

    async fetchCornflowVersion() {
      try {
        const version = await this.versionRepository.getCornflowVersion()
        this.cornflowVersion = version
      } catch (error) {
        console.error('Error getting cornflow version', error)
      }
    },

    /**
     * Decides the DAG the session starts on. Only when the deployment lists several DAGs
     * (`schema` with several names, see `config.schemas`): asks Cornflow which ones the user may
     * use (`GET /schema/`) and enters
     * the one kept from earlier in the session, else `config.schema`, else the first granted.
     * With a single DAG it does nothing and makes no request.
     */
    async resolveActiveSchema() {
      this.noSchemaAccess = false
      if (!this.isMultiSchemaDeployment) {
        this.availableSchemas = []
        return
      }

      let granted: string[]
      try {
        granted = await this.schemaRepository.getAvailableSchemaNames()
      } catch (error) {
        // Without an answer from Cornflow the session stays on the default DAG, with no switcher;
        // the backend still decides what the user may do there.
        console.error('Error getting the schemas of the user', error)
        this.availableSchemas = this.defaultSchema ? [this.defaultSchema] : []
        this.applyActiveSchema(this.defaultSchema)
        return
      }

      if (this.user && typeof this.user === 'object') {
        ;(this.user as { schemas?: string[] }).schemas = granted
      }
      this.availableSchemas = (config.schemas ?? []).filter((schema) =>
        granted.includes(schema),
      )
      if (this.availableSchemas.length === 0) {
        this.noSchemaAccess = true
        return
      }

      const initial =
        [readStoredActiveSchema(), this.defaultSchema].find(
          (schema) => schema && this.availableSchemas.includes(schema),
        ) ?? this.availableSchemas[0]
      this.applyActiveSchema(initial)
    },

    /**
     * Points the session at `schema`. `config.schema` follows it because premium modules read it
     * (e.g. the ETL `?schema=` parameter).
     */
    applyActiveSchema(schema: string) {
      this.schema = schema
      config.schema = schema
      if (schema) storeActiveSchema(schema)
    },

    /**
     * Switches the session to another DAG without reloading the page: closes the loaded
     * executions, reloads the schema and its instance/solution tables, the global-context options
     * and the views, and lets premium modules reset what they keep per DAG. Navigation is up to
     * the caller (see `ContextBar`). Returns false when `schema` is not one the user may switch to.
     */
    async setActiveSchema(schema: string): Promise<boolean> {
      if (schema === this.getSchemaName || !this.availableSchemas.includes(schema)) {
        return false
      }

      this.closeExecutionSession()
      this.applyActiveSchema(schema)
      this.schemaConfig = {} as SchemaConfig
      this.restoreAppSolverDefaults()
      await this.setSchema()
      const { inputData, resultsData } = await this.fetchSchemaTables()
      this.rawConfigurations = {
        masterData: this.rawConfigurations?.masterData ?? ({} as TableSchema),
        inputData,
        resultsData,
      }
      this.updateLocalizedConfigurations()
      await this.loadGlobalContext()
      this.incrementUploadComponentKey()
      await runPremiumActiveSchemaChangedHooks(schema)
      return true
    },

    /** Closes the loaded executions, the selection, the pollers and the historical KPIs. */
    closeExecutionSession() {
      this.stopAutoLoadExecutions()
      this.resetLoadedExecutions()
      this.setSelectedExecution(null)
      this.lastExecutions = []
      this.clearHistoricalExecution()
      this.incrementTabBarKey()
    },

    /**
     * Puts back the solver settings and config fields of `src/app/config.ts`, so a schema without
     * config does not inherit those of the schema loaded before it.
     */
    restoreAppSolverDefaults() {
      const parameters = this.appConfig.parameters
      if (this.appSolverDefaults.defaultSolver !== undefined) {
        parameters.solverConfig = {
          ...parameters.solverConfig,
          defaultSolver: this.appSolverDefaults.defaultSolver,
        }
      }
      parameters.executionSolvers = [...this.appSolverDefaults.executionSolvers]
      parameters.configFields = [...this.appConfigFields]
    },

    /**
     * Loads the options of every global-context dimension for the active DAG and picks a value for
     * each: the one kept from earlier in the session if the user may still pick it, else "All"
     * (`allowEmpty`) or the first option. Without a global context it does nothing.
     */
    async loadGlobalContext() {
      const dimensions = readGlobalContextDimensions()
      if (dimensions.length === 0) return

      const { values, options } = await this.resolveGlobalContextDimensions(
        dimensions,
        {},
        readStoredContext(this.getSchemaName),
      )
      this.globalContextOptions = options
      this.globalContext = values
      storeContext(this.getSchemaName, values)
    },

    /**
     * Fetches the options of `dimensions` and picks a value for each, starting from `previous`.
     * A dimension waits only for the dimension it depends on, taken from `fixed` or resolved here;
     * the others are requested at the same time.
     */
    async resolveGlobalContextDimensions(
      dimensions: GlobalContextDimension[],
      fixed: GlobalContextValues,
      previous: GlobalContextValues,
    ): Promise<{
      values: GlobalContextValues
      options: Record<string, GlobalContextOption[]>
    }> {
      const valueOf = new Map<string, Promise<unknown>>(
        Object.entries(fixed).map(([key, value]) => [key, Promise.resolve(value)]),
      )
      const resolved = dimensions.map((dimension) => {
        const parentValue =
          (dimension.dependsOn && valueOf.get(dimension.dependsOn)) ||
          Promise.resolve(undefined)
        const result = parentValue.then(async (parent) => {
          const options = await this.fetchGlobalContextOptions(dimension, parent)
          const value = pickContextValue(dimension, options, previous[dimension.key])
          return { key: dimension.key, options, value }
        })
        valueOf.set(
          dimension.key,
          result.then(({ value }) => value),
        )
        return result
      })

      const values: GlobalContextValues = { ...fixed }
      const options: Record<string, GlobalContextOption[]> = {}
      for (const result of await Promise.all(resolved)) {
        values[result.key] = result.value
        options[result.key] = result.options
      }
      return { values, options }
    },

    async fetchGlobalContextOptions(
      dimension: GlobalContextDimension,
      parentValue: unknown,
    ): Promise<GlobalContextOption[]> {
      const params: Record<string, string> = { schema: this.getSchemaName }
      if (dimension.dependsOn && hasContextValue(parentValue)) {
        params[dimension.dependsOn] = String(parentValue)
      }
      try {
        return await this.globalContextRepository.getOptions(dimension, params)
      } catch (error) {
        console.error(`Error getting the options of ${dimension.key}`, error)
        return []
      }
    },

    /**
     * Picks another value for a global-context dimension (`null` is "All", only with
     * `allowEmpty`). Reloads the options of the dimensions that depend on it, closes the loaded
     * executions of another value, reloads the views (executions list, master data) and notifies
     * premium modules. Returns false when the value is not one the user may pick.
     */
    async setGlobalContextValue(key: string, value: unknown): Promise<boolean> {
      const dimensions = readGlobalContextDimensions()
      const index = dimensions.findIndex((dimension) => dimension.key === key)
      if (index === -1) return false
      const dimension = dimensions[index]
      const isAllowed =
        value === null
          ? dimension.allowEmpty === true
          : (this.globalContextOptions[key] ?? []).some((option) =>
              isSameContextValue(option.value, value),
            )
      if (!isAllowed) return false

      // The dimensions that depend on this one, directly or through another, get new options.
      const changed = new Set([key])
      const dependents: GlobalContextDimension[] = []
      for (const candidate of dimensions.slice(index + 1)) {
        if (candidate.dependsOn && changed.has(candidate.dependsOn)) {
          dependents.push(candidate)
          changed.add(candidate.key)
        }
      }
      const fixed = Object.fromEntries(
        Object.entries({ ...this.globalContext, [key]: value }).filter(
          ([dimensionKey]) => !dependents.some((d) => d.key === dimensionKey),
        ),
      )
      const resolved = await this.resolveGlobalContextDimensions(
        dependents,
        fixed,
        this.globalContext,
      )
      const values = resolved.values

      this.globalContextOptions = {
        ...this.globalContextOptions,
        ...resolved.options,
      }
      this.globalContext = values
      storeContext(this.getSchemaName, values)
      this.closeExecutionsOutsideContext()
      this.lastExecutions = []
      this.incrementUploadComponentKey()
      await runPremiumGlobalContextChangedHooks(this.getGlobalContextConfig)
      return true
    },

    /**
     * Closes the loaded executions whose config holds another value of a picked dimension, so the
     * tabs never show an execution the selector does not describe. Executions that carry no value
     * for a dimension stay open.
     */
    closeExecutionsOutsideContext() {
      const picked = Object.entries(this.getGlobalContextConfig)
      const kept = this.loadedExecutions.filter((execution) =>
        picked.every(([key, value]) => {
          const executionValue = (execution.config as Record<string, unknown>)?.[key]
          return (
            !hasContextValue(executionValue) ||
            isSameContextValue(executionValue, value)
          )
        }),
      )
      if (kept.length === this.loadedExecutions.length) return

      this.loadedExecutions = kept
      const selectedId = this.selectedExecution?.executionId
      if (selectedId && !kept.some((execution) => execution.executionId === selectedId)) {
        this.setSelectedExecution(null)
      }
      if (kept.length === 0) this.stopAutoLoadExecutions()
      this.incrementTabBarKey()
    },

    /**
     * Empties everything that belongs to the logged-in user, so the next login in the same tab
     * loads its own user, roles, DAG and configurations. Called from the sign-in page, where every
     * way out of a session (logout, expired token, 401) ends.
     */
    resetSessionState() {
      this.closeExecutionSession()
      this.user = {}
      this.licences = []
      this.warnings = []
      this.schema = ''
      config.schema = this.defaultSchema
      this.schemaConfig = {} as SchemaConfig
      this.restoreAppSolverDefaults()
      this.configurations = null
      this.rawConfigurations = null
      this.masterDataSections = null
      this.masterDataGroups = null
      this.availableSchemas = []
      this.noSchemaAccess = false
      this.globalContext = {}
      this.globalContextOptions = {}
      this.initialDataLoading = false
      this.dataInitialized = false
      clearStoredSessionChoices()
    },

    async fetchLicences() {
      try {
        this.licences = await this.licenceRepository.getLicences()
      } catch (error) {
        console.error('Error getting licences', error)
      }
    },

    async changeUserPassword(userId: string, password: string) {
      try {
        const response = await this.userRepository.changePassword(
          userId,
          password,
        )
        return response
      } catch (error) {
        console.error('Error changing password', error)
        return false
      }
    },

    async setSchema() {
      try {
        const schema = await this.schemaRepository.getSchema(this.getSchemaName)
        this.schemaConfig = schema
        this.applySchemaConfigToAppConfig()
      } catch (error) {
        console.error('Error getting schema', error)
      }
    },

    /**
     * Updates app config parameters (solverConfig, executionSolvers, configFields) from the
     * schema's config when available, so the UI uses the backend schema as source of truth.
     * The app's config fields with a `source` or a `default` are kept on top of the schema's
     * (see `mergeAppConfigFields`).
     */
    applySchemaConfigToAppConfig() {
      const derived = getExecutionConfigFromSchemaConfig(
        this.schemaConfig?.config,
      )
      if (!derived) return

      this.appConfig.parameters.solverConfig = {
        ...this.appConfig.parameters.solverConfig,
        defaultSolver: derived.solverConfig.defaultSolver,
      }
      this.appConfig.parameters.executionSolvers = derived.executionSolvers
      this.appConfig.parameters.configFields = mergeAppConfigFields(
        derived.configFields,
        this.appConfigFields,
      )
    },

    async setConfigurations() {
      try {
        // Get master data, sections and groups from the frontend-automation
        // premium module (via the extension registry). Without it, the core runs
        // with no master-data (non-premium behaviour).
        let masterData: TableSchema = {}
        let masterDataSections: AutomationSectionDef[] | null = null
        let masterDataGroups: AutomationGroupDef[] | null = null
        try {
          const result = await loadPremiumMasterDataConfig()
          if (result) {
            masterData = result.config ?? {}
            masterDataSections =
              result.sections && result.sections.length > 0
                ? result.sections
                : null
            masterDataGroups =
              result.groups && result.groups.length > 0 ? result.groups : null
          }
        } catch (error) {
          console.warn('Frontend automation not available:', error)
          masterData = {}
        }

        // Get instance and solution data from schema (may be empty if not available)
        const { inputData, resultsData } = await this.fetchSchemaTables()

        // Store raw configurations with original multilingual data and section definitions
        this.rawConfigurations = {
          masterData: masterData || {},
          inputData: inputData || {},
          resultsData: resultsData || {},
        }
        this.masterDataSections = masterDataSections
        this.masterDataGroups = masterDataGroups

        // Create localized configurations
        this.updateLocalizedConfigurations()
      } catch (error) {
        console.error('Error getting configurations', error)
        // Initialize with empty configurations if everything fails
        this.rawConfigurations = {
          masterData: {} as TableSchema,
          inputData: {} as TableSchema,
          resultsData: {} as TableSchema,
        }
        this.masterDataSections = null
        this.masterDataGroups = null
        this.updateLocalizedConfigurations()
      }
    },

    /** Instance and solution tables of the active schema; each is empty when it is not available. */
    async fetchSchemaTables(): Promise<{
      inputData: TableSchema
      resultsData: TableSchema
    }> {
      let inputData = {} as TableSchema
      let resultsData = {} as TableSchema

      try {
        inputData =
          (await this.schemaRepository.getInstanceTables(this.getSchemaName)) ||
          {}
      } catch (error) {
        console.warn('Instance tables not available:', error)
      }

      try {
        resultsData =
          (await this.schemaRepository.getSolutionTables(this.getSchemaName)) ||
          {}
      } catch (error) {
        console.warn('Solution tables not available:', error)
      }

      return { inputData, resultsData }
    },

    // Update configurations with current locale and apply user schema filtering
    updateLocalizedConfigurations() {
      if (!this.rawConfigurations) return

      const currentLocale = locale.value

      // Get user schemas for filtering (undefined means full access)
      const userSchemas =
        this.user && 'schemas' in this.user
          ? this.user.schemas
          : undefined

      // Helper function to resolve default groups
      const resolveConfigWithDefaultGroups = (config: TableSchema) => {
        const resolved = resolveTableConfigTitles(config, currentLocale)

        // Resolve default groups for tables that have group keys
        Object.keys(resolved).forEach((tableKey) => {
          const table = resolved[tableKey]
          if (
            table.group === 'input-tables' ||
            table.group === 'output-tables'
          ) {
            // For now, we'll use the original multilingual data if available
            if (
              table._originalGroup &&
              typeof table._originalGroup === 'object'
            ) {
              table.group =
                table._originalGroup[currentLocale] ||
                table._originalGroup.en ||
                table.group
            }
          }
        })

        return resolved
      }

      // Resolve localized titles first
      const localizedMasterData = resolveTableConfigTitles(
        this.rawConfigurations.masterData,
        currentLocale,
      )
      const localizedInputData = resolveConfigWithDefaultGroups(
        this.rawConfigurations.inputData,
      )
      const localizedResultsData = resolveConfigWithDefaultGroups(
        this.rawConfigurations.resultsData,
      )

      // Apply current-schema and user-schema filtering to masterData (frontend-automation tables).
      // Then apply user permission filter (user's allowed schemas).
      const currentSchema = this.getSchemaName
      const masterDataForSchema = filterTablesByCurrentSchema(
        localizedMasterData,
        currentSchema,
      )
      this.configurations = {
        masterData: filterTablesByUserSchemas(masterDataForSchema, userSchemas),
        inputData: localizedInputData,
        resultsData: localizedResultsData,
      }
    },

    async fetchExecutionsByDateRange(fromDate: Date, toDate: Date) {
      try {
        let executions = []
        if (!fromDate || !toDate) {
          executions = await this.executionRepository.getExecutions(
            this.getSchemaName,
            null,
            null,
            this.getGlobalContextParams,
          )
        } else {
          executions = await this.executionRepository.getExecutions(
            this.getSchemaName,
            toUTCDayBoundary(fromDate),
            toUTCDayBoundary(toDate, true),
            this.getGlobalContextParams,
          )
        }

        return executions
      } catch (error) {
        console.error('Error getting executions by date range', error)
      }
    },

    async fetchLoadedExecution(id: string) {
      try {
        const loadedExecution = await this.executionRepository.loadExecution(id)
        if (loadedExecution) {
          this.addLoadedExecution(loadedExecution)
          return true
        }
        return false
      } catch (error) {
        console.error('Error getting loaded execution', error)
      }
    },

    async createInstance(data) {
      try {
        const response = await this.instanceRepository.createInstance(data)
        return response
      } catch (error) {
        console.error('Error creating instance', error)
        return false
      }
    },

    async getInstanceById(id: string) {
      try {
        const instance = await this.instanceRepository.getInstance(id)
        return instance
      } catch (error) {
        console.error('Error getting instance', error)
      }
    },

    async getInstanceDataChecksById(id: string, config?: Record<string, any>) {
      try {
        const dataChecks =
          await this.instanceRepository.launchInstanceDataChecks(id, config)
        const executionId = dataChecks.id

        let execution
        do {
          execution = await this.executionRepository.loadExecution(executionId)
          // Only continue waiting if execution is still running (state 0) or queued (state -7)
          if (execution && (execution.state === 0 || execution.state === -7)) {
            await new Promise((resolve) => setTimeout(resolve, 3000))
          }
        } while (execution && (execution.state === 0 || execution.state === -7))

        // Check if execution completed successfully
        // Success states: 1 (solved correctly), 2 (loaded manually), -4 (not run by user)
        if (
          execution &&
          (execution.state === 1 ||
            execution.state === 2 ||
            execution.state === -4)
        ) {
          const instance = await this.instanceRepository.getInstance(id)
          return instance
        } else {
          // Execution failed - return null to indicate failure
          console.warn(
            `Data checks failed with execution state: ${execution?.state}`,
          )
          return null
        }
      } catch (error) {
        console.error('Error getting instance data checks', error)
        return null // Explicitly return null to indicate an error
      }
    },

    /**
     * Run the full historical KPI flow: create execution -> data-check-kpis -> poll until done.
     * The resulting execution is stored in `historical.execution` and never added to
     * loadedExecutions or set as selectedExecution/latestPlan.
     */
    async runHistoricalKpiFlow(startDate: string, endDate: string) {
      clearHistoricalPollTimer()
      this.historical = {
        execution: null,
        dateRange: { from: startDate, to: endDate },
        bannerMode: 'creating',
        executionId: null,
        errorMessage: null,
        checksData: null,
        checksWarningKeys: null,
      }

      try {
        const execId =
          await this.executionRepository.createHistoricalKpisExecution(
            startDate,
            endDate,
          )
        this.historical.executionId = execId

        this.historical.bannerMode = 'data_check'
        try {
          await this.executionRepository.startDataCheckKpisForExecution(execId)
        } catch (err: any) {
          this.historical.errorMessage =
            err?.message || 'Error starting data-check KPIs'
          this.historical.bannerMode = 'error'
          return
        }

        const poll = async () => {
          clearHistoricalPollTimer()
          this.historical.bannerMode = 'polling'
          try {
            const loaded = await this.executionRepository.loadExecution(execId)
            const state = loaded.state

            if (state === 0 || state === -7) {
              historicalPollTimer = setTimeout(() => {
                void poll()
              }, HISTORICAL_POLL_MS)
              return
            }

            if (state < 0) {
              ;(this.historical as any).errorMessage = (i18n.global as any).t(
                'historical.statusCalculationError',
              )
              this.historical.bannerMode = 'error'
              return
            }

            const solution = loaded.experiment?.solution
            const instance = loaded.experiment?.instance
            const kpisEmpty =
              !solution?.rawKpis ||
              Object.keys(solution.rawKpis).length === 0 ||
              Object.values(solution.rawKpis).every((v) => v == null)
            const solutionChecksPresent = hasAnyChecksData(solution?.dataChecks)
            const instanceChecksPresent = hasAnyChecksData(instance?.dataChecks)

            if (solutionChecksPresent || instanceChecksPresent) {
              const warningKeys = [
                ...extractWarningKeysFromSchema(
                  this.schemaConfig?.instanceChecksSchema,
                ),
                ...extractWarningKeysFromSchema(
                this.schemaConfig?.solutionChecksSchema,
                ),
              ]
              this.historical.checksData = {
                ...buildNonEmptyChecksMap(instance?.dataChecks),
                ...buildNonEmptyChecksMap(solution?.dataChecks),
              }
              this.historical.checksWarningKeys =
                warningKeys.length > 0 ? warningKeys : null

              if (kpisEmpty) {
                this.historical.errorMessage = instanceChecksPresent
                  ? 'Instance checks found errors. KPIs could not be calculated.'
                  : 'Solution checks found errors. KPIs could not be calculated.'
                this.historical.bannerMode = 'checks_error'
                return
              }

              // KPIs are present but there are checks — treat as warnings
              this.historical.execution = markRaw(loaded)
              this.historical.bannerMode = 'checks_warning'
              return
            }

            this.historical.execution = loaded
            this.historical.bannerMode = 'done'
          } catch (err: any) {
            this.historical.errorMessage = err?.message || String(err)
            this.historical.bannerMode = 'error'
          }
        }

        void poll()
      } catch (err: any) {
        this.historical.errorMessage =
          err?.message || 'Error creating historical execution'
        this.historical.bannerMode = 'error'
      }
    },

    clearHistoricalExecution() {
      clearHistoricalPollTimer()
      this.historical = {
        execution: null,
        dateRange: { from: '', to: '' },
        bannerMode: 'idle',
        executionId: null,
        errorMessage: null,
        checksData: null,
        checksWarningKeys: null,
      }
    },

    async createExecution(execution: Execution, params: string = '') {
      if (!this.isGlobalContextComplete) {
        console.error(
          'Error creating execution: a global-context dimension has no value',
        )
        return false
      }
      try {
        const newExecution = await this.executionRepository.createExecution(
          execution,
          params,
        )
        return newExecution
      } catch (error) {
        console.error('Error creating execution', error)
        return false
      }
    },

    async uploadSolutionData(executionId: string, solutionData: any) {
      try {
        await this.executionRepository.uploadSolutionData(
          executionId,
          solutionData,
        )
        return true
      } catch (error) {
        console.error('Error uploading solution data:', error)
        return false
      }
    },

    async deleteExecution(id: string) {
      try {
        const result = await this.executionRepository.deleteExecution(id)
        if (result) {
          // Filter out the execution with the given id from lastExecutions
          this.lastExecutions = this.lastExecutions.filter(
            (execution) => execution.id !== id,
          )

          // Filter out the execution with the given executionId from loadedExecutions
          this.loadedExecutions = this.loadedExecutions.filter(
            (execution) => execution.executionId !== id,
          )
        }
        return result
      } catch (error) {
        console.error('Error deleting execution', error)
      }
    },

    addLoadedExecution(loadedExecution: LoadedExecution) {
      // `markRaw` opts the execution (and its huge instance/solution.data
      // trees) out of Pinia's deep reactive Proxy. Without this, every cell
      // read in the input/output tables went through a Proxy trap, which is
      // multi-ms per access at 500k rows. Row-level edits flow through
      // `useTableChanges` (a separate reactive map), so we don't need
      // cell-level reactivity here. The store still reacts to push/splice
      // and to `selectedExecution` reassignment, which is what the UI
      // actually consumes.
      const rawExecution = markRaw(loadedExecution)
      const index = this.loadedExecutions.findIndex(
        (execution) => execution.executionId === rawExecution.executionId,
      )

      if (index === -1) {
        this.loadedExecutions.push(rawExecution)
      } else {
        this.loadedExecutions.splice(index, 1, rawExecution)
      }

      // Start auto-loading executions
      this.autoLoadExecutions()
    },

    async autoLoadExecutions() {
      // Clear any existing interval
      this.stopAutoLoadExecutions()

      // Start a new interval. We poll only execution **state** (a few bytes)
      // via the lightweight `getExecutionState` endpoint, and only re-fetch
      // the full instance+solution payload when state actually transitions
      // out of the running set ({0, -7}). Previously every tick re-pulled
      // the full `/data/` + instance for each still-running execution,
      // which for 500k-row instances meant several MB downloaded every 4s.
      this.autoLoadInterval = setInterval(async () => {
        // Prevent overlapping ticks. The callback is async, so if the previous
        // tick is still awaiting slow or failing requests (e.g. a CORS/network
        // failure that takes a while to reject), setInterval would fire another
        // tick anyway and they would stack up into a flood of parallel calls.
        // Skip while one is already running.
        if (this.autoLoadTickInFlight) return
        this.autoLoadTickInFlight = true
        try {
          for (const execution of this.loadedExecutions) {
            if (execution.state !== 0 && execution.state !== -7) continue
            // A hard failure of the poll itself (backend down/unavailable)
            // stops the loop instead of hammering a failing endpoint every 4s.
            const keepPolling = await this.refreshRunningExecution(execution)
            if (!keepPolling) return
          }
        } finally {
          this.autoLoadTickInFlight = false
        }
      }, 4000) // Check every 4 seconds
      autoLoadPollTimer = this.autoLoadInterval
    },

    /**
     * Polls a single running execution's lightweight state and, only when it
     * transitions out of the running set, re-fetches and stores the full
     * payload. Extracted from `autoLoadExecutions` to keep nesting/complexity
     * low. Returns `true` to keep polling, or `false` on a hard failure of the
     * poll itself (backend down/unavailable) so the caller stops the interval.
     */
    async refreshRunningExecution(
      execution: LoadedExecution,
    ): Promise<boolean> {
      try {
        const meta = await this.executionRepository.getExecutionState(
          execution.executionId,
        )
        if (!meta) return true
        // Still running → keep polling, nothing to update yet.
        if (meta.state === 0 || meta.state === -7) return true

        // State transitioned: now (and only now) fetch the full payload.
        const updatedExecution = await this.executionRepository.loadExecution(
          execution.executionId,
        )
        if (!updatedExecution) return true

        this.addLoadedExecution(updatedExecution)

        if (
          this.selectedExecution &&
          this.selectedExecution.executionId === execution.executionId
        ) {
          this.selectedExecution = updatedExecution
        }
        return true
      } catch (error) {
        // A hard failure of the poll itself (timeout, 502/503, network, invalid
        // token) means the backend is down/unavailable — stop polling instead
        // of hammering it (which also feeds the invalid-token cascade after a
        // restart) and let the user know. (401 is already handled by the API
        // client, which clears the session and redirects, so we skip it here.)
        console.error('Error auto-loading execution', error)
        this.stopAutoLoadExecutions()
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes('Unauthorized')) {
          showSnackbar(
            i18n.global.t('projectExecution.snackbar.autoLoadError'),
            'error',
          )
        }
        return false
      }
    },

    /** Stops the background execution-state polling interval, if running. */
    stopAutoLoadExecutions() {
      this.autoLoadTickInFlight = false
      if (this.autoLoadInterval) {
        clearInterval(this.autoLoadInterval)
        this.autoLoadInterval = null
      }
      autoLoadPollTimer = null
    },

    removeLoadedExecution(index: number) {
      this.loadedExecutions.splice(index, 1)
    },

    resetLoadedExecutions() {
      this.loadedExecutions = []
    },

    setSelectedExecution(executionId: string | null) {
      if (executionId === null) {
        this.selectedExecution = null
      } else {
        this.selectedExecution = this.loadedExecutions.find(
          (execution) => execution.executionId === executionId,
        )
      }
    },

    addNotification(notification: {
      message: string
      type: 'success' | 'warning' | 'info' | 'error'
    }) {
      this.notifications.push(notification)
    },

    removeNotification(index: number) {
      this.notifications.splice(index, 1)
    },

    resetNotifications() {
      this.notifications = []
    },

    incrementUploadComponentKey() {
      this.uploadComponentKey++
    },

    incrementTabBarKey() {
      return this.tabBarKey++
    },

    async getDataToDownload(
      id: string,
      onlySolution: boolean = false,
      onlyInstance: boolean = false,
    ) {
      let solution = false
      let instance = false
      if (onlySolution) {
        solution = true
      }

      if (onlyInstance) {
        instance = true
      }

      await this.executionRepository.getDataToDownload(id, solution, instance)
    },

    // Drawer pin actions
    setDrawerPinned(isPinned: boolean) {
      this.isDrawerPinned = isPinned
    },

    toggleDrawerPin() {
      this.isDrawerPinned = !this.isDrawerPinned
    },
  },
  getters: {
    getWarnings(): Warning[] {
      return this.warnings
    },

    getNotifications(): any {
      return this.notifications
    },

    getLogo(): string {
      return this.logo
    },

    getUser(): any {
      return this.user
    },

    /**
     * Gets the schemas (DAGs) the user has access to.
     * Returns undefined if user has access to all tables (no restrictions).
     */
    getUserSchemas(): string[] | undefined {
      if (this.user && 'schemas' in this.user) {
        return this.user.schemas
      }
      return undefined
    },

    /**
     * Checks if the current user has access to all frontend automation tables.
     * Returns true if user has no schema restrictions.
     */
    userHasFullAccess(): boolean {
      if (
        this.user &&
        'hasFullAccess' in this.user &&
        typeof this.user.hasFullAccess === 'function'
      ) {
        return this.user.hasFullAccess()
      }
      // Default to full access if user doesn't have the method
      return true
    },

    getLicences(): any {
      return this.licences
    },

    getSchemaName(): string {
      return this.schema || config.schema
    },

    /** True when the deployment lists several DAGs in `config.schemas`. */
    isMultiSchemaDeployment(): boolean {
      return (config.schemas?.length ?? 0) > 1
    },

    /** True when the user may switch between more than one DAG. */
    canSwitchSchema(): boolean {
      return this.availableSchemas.length > 1
    },

    /** Global-context dimensions the app declares (`globalContext`). Empty when none. */
    getGlobalContextDimensions(): GlobalContextDimension[] {
      return readGlobalContextDimensions()
    },

    /** Picked global-context values as query parameters, without the dimensions set to "All". */
    getGlobalContextParams(): Record<string, string> {
      return toContextQueryParams(this.globalContext)
    },

    /** Picked global-context values with their raw type, without the dimensions set to "All". */
    getGlobalContextConfig(): Record<string, unknown> {
      return toContextConfig(this.globalContext)
    },

    /**
     * True when the context bar has something to show: the module of a multi-DAG deployment, or
     * the global-context dimensions once their options are loaded.
     */
    isContextBarVisible(): boolean {
      const showsModule =
        this.isMultiSchemaDeployment && this.availableSchemas.length > 0
      const showsContext =
        readGlobalContextDimensions().length > 0 &&
        Object.keys(this.globalContextOptions).length > 0
      return showsModule || showsContext
    },

    /** True when every global-context dimension has a value, as launching an execution needs. */
    isGlobalContextComplete(): boolean {
      return readGlobalContextDimensions().every((dimension) =>
        hasContextValue(this.globalContext[dimension.key]),
      )
    },

    getSchemaConfig(): SchemaConfig {
      return this.schemaConfig
    },

    getExecutionSolvers(): string[] {
      return (
        this.schemaConfig.config?.properties.solver?.enum ||
        this.appConfig.parameters.executionSolvers
      )
    },

    getLoadedExecutionTabs(): object[] {
      return this.loadedExecutions.map((execution) => {
        let icon
        let isLoading = false
        switch (execution.state) {
          case 1:
          case -4:
            icon = 'mdi-checkbox-marked'
            break
          case 0:
          case -7:
            isLoading = true
            icon = 'mdi-loading'
            break
          default:
            icon = 'mdi-close-box'
        }

        return {
          value: execution.executionId,
          text: execution.name,
          icon: icon,
          loading: isLoading,
          selected: false,
        }
      })
    },

    getConfigurations(): ConfigurationData | null {
      return this.configurations
    },

    historicalState: (state): HistoricalState => {
      return state.historical as unknown as HistoricalState
    },

    /**
     * Returns true if the currently logged-in user is an admin.
     * Reads from sessionStorage (set during login).
     */
    isAdmin(): boolean {
      return sessionStorage.getItem('isAdmin') === 'true'
    },
  },
})

// During development, Vite hot-reloads this module on every edit but does not
// stop timers started by the previous instance. Clear all background pollers on
// dispose so they don't pile up into zombie intervals hammering the backend.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearHistoricalPollTimer()
    if (autoLoadPollTimer) {
      clearInterval(autoLoadPollTimer)
      autoLoadPollTimer = null
    }
  })
  import.meta.hot.accept(acceptHMRUpdate(useGeneralStore, import.meta.hot))
}
