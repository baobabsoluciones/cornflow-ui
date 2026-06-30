import { defineStore } from 'pinia'
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
  loadPremiumMasterDataConfig,
} from '@cornflow-ui/core/plugins/extensions'
import RoleRepository from '@cornflow-ui/core/repositories/RoleRepository'
import WarningsRepository from '@cornflow-ui/core/repositories/WarningsRepository'
import type { Warning } from '@cornflow-ui/core/repositories/WarningsRepository'

import { toISOStringLocal } from '@cornflow-ui/core/utils/data_io'

// Import utility functions
import {
  ConfigurationData,
  AutomationSectionDef,
  AutomationGroupDef,
} from '@cornflow-ui/core/types/frontendAutomation'
import { TableSchema } from '@cornflow-ui/core/config/views'
import { i18n, locale } from '@cornflow-ui/core/plugins/i18n'
import {
  resolveTableConfigTitles,
  getExecutionConfigFromSchemaConfig,
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

function clearHistoricalPollTimer() {
  if (historicalPollTimer) {
    clearTimeout(historicalPollTimer)
    historicalPollTimer = null
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
    warnings: [] as Warning[],
    notifications: [] as {
      message: string
      type: 'success' | 'warning' | 'info' | 'error'
    }[],
    licences: [],
    user: {},
    logo: logo,
    fullLogo: fullLogo,
    schema: '',
    schemaConfig: {} as SchemaConfig,
    appConfig: appConfig.getCore(),
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
        await this.setSchema()
        await this.setConfigurations()
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
      this.appConfig.parameters.configFields = derived.configFields
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
        let inputData = {}
        let resultsData = {}

        try {
          inputData = await this.schemaRepository.getInstanceTables(
            this.getSchemaName,
          )
        } catch (error) {
          console.warn('Instance tables not available:', error)
          inputData = {}
        }

        try {
          resultsData = await this.schemaRepository.getSolutionTables(
            this.getSchemaName,
          )
        } catch (error) {
          console.warn('Solution tables not available:', error)
          resultsData = {}
        }

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
          )
        } else {
          executions = await this.executionRepository.getExecutions(
            this.getSchemaName,
            toISOStringLocal(fromDate),
            toISOStringLocal(toDate, true),
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

    async getInstanceDataChecksById(id: string) {
      try {
        const dataChecks =
          await this.instanceRepository.launchInstanceDataChecks(id)
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
      if (this.autoLoadInterval) {
        clearInterval(this.autoLoadInterval)
      }

      // Start a new interval. We poll only execution **state** (a few bytes)
      // via the lightweight `getExecutionState` endpoint, and only re-fetch
      // the full instance+solution payload when state actually transitions
      // out of the running set ({0, -7}). Previously every tick re-pulled
      // the full `/data/` + instance for each still-running execution,
      // which for 500k-row instances meant several MB downloaded every 4s.
      this.autoLoadInterval = setInterval(async () => {
        for (const execution of this.loadedExecutions) {
          if (execution.state !== 0 && execution.state !== -7) continue
          await this.refreshRunningExecution(execution)
        }
      }, 4000) // Check every 4 seconds
    },

    /**
     * Polls a single running execution's lightweight state and, only when it
     * transitions out of the running set, re-fetches and stores the full
     * payload. Extracted from `autoLoadExecutions` to keep nesting/complexity
     * low; errors are swallowed (logged) so one failure can't stop the loop.
     */
    async refreshRunningExecution(execution: LoadedExecution) {
      try {
        const meta = await this.executionRepository.getExecutionState(
          execution.executionId,
        )
        if (!meta) return
        // Still running → keep polling, nothing to update yet.
        if (meta.state === 0 || meta.state === -7) return

        // State transitioned: now (and only now) fetch the full payload.
        const updatedExecution = await this.executionRepository.loadExecution(
          execution.executionId,
        )
        if (!updatedExecution) return

        this.addLoadedExecution(updatedExecution)

        if (
          this.selectedExecution &&
          this.selectedExecution.executionId === execution.executionId
        ) {
          this.selectedExecution = updatedExecution
        }
      } catch (error) {
        console.error('Error auto-loading execution', error)
      }
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
      return config.schema
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
