/**
 * useExecutionDraft — everything a "create execution" flow does, without any UI.
 *
 * It holds the execution being prepared (data, parameters, name), brings the data in (files, or
 * the database through the ETL), runs the data checks, syncs the ETL review,
 * launches the execution (or creates it with an uploaded solution) and says what is still missing
 * to launch. Core's flows are built on it, and so can an app's own flow in its `src/app`
 * (see docs/create-execution-flows.md): the screen is theirs, the calls to the backend stay here.
 *
 * Call it once per flow, inside `setup`. It returns a reactive object: read `draft.isLoaded`,
 * `draft.missing`… directly, in the script and in the template.
 */
import { computed, markRaw, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ErrorObject } from 'ajv'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import {
  useInstanceProcessing,
  type ProcessingResult,
} from '@cornflow-ui/core/composables/useInstanceProcessing'
import { useEtlFlowController } from '@cornflow-ui/core/composables/project-execution/useEtlFlowController'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'
import { getPremiumEtlBackend } from '@cornflow-ui/core/plugins/extensions'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import { pickPreEtlConfigValues } from '@cornflow-ui/core/utils/schemaUtils'
import { formatValidationErrors } from '@cornflow-ui/core/utils/errorFormatting'
import session from '@cornflow-ui/core/services/AuthService'
import {
  applySourceConfigFieldValues,
  isEmptyConfigValue,
  resolveAllConfigFieldValues,
  seedConfigFieldDefaults,
} from './configFieldValues'
import { groupLoadErrors, singleLoadError, type LoadErrors } from './loadErrors'
import {
  proposeExecutionName,
  type ProposeExecutionName,
} from './executionName'
import { parseSolutionFile } from './solutionFile'
import {
  deleteExecutionDraft,
  draftKey,
  readExecutionDraft,
  writeExecutionDraft,
  type ExecutionDraft,
} from './executionDraftStore'

export type LoadStatus = 'empty' | 'loading' | 'loaded' | 'error'
export type ChecksStatus = 'none' | 'running' | 'ok' | 'warnings' | 'errors' | 'stale'
export type LaunchStep = 'sync' | 'execution' | 'solution'

/** How the data card offers to bring the data in. */
export type DataSourceMode =
  /** Files only, read in the browser (or sent to the ETL). */
  | 'files'
  /** The database through the ETL; files replace the tables with the same name. */
  | 'database'
  /** As `database`, with the load filters (`pre_etl` parameters) to fill first. */
  | 'database-filtered'

export interface CheckColumn {
  key: string
  title: string
}

export interface CheckResult {
  key: string
  /** The check table's `title` in the checks schema, or its key in words. */
  title: string
  description: string
  kind: 'error' | 'warning'
  /** The columns of the check table, titled as the checks schema says. */
  columns: CheckColumn[]
  /** What the check found, one record per row of the check table. */
  records: Record<string, unknown>[]
}

export type MissingTarget = 'data' | 'checks' | 'name' | `param:${string}`

export interface MissingItem {
  key: string
  text: string
  target: MissingTarget
}

export interface DraftExecution {
  instance: any
  config: Record<string, any>
  name: string
  description: string
}

const QUEUED = -7
const RUNNING = 0

/** `capacity_by_line` → "Capacity by line": the name of a check table or column without a title. */
function keyInWords(key: string): string {
  const words = key.replaceAll('_', ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The rows of a check table as records, and its columns: the schema's, then any others found. */
function checkTable(rows: unknown[], itemProperties: Record<string, any>) {
  const records = rows.map((row) =>
    row && typeof row === 'object' ? (row as Record<string, unknown>) : { value: row },
  )
  const keys = [...Object.keys(itemProperties)]
  for (const record of records) {
    for (const key of Object.keys(record)) if (!keys.includes(key)) keys.push(key)
  }
  const columns = keys
    .filter((key) => records.some((r) => key in r))
    .map((key) => ({ key, title: itemProperties[key]?.title || keyInWords(key) }))
  return { columns, records }
}

export function useExecutionDraft() {
  const store = useGeneralStore()
  const { t } = useI18n()
  const instanceProcessing = useInstanceProcessing()
  const etlFlow = useEtlFlowController()
  const tableChanges = useTableChanges()

  // ── State ──────────────────────────────────────────────────────────────────

  /** Same shape the review and the store work with (`newExecution`). */
  const execution = reactive<DraftExecution>({
    instance: null,
    config: {},
    name: '',
    description: '',
  })
  const files = ref<File[]>([])
  const loadStatus = ref<LoadStatus>('empty')
  const loadErrors = ref<LoadErrors | null>(null)
  const rawLoadErrors = ref<ErrorObject[] | null>(null)
  const loadWarning = ref<string | null>(null)
  const loadedFileNames = ref<string[]>([])
  /** Serialized load filters the data on screen was brought with; null until loaded. */
  const loadedFilters = ref<string | null>(null)
  /** Name of the execution the data was copied from (relaunch with changes). */
  const fromExecution = ref<string | null>(null)
  const nameProposed = ref(false)
  /** Parameters whose value was read from the loaded data. */
  const fromDataKeys = ref<string[]>([])
  /** Schema errors left by an edit of the data (HTML, from the review). */
  const dataErrors = ref<string | null>(null)

  const checks = reactive({
    status: 'none' as ChecksStatus,
    results: [] as CheckResult[],
    checkedAt: null as Date | null,
  })

  const launch = reactive({
    running: false,
    step: null as LaunchStep | null,
    executionId: null as string | null,
  })

  const solution = reactive({
    enabled: false,
    file: null as File | null,
    data: null as any,
    errors: null as string | null,
  })

  /** The ETL review has switches the backend has not been told about yet. */
  const etlNeedsSync = ref(false)
  /** Applies the edits pending in the review; set by whatever shows the tables. */
  let pendingChangesApplier: (() => Promise<boolean>) | null = null

  // ── Configuration ──────────────────────────────────────────────────────────

  // Read with optional chaining: an app's `src/app/config.ts` may predate some of these keys.
  const parameters = computed<Record<string, any>>(() => store.appConfig.parameters)
  const etlConfig = computed(() => parameters.value.etl)
  const allConfigFields = computed<any[]>(() => parameters.value.configFields || [])

  const hasEtlBackend = computed(() => getPremiumEtlBackend() !== null)
  const canLoadFromDatabase = computed(
    () =>
      hasEtlBackend.value &&
      Boolean(etlConfig.value?.useEtlBackend && etlConfig.value?.enableLoadFromDb),
  )

  /** Options of the load filters fed by a frontend-automation table (`joinFrom`), by key. */
  const filterTableOptions = ref<Record<string, { value: unknown; label: string }[]>>({})

  /**
   * Load filters are asked before the data exists; a relaunch already has its data. A filter fed
   * by a table carries that table's rows as its options.
   */
  const loadFilterFields = computed(() =>
    fromExecution.value
      ? []
      : allConfigFields.value
          .filter((f) => f.preEtl === true)
          .map((f) => (f.joinFrom ? { ...f, options: filterTableOptions.value[f.key] ?? [] } : f)),
  )

  // The fields can arrive with the schema, and the frontend-automation tables after them.
  watch(
    () =>
      `${allConfigFields.value
        .filter((f) => f.preEtl === true && f.joinFrom)
        .map((f) => `${f.key}=${f.joinFrom}`)
        .join('|')}#${Object.keys(store.getConfigurations?.masterData ?? {}).length}`,
    async () => {
      const withTable = allConfigFields.value.filter((f) => f.preEtl === true && f.joinFrom)
      for (const field of withTable) {
        const options = (await store.fetchTableOptions(field.joinFrom)) ?? []
        filterTableOptions.value = {
          ...filterTableOptions.value,
          [field.key]: options.map((o: any) => ({ value: o.value, label: String(o.title) })),
        }
      }
    },
    { immediate: true },
  )

  const dataSourceMode = computed<DataSourceMode>(() => {
    if (!canLoadFromDatabase.value) return 'files'
    return loadFilterFields.value.length > 0 ? 'database-filtered' : 'database'
  })

  const showParameters = computed(
    () => parameters.value.configFieldsConfig?.showConfigFieldsStep !== false,
  )
  const autoLoadValues = computed(
    () =>
      !showParameters.value &&
      Boolean(parameters.value.configFieldsConfig?.autoLoadValues),
  )

  /** The parameters the user sets: every config field but the load filters. */
  const parameterFields = computed(() =>
    showParameters.value
      ? allConfigFields.value.filter(
          (field) => !loadFilterFields.value.some((f) => f.key === field.key),
        )
      : [],
  )

  const solvers = computed<string[]>(() => store.getExecutionSolvers ?? [])
  const defaultSolver = computed(
    () => parameters.value.solverConfig?.defaultSolver ?? solvers.value[0],
  )
  /** The solver is only asked when the app lets the user pick and there is a choice. */
  const showSolver = computed(
    () => Boolean(parameters.value.solverConfig?.showSolverStep) && solvers.value.length > 1,
  )

  const developerMode = computed(() => Boolean(parameters.value?.isDeveloperMode))
  const blockOnCheckErrors = computed(() =>
    Boolean(parameters.value.enableBlockAdvanceOnCheckErrors),
  )
  const hasChecks = computed(() => {
    const properties = store.schemaConfig?.instanceChecksSchema?.properties
    return Boolean(properties && Object.keys(properties).length > 0)
  })

  const proposeName = computed<ProposeExecutionName>(
    () => parameters.value?.createExecution?.proposeName ?? proposeExecutionName,
  )

  // ── Derived state ──────────────────────────────────────────────────────────

  const isLoaded = computed(() => loadStatus.value === 'loaded')
  const pendingChangesCount = computed(() => tableChanges.totalChangesCount.value)

  const currentFilters = computed(() =>
    JSON.stringify(pickPreEtlConfigValues(execution.config, allConfigFields.value)),
  )
  /** The load filters changed since the data was brought: the data does not reflect them. */
  const filtersChanged = computed(
    () =>
      isLoaded.value &&
      loadFilterFields.value.length > 0 &&
      loadedFilters.value !== null &&
      loadedFilters.value !== currentFilters.value,
  )
  const missingRequiredFilters = computed(() =>
    loadFilterFields.value.filter(
      (field) => field.required && isEmptyConfigValue(field, execution.config[field.key]),
    ),
  )
  /** Files picked that are not part of the data on screen. */
  const filesChanged = computed(
    () =>
      files.value.map((f) => f.name).join('|') !== loadedFileNames.value.join('|'),
  )

  const canLoad = computed(() => {
    if (loadStatus.value === 'loading') return false
    if (files.value.length > 0) return missingRequiredFilters.value.length === 0
    return canLoadFromDatabase.value && missingRequiredFilters.value.length === 0
  })

  const errorCount = computed(() =>
    checks.results.filter((r) => r.kind === 'error').reduce((n, r) => n + r.records.length, 0),
  )
  const warningCount = computed(() =>
    checks.results.filter((r) => r.kind === 'warning').reduce((n, r) => n + r.records.length, 0),
  )

  const missingParameters = computed(() =>
    parameterFields.value.filter(
      (field) => field.required && isEmptyConfigValue(field, execution.config[field.key]),
    ),
  )

  function fieldLabel(field: any): string {
    return field.title ? t(field.title) : field.key
  }

  const missing = computed<MissingItem[]>(() => {
    const items: MissingItem[] = []
    if (!isLoaded.value) {
      items.push({
        key: 'data',
        text:
          loadStatus.value === 'error'
            ? t('createExecution.missing.fixData')
            : t('createExecution.missing.data'),
        target: 'data',
      })
    } else if (filtersChanged.value) {
      items.push({ key: 'filters', text: t('createExecution.missing.reload'), target: 'data' })
    } else if (dataErrors.value) {
      items.push({ key: 'data', text: t('createExecution.missing.fixData'), target: 'data' })
    }
    if (checks.status === 'running') {
      items.push({ key: 'checks', text: t('createExecution.missing.checksRunning'), target: 'checks' })
    }
    if (blockOnCheckErrors.value && checks.status === 'errors') {
      items.push({
        key: 'checks',
        text: t('createExecution.missing.checkErrors', { count: errorCount.value }, errorCount.value),
        target: 'checks',
      })
    }
    if (!execution.name.trim()) {
      items.push({ key: 'name', text: t('createExecution.missing.name'), target: 'name' })
    }
    for (const field of missingParameters.value) {
      items.push({
        key: `param:${field.key}`,
        text: t('createExecution.missing.parameter', { name: fieldLabel(field) }),
        target: `param:${field.key}`,
      })
    }
    return items
  })

  const canLaunch = computed(
    () =>
      missing.value.length === 0 &&
      !launch.running &&
      !(solution.enabled && !solution.data),
  )

  /** The launched execution as the store follows it (its state updates every few seconds). */
  const launchedExecution = computed(() =>
    launch.executionId
      ? (store.loadedExecutions.find(
          (e: any) => e.executionId === launch.executionId,
        ) ?? null)
      : null,
  )
  const isLaunched = computed(() => launch.executionId !== null)

  /** There is something to lose by leaving. */
  const hasProgress = computed(
    () =>
      !isLaunched.value &&
      (isLoaded.value ||
        files.value.length > 0 ||
        loadStatus.value === 'error' ||
        Boolean(execution.description) ||
        (Boolean(execution.name) && !nameProposed.value)),
  )

  // ── Parameters ─────────────────────────────────────────────────────────────

  function seedDefaults() {
    execution.config = seedConfigFieldDefaults(allConfigFields.value, execution.config)
    if (!execution.config.solver) execution.config.solver = defaultSolver.value
  }

  function setParameter(key: string, value: unknown) {
    execution.config = { ...execution.config, [key]: value }
    fromDataKeys.value = fromDataKeys.value.filter((k) => k !== key)
  }

  function setFilter(key: string, value: unknown) {
    execution.config = { ...execution.config, [key]: value }
  }

  function setName(name: string) {
    execution.name = name
    nameProposed.value = false
  }

  function setDescription(description: string) {
    execution.description = description
  }

  /** Parameters that come from the data take its values (all of them when they are hidden). */
  function settleParametersFromData(instanceData: Record<string, any> | null) {
    if (autoLoadValues.value) {
      execution.config = resolveAllConfigFieldValues(
        allConfigFields.value,
        execution.config,
        instanceData,
      )
      fromDataKeys.value = []
      return
    }
    const result = applySourceConfigFieldValues(
      allConfigFields.value,
      execution.config,
      instanceData,
    )
    execution.config = result.config
    fromDataKeys.value = result.fromData
  }

  function filterLabels(): string[] {
    return loadFilterFields.value
      .filter((field: any) => field.type === 'select' || field.options?.length)
      .map((field) => {
        const value = execution.config[field.key]
        const option = (field.options ?? []).find((o: any) => o.value === value)
        return option ? String(option.label) : ''
      })
  }

  function proposeNameNow() {
    if (execution.name && !nameProposed.value) return
    execution.name = proposeName.value({
      fileNames: loadedFileNames.value,
      filterLabels: filterLabels(),
      fromExecution: fromExecution.value,
      date: new Date(),
      t,
    })
    nameProposed.value = true
  }

  // ── Loading the data ───────────────────────────────────────────────────────

  function addFiles(picked: File[]) {
    const names = new Set(picked.map((f) => f.name))
    files.value = [...files.value.filter((f) => !names.has(f.name)), ...picked]
    if (loadStatus.value === 'error') clearLoadErrors()
  }

  function removeFile(index: number) {
    files.value = files.value.filter((_, i) => i !== index)
    if (loadStatus.value === 'error' && files.value.length === 0) clearLoadErrors()
  }

  function clearLoadErrors() {
    loadStatus.value = execution.instance ? 'loaded' : 'empty'
    loadErrors.value = null
    rawLoadErrors.value = null
  }

  function onLoaded(result: ProcessingResult) {
    if (!result.success || !result.instance) {
      rawLoadErrors.value = result.rawErrors ?? null
      loadErrors.value = result.rawErrors?.length
        ? groupLoadErrors(
            result.rawErrors,
            store.schemaConfig?.instanceSchema,
            null,
            t,
          )
        : singleLoadError(result.errors || t('projectExecution.steps.step3.loadInstance.unexpectedError'), t)
      loadStatus.value = 'error'
      return
    }

    tableChanges.clearAllChanges()
    etlFlow.reset()
    execution.instance = result.instance
    loadedFileNames.value = files.value.map((f) => f.name)
    loadedFilters.value = currentFilters.value
    loadWarning.value = result.warning ?? null
    loadErrors.value = null
    rawLoadErrors.value = null
    dataErrors.value = null
    fromExecution.value = null
    loadStatus.value = 'loaded'
    if (result.rawData) {
      etlFlow.initializeFromEtlResponse(result.rawData)
    }
    etlNeedsSync.value = etlFlow.isActive.value
    resetChecks()
    settleParametersFromData(result.instance.data)
    proposeNameNow()
  }

  /** Brings the data in: the picked files, or the database when there are none. */
  async function load() {
    if (!canLoad.value) return
    loadStatus.value = 'loading'
    loadWarning.value = null
    try {
      const result =
        files.value.length > 0
          ? await instanceProcessing.processFiles(files.value, execution.config)
          : await instanceProcessing.processFromDb(execution.config)
      onLoaded(result)
    } catch (error) {
      onLoaded({
        success: false,
        instance: null,
        errors: error instanceof Error ? error.message : String(error),
        rawErrors: null,
      })
    }
  }

  /** The review replaced the instance (edits saved, Excel uploaded). */
  function setInstance(instance: any) {
    execution.instance = instance
    dataErrors.value = null
    markChecksStale()
    if (etlFlow.isActive.value) etlNeedsSync.value = true
    if (!autoLoadValues.value) return
    execution.config = resolveAllConfigFieldValues(
      allConfigFields.value,
      execution.config,
      instance?.data,
    )
  }

  function setDataErrors(errors: string | null) {
    dataErrors.value = errors
  }

  function registerPendingChangesApplier(apply: (() => Promise<boolean>) | null) {
    pendingChangesApplier = apply
  }

  async function applyPendingChanges(): Promise<boolean> {
    if (!tableChanges.hasChanges.value) return true
    if (!pendingChangesApplier) return false
    return pendingChangesApplier()
  }

  /** The user changed an origin switch of the ETL review. */
  function markEtlChanged() {
    etlNeedsSync.value = true
    markChecksStale()
  }

  async function syncEtl(): Promise<boolean> {
    if (!etlNeedsSync.value || !etlFlow.isActive.value || !execution.instance?.data) {
      etlNeedsSync.value = false
      return true
    }
    try {
      const { data, warning } = await etlFlow.submitUpdate(execution.instance.data)
      const { Instance } = store.appConfig
      const schemas = store.getSchemaConfig
      execution.instance = new Instance(
        null,
        data,
        schemas.instanceSchema,
        schemas.instanceChecksSchema,
        store.getSchemaName,
      )
      etlFlow.reset()
      etlNeedsSync.value = false
      if (warning) loadWarning.value = warning
      return true
    } catch (error) {
      showSnackbar(
        error instanceof Error ? error.message : t('createExecution.snackbar.syncError'),
        'error',
      )
      return false
    }
  }

  // ── Checks ─────────────────────────────────────────────────────────────────

  function resetChecks() {
    checks.status = 'none'
    checks.results = []
    checks.checkedAt = null
  }

  function markChecksStale() {
    if (['ok', 'warnings', 'errors'].includes(checks.status)) checks.status = 'stale'
  }

  function checkResultsOf(instance: any): CheckResult[] {
    const properties = store.schemaConfig?.instanceChecksSchema?.properties ?? {}
    const dataChecks = instance?.dataChecks ?? {}
    return Object.entries<any>(properties)
      .map(([key, prop]): CheckResult => {
        const rows = Array.isArray(dataChecks[key]) ? dataChecks[key] : []
        return {
          key,
          title: prop?.title || keyInWords(key),
          description: prop?.description ?? '',
          kind: prop?.is_warning === false ? 'error' : 'warning',
          ...checkTable(rows, prop?.items?.properties ?? {}),
        }
      })
      .filter((result) => result.records.length > 0)
      // Errors first, then the checks that found the most.
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'error' ? -1 : 1
        return b.records.length - a.records.length
      })
  }

  async function runChecks() {
    if (!isLoaded.value || checks.status === 'running') return
    if (!(await applyPendingChanges())) return
    if (!(await syncEtl())) return

    checks.status = 'running'
    try {
      const created = await store.createInstance({
        ...execution,
        name: execution.name || `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}_check`,
      })
      if (!created) throw new Error(t('projectExecution.snackbar.instanceCreationError'))
      const checked = await store.getInstanceDataChecksById(created.id, execution.config)
      if (!checked) throw new Error(t('projectExecution.snackbar.instanceDataChecksError'))

      execution.instance = checked
      checks.results = checkResultsOf(checked)
      checks.checkedAt = new Date()
      checks.status = errorCount.value > 0 ? 'errors' : warningCount.value > 0 ? 'warnings' : 'ok'
    } catch (error) {
      resetChecks()
      showSnackbar(
        error instanceof Error ? error.message : t('projectExecution.snackbar.instanceDataChecksError'),
        'error',
      )
    }
  }

  // ── Launch ─────────────────────────────────────────────────────────────────

  async function setSolutionFile(file: File | null) {
    solution.file = file
    solution.data = null
    solution.errors = null
    if (!file) return
    try {
      const parsed = await parseSolutionFile(file, t)
      const errors = await parsed.checkSchema()
      if (errors?.length) {
        solution.errors = formatValidationErrors(errors)
        return
      }
      solution.data = parsed.data
    } catch (error) {
      solution.errors = error instanceof Error ? error.message : String(error)
    }
  }

  function setSolutionMode(enabled: boolean) {
    solution.enabled = enabled
    if (!enabled) void setSolutionFile(null)
  }

  /** Creates the execution and starts following it; resolves whether it was created. */
  async function launchExecution(): Promise<boolean> {
    if (!canLaunch.value) return false
    launch.running = true
    try {
      if (!(await applyPendingChanges())) return false
      if (etlNeedsSync.value) {
        launch.step = 'sync'
        if (!(await syncEtl())) return false
      }
      launch.step = solution.enabled ? 'solution' : 'execution'
      const created = await store.createExecution(
        execution as any,
        solution.enabled ? '?run=0' : '',
      )
      if (!created) throw new Error(t('projectExecution.snackbar.errorCreate'))
      if (solution.enabled) {
        const uploaded = await store.uploadSolutionData(created.id, solution.data)
        if (!uploaded) throw new Error(t('projectExecution.steps.step8.developerMode.uploadError'))
      }
      await store.fetchLoadedExecution(created.id)
      launch.executionId = created.id
      await discardDraft()
      return true
    } catch (error) {
      showSnackbar(
        error instanceof Error ? error.message : t('projectExecution.snackbar.errorCreate'),
        'error',
      )
      return false
    } finally {
      launch.running = false
      launch.step = null
    }
  }

  // ── Starting points ────────────────────────────────────────────────────────

  /** Back to an empty execution ("Launch another"). */
  function reset() {
    tableChanges.clearAllChanges()
    etlFlow.reset()
    execution.instance = null
    execution.config = {}
    execution.name = ''
    execution.description = ''
    files.value = []
    loadStatus.value = 'empty'
    loadErrors.value = null
    rawLoadErrors.value = null
    loadWarning.value = null
    loadedFileNames.value = []
    loadedFilters.value = null
    fromExecution.value = null
    nameProposed.value = false
    fromDataKeys.value = []
    dataErrors.value = null
    etlNeedsSync.value = false
    resetChecks()
    launch.executionId = null
    solution.enabled = false
    void setSolutionFile(null)
    seedDefaults()
  }

  /** An editable copy of a loaded execution: its data, parameters and name ("relaunch"). */
  function startFrom(loaded: any) {
    reset()
    const instance = loaded?.experiment?.instance ?? loaded?.instance
    if (!instance) return
    fromExecution.value = loaded.name ?? null
    execution.instance = instance
    execution.description = loaded.description ?? ''
    execution.config = { ...execution.config, ...(loaded.config ?? {}) }
    // Without a solver to pick, the execution runs with the app's default one.
    if (!parameters.value.solverConfig?.showSolverStep) execution.config.solver = defaultSolver.value
    loadStatus.value = 'loaded'
    proposeNameNow()
  }

  // ── Draft ──────────────────────────────────────────────────────────────────

  const key = computed(() => draftKey(store.getSchemaName, session.getUserId()))

  async function saveDraft(): Promise<boolean> {
    const draft: ExecutionDraft = {
      savedAt: new Date().toISOString(),
      name: execution.name,
      description: execution.description,
      config: JSON.parse(JSON.stringify(execution.config)),
      instanceData: execution.instance?.data
        ? JSON.parse(JSON.stringify(execution.instance.data))
        : null,
      files: [...files.value],
      loadedFileNames: [...loadedFileNames.value],
      loadedFilters: loadedFilters.value ? JSON.parse(loadedFilters.value) : null,
      fromExecution: fromExecution.value,
      pendingChanges: tableChanges.snapshotState(),
      pendingChangesCount: pendingChangesCount.value,
      etlReview:
        etlFlow.isActive.value && etlFlow.state.initialData
          ? JSON.parse(
              JSON.stringify({
                initialData: etlFlow.state.initialData,
                tableSwitches: etlFlow.state.tableSwitches,
                parameterSwitches: etlFlow.state.parameterSwitches,
              }),
            )
          : null,
    }
    return writeExecutionDraft(key.value, draft)
  }

  function readDraft(): Promise<ExecutionDraft | null> {
    return readExecutionDraft(key.value)
  }

  function discardDraft() {
    return deleteExecutionDraft(key.value)
  }

  /** Puts a saved draft back on screen, ETL review included. */
  async function resumeDraft(draft: ExecutionDraft) {
    reset()
    execution.name = draft.name
    execution.description = draft.description
    execution.config = { ...execution.config, ...draft.config }
    files.value = draft.files ?? []
    fromExecution.value = draft.fromExecution
    nameProposed.value = false
    if (draft.instanceData) {
      const { Instance } = store.appConfig
      const schemas = store.getSchemaConfig
      execution.instance = new Instance(
        null,
        draft.instanceData,
        schemas.instanceSchema,
        schemas.instanceChecksSchema,
        store.getSchemaName,
      )
      loadedFileNames.value = draft.loadedFileNames ?? []
      loadedFilters.value = draft.loadedFilters ? JSON.stringify(draft.loadedFilters) : null
      loadStatus.value = 'loaded'
      tableChanges.restoreState(draft.pendingChanges as any)
      if (draft.etlReview) {
        etlFlow.initializeFromEtlResponse(draft.etlReview.initialData)
        Object.assign(etlFlow.state.tableSwitches, draft.etlReview.tableSwitches)
        Object.assign(etlFlow.state.parameterSwitches, draft.etlReview.parameterSwitches)
        etlNeedsSync.value = etlFlow.isActive.value
      }
    }
    await discardDraft()
  }

  // The parameters list can arrive after the flow mounts (schema loaded later).
  watch(allConfigFields, seedDefaults, { immediate: true })

  /** Whether the launched execution is still queued or running. */
  const launchedRunning = computed(() => {
    const state = launchedExecution.value?.state
    return state === QUEUED || state === RUNNING
  })

  // The review's origin switches changed: the backend has to hear about it before the checks
  // and the launch, and the checks no longer describe the data.
  watch(
    () => [etlFlow.state.tableSwitches, etlFlow.state.parameterSwitches],
    () => {
      if (etlFlow.isActive.value) markEtlChanged()
    },
    { deep: true },
  )

  /** What the review needs to show the ETL origin switches; null without an ETL review. */
  const etlReviewState = computed(() => (etlFlow.isActive.value ? etlFlow.state : null))

  return reactive({
    // state
    execution,
    files,
    loadStatus,
    loadErrors,
    rawLoadErrors,
    loadWarning,
    loadedFileNames,
    fromExecution,
    nameProposed,
    fromDataKeys,
    dataErrors,
    checks,
    launch,
    solution,
    etlFlow: markRaw(etlFlow),
    etlReviewState,
    etlNeedsSync,
    // configuration
    /** File extensions the data can be loaded from (e.g. `['xlsx', 'csv']`). */
    acceptedExtensions: instanceProcessing.supportedExtensions,
    dataSourceMode,
    canLoadFromDatabase,
    loadFilterFields,
    parameterFields,
    showParameters,
    showSolver,
    solvers,
    defaultSolver,
    developerMode,
    blockOnCheckErrors,
    hasChecks,
    // derived
    isLoaded,
    canLoad,
    filtersChanged,
    filesChanged,
    missingRequiredFilters,
    pendingChangesCount,
    errorCount,
    warningCount,
    missing,
    canLaunch,
    isLaunched,
    launchedExecution,
    launchedRunning,
    hasProgress,
    // actions
    addFiles,
    removeFile,
    setFilter,
    load,
    setInstance,
    setDataErrors,
    registerPendingChangesApplier,
    applyPendingChanges,
    markEtlChanged,
    setParameter,
    setName,
    setDescription,
    runChecks,
    setSolutionMode,
    setSolutionFile,
    launchExecution,
    reset,
    startFrom,
    saveDraft,
    readDraft,
    discardDraft,
    resumeDraft,
  })
}

export type ExecutionDraftController = ReturnType<typeof useExecutionDraft>
