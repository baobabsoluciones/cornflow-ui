import { describe, test, expect, vi, beforeEach } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

class FakeInstance {
  id: string | null
  data: any
  dataChecks: any
  constructor(id: string | null, data: any, _s?: any, _c?: any, _n?: any, dataChecks: any = {}) {
    this.id = id
    this.data = data
    this.dataChecks = dataChecks
  }
}

const { store, processing, extensions, snackbar, drafts } = vi.hoisted(() => ({
  store: {} as Record<string, any>,
  processing: {
    processFiles: vi.fn(),
    processFromDb: vi.fn(),
  },
  extensions: { etlBackend: null as any, etlFlow: null as any },
  snackbar: vi.fn(),
  drafts: new Map<string, any>(),
}))

vi.mock('@cornflow-ui/core/stores/general', async () => {
  const { reactive } = await import('vue')
  return { useGeneralStore: () => reactive(store) }
})
vi.mock('@cornflow-ui/core/composables/useInstanceProcessing', () => ({
  useInstanceProcessing: () => ({ ...processing, supportedExtensions: ref(['json', 'xlsx']) }),
}))
vi.mock('@cornflow-ui/core/plugins/extensions', () => ({
  getPremiumEtlBackend: () => extensions.etlBackend,
  getPremiumExternalEtlFlow: () => extensions.etlFlow,
}))
vi.mock('@cornflow-ui/core/services/SnackbarService', () => ({ showSnackbar: snackbar }))
vi.mock('@cornflow-ui/core/services/AuthService', () => ({ default: { getUserId: () => '1' } }))
vi.mock('@cornflow-ui/core/composables/create-execution/executionDraftStore', () => ({
  draftKey: (schema: string, user: string) => `${schema}:${user}`,
  readExecutionDraft: async (key: string) => drafts.get(key) ?? null,
  writeExecutionDraft: async (key: string, draft: any) => {
    // IndexedDB clones files as they are; jsdom's File does not survive structuredClone
    drafts.set(key, { ...structuredClone({ ...draft, files: [] }), files: [...draft.files] })
    return true
  },
  deleteExecutionDraft: async (key: string) => drafts.delete(key),
}))
vi.mock('@cornflow-ui/core/composables/create-execution/solutionFile', () => ({
  parseSolutionFile: vi.fn(async () => ({ data: { plan: [] }, checkSchema: async () => [] })),
}))

import { useExecutionDraft } from '@cornflow-ui/core/composables/create-execution/useExecutionDraft'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'
import config from '@cornflow-ui/core/config'
import { parseSolutionFile } from '@cornflow-ui/core/composables/create-execution/solutionFile'

const configFields = [
  { key: 'timeLimit', title: 'f.time', type: 'number', default: 300, required: true },
  { key: 'objective', title: 'f.objective', type: 'select', required: true, options: [{ value: 'cost', label: 'Cost' }] },
  { key: 'start', title: 'f.start', type: 'date', source: 'parameters', param: 'start' },
]

/** The ETL review as the ETL module keeps it: switches per table, sent with `/etl/update/`. */
function fakeEtlFlow() {
  const state = reactive<any>({
    initialData: null,
    currentData: null,
    metadata: null,
    tableSwitches: {},
    parameterSwitches: {},
    parameterTableNames: new Set(),
  })
  return {
    state,
    isActive: computed(() => state.metadata !== null),
    initializeFromEtlResponse(data: any) {
      const { __metadata__, ...rest } = data
      state.initialData = structuredClone(data)
      state.currentData = rest
      state.metadata = __metadata__ ?? null
      state.tableSwitches = Object.fromEntries(
        (__metadata__?.tables_from_db ?? []).map((t: string) => [t, { variant: 'from_db', fixed: false }]),
      )
      state.parameterSwitches = {}
    },
    submitUpdate: vi.fn(async (data: any) => ({ data: { ...data, synced: true }, warning: null })),
    reset() {
      state.initialData = null
      state.currentData = null
      state.metadata = null
      state.tableSwitches = {}
      state.parameterSwitches = {}
    },
  }
}

function resetStore() {
  Object.assign(store, {
    appConfig: {
      Instance: FakeInstance,
      parameters: {
        configFields: [...configFields],
        configFieldsConfig: { showConfigFieldsStep: true, autoLoadValues: false },
        solverConfig: { showSolverStep: true, defaultSolver: 'mip' },
        etl: { useEtlBackend: false },
        enableBlockAdvanceOnCheckErrors: false,
      },
    },
    schemaConfig: {
      instanceSchema: { properties: { lines: { title: 'Lines', items: { properties: { cap: { title: 'Capacity' } } } } } },
      instanceChecksSchema: {
        properties: {
          missing: { title: 'Missing', is_warning: false, items: { properties: { product: { title: 'Product' } } } },
          tight: { title: 'Tight', is_warning: true },
        },
      },
    },
    getSchemaConfig: { instanceSchema: {}, instanceChecksSchema: {} },
    getSchemaName: 'dag',
    getLoadFilterFields: [],
    getExecutionSolvers: ['mip', 'heuristic'],
    rawConfigurations: { masterData: {} },
    loadedExecutions: [] as any[],
    createInstance: vi.fn(async () => ({ id: 'i1', schema: 'instance_dag' })),
    getInstanceDataChecksById: vi.fn(),
    createExecution: vi.fn(async () => ({ id: 'e1' })),
    uploadSolutionData: vi.fn(async () => true),
    fetchLoadedExecution: vi.fn(async (id: string) => {
      store.loadedExecutions.push({ executionId: id, state: -7, createdAt: '' })
      return true
    }),
  })
}

function setup() {
  let draft: ReturnType<typeof useExecutionDraft>
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false })
  mount(
    defineComponent({
      setup() {
        draft = useExecutionDraft()
        return () => h('div')
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return draft!
}

const loadedOk = (data: any = { lines: [], parameters: { start: '2026-10-26' } }) => ({
  success: true,
  instance: new FakeInstance(null, data),
  errors: null,
  rawErrors: null,
})

const etlLoaded = () => ({
  ...loadedOk({ lines: [] }),
  rawData: { lines: [], __metadata__: { tables_from_db: ['lines'] } },
})

const file = (name: string) => new File(['{}'], name)

describe('useExecutionDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
    extensions.etlBackend = null
    extensions.etlFlow = null
    drafts.clear()
    useTableChanges().clearAllChanges()
  })

  test('starts saying the data, the name and the required parameters are missing', () => {
    const draft = setup()
    expect(draft.missing.map((m) => m.key)).toEqual(['data', 'name', 'param:objective'])
    expect(draft.canLaunch).toBe(false)
    expect(draft.execution.config).toMatchObject({ timeLimit: 300, solver: 'mip' })
  })

  test('loads the picked files, proposes a name and takes the parameters the data has', async () => {
    processing.processFiles.mockResolvedValue(loadedOk())
    const draft = setup()
    draft.addFiles([file('plan_week_43.json')])
    await draft.load()

    expect(processing.processFiles).toHaveBeenCalledWith([expect.any(File)], expect.any(Object))
    expect(draft.isLoaded).toBe(true)
    expect(draft.execution.name).toBe('Plan week 43')
    expect(draft.nameProposed).toBe(true)
    expect(draft.execution.config.start).toBe('2026-10-26')
    expect(draft.fromDataKeys).toEqual(['start'])
    expect(draft.missing.map((m) => m.key)).toEqual(['param:objective'])
  })

  test('a name the user typed survives a reload', async () => {
    processing.processFiles.mockResolvedValue(loadedOk())
    const draft = setup()
    draft.setName('My plan')
    draft.addFiles([file('a.json')])
    await draft.load()
    expect(draft.execution.name).toBe('My plan')
  })

  test('schema errors leave the data out and are grouped by table', async () => {
    processing.processFiles.mockResolvedValue({
      success: false,
      instance: null,
      errors: '<p>bad</p>',
      rawErrors: [{ instancePath: '/lines/0/cap', keyword: 'type', params: { type: 'number' } }],
    })
    const draft = setup()
    draft.addFiles([file('bad.json')])
    await draft.load()

    expect(draft.loadStatus).toBe('error')
    expect(draft.loadErrors?.groups[0].title).toBe('Lines')
    expect(draft.missing[0].key).toBe('data')
    draft.removeFile(0)
    expect(draft.loadStatus).toBe('empty')
  })

  test('offers the database when the app brings it through the ETL, with the load filters first', () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    let draft = setup()
    expect(draft.dataSourceMode).toBe('database')
    expect(draft.canLoad).toBe(true)

    store.getLoadFilterFields = [{ key: 'plant', title: '', label: 'Plant', type: 'select', required: true, options: [] }]
    draft = setup()
    expect(draft.dataSourceMode).toBe('database-filtered')
    expect(draft.loadFilterFields.map((f) => f.key)).toEqual(['plant'])
    expect(draft.canLoad).toBe(false)
    draft.setFilter('plant', 'north')
    expect(draft.canLoad).toBe(true)
  })

  test('without the ETL module the database is not offered', () => {
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    const draft = setup()
    expect(draft.dataSourceMode).toBe('files')
  })

  test('the load filters keep their values apart from the execution config', () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    store.getLoadFilterFields = [
      { key: 'total_weeks', title: '', label: 'Total weeks', type: 'number', default: 3 },
      { key: 'plant', title: '', label: 'Plant', type: 'select', options: [] },
    ]
    const draft = setup()
    expect(draft.filters).toEqual({ total_weeks: 3 })
    draft.setFilter('plant', 4)

    expect(draft.filters).toEqual({ total_weeks: 3, plant: 4 })
    expect(draft.execution.config).not.toHaveProperty('plant')
    expect(draft.execution.config).not.toHaveProperty('total_weeks')
  })

  test('a load filter with inConfig also fills that key of the execution config', async () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    store.appConfig.parameters.configFields = [
      ...configFields,
      { key: 'region_code', title: 'f.region', type: 'text' },
    ]
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    store.getLoadFilterFields = [
      { key: 'region', title: '', label: 'Region', type: 'select', default: 'north', inConfig: 'region_code', options: [] },
    ]
    processing.processFromDb.mockResolvedValue(loadedOk())
    store.getInstanceDataChecksById.mockResolvedValue(new FakeInstance('i1', {}))
    const draft = setup()
    expect(draft.execution.config.region_code).toBe('north')
    // The filter asks it: the parameters do not ask it again.
    expect(draft.parameterFields.map((f) => f.key)).not.toContain('region_code')

    draft.setFilter('region', 'south')
    expect(draft.execution.config.region_code).toBe('south')
    await draft.load()
    expect(processing.processFromDb).toHaveBeenCalledWith({ region: 'south' })
    await draft.runChecks()
    expect(store.getInstanceDataChecksById).toHaveBeenCalledWith(
      'i1',
      'instance_dag',
      expect.objectContaining({ region_code: 'south' }),
    )

    draft.setFilter('region', null)
    expect(draft.execution.config).not.toHaveProperty('region_code')
  })

  test('a load filter fed by a table takes its rows as options', async () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    store.fetchTableOptions = vi.fn(async () => [{ value: 7, title: 'North plant' }])
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    store.getLoadFilterFields = [{ key: 'plant_id', title: '', label: 'Plant', type: 'select', joinFrom: 'plants.name' }]
    const draft = setup()
    await flushPromises()
    expect(store.fetchTableOptions).toHaveBeenCalledWith('plants.name')
    expect(draft.loadFilterFields[0].options).toEqual([{ value: 7, label: 'North plant' }])
  })

  test('a DAG switch asks the options of a load filter fed by a table again, for the new DAG', async () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    const plantsByDag: Record<string, { value: number; title: string }[]> = {
      dag_a: [{ value: 7, title: 'North plant' }],
      dag_b: [{ value: 9, title: 'East plant' }],
    }
    const activeStore = reactive(store)
    activeStore.getSchemaName = 'dag_a'
    store.fetchTableOptions = vi.fn(async () => plantsByDag[activeStore.getSchemaName])
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    store.getLoadFilterFields = [{ key: 'plant_id', title: '', label: 'Plant', type: 'select', joinFrom: 'plants.name' }]
    const draft = setup()
    await flushPromises()
    expect(draft.loadFilterFields[0].options).toEqual([{ value: 7, label: 'North plant' }])

    activeStore.getSchemaName = 'dag_b'
    await flushPromises()

    expect(store.fetchTableOptions).toHaveBeenCalledTimes(2)
    expect(draft.loadFilterFields[0].options).toEqual([{ value: 9, label: 'East plant' }])
  })

  test('a DAG switch asks the load filters of the new DAG, keeping the values both share', async () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    const activeStore = reactive(store)
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    activeStore.getLoadFilterFields = [
      { key: 'plant', title: '', label: 'Plant', type: 'number' },
      { key: 'total_weeks', title: '', label: 'Total weeks', type: 'number', default: 3 },
    ]
    const draft = setup()
    draft.setFilter('plant', 4)
    draft.setFilter('total_weeks', 5)

    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    activeStore.getLoadFilterFields = [
      { key: 'plant', title: '', label: 'Plant', type: 'number' },
      { key: 'min_date', title: '', label: 'From', type: 'date', default: '2026-01-05' },
    ]
    await flushPromises()

    expect(draft.loadFilterFields.map((f) => f.key)).toEqual(['plant', 'min_date'])
    expect(draft.filters).toEqual({ plant: 4, min_date: '2026-01-05' })

    activeStore.getLoadFilterFields = []
    await flushPromises()
    expect(draft.loadFilterFields).toEqual([])
    expect(draft.filters).toEqual({})
  })

  test('brings the database data without files and asks to reload when the filters change', async () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    store.getLoadFilterFields = [
      { key: 'plant', title: '', label: 'Plant', type: 'select', options: [{ value: 'north', label: 'North' }] },
    ]
    processing.processFromDb.mockResolvedValue(loadedOk())
    const draft = setup()
    draft.setFilter('plant', 'north')
    await draft.load()

    expect(processing.processFromDb).toHaveBeenCalledWith({ plant: 'north' })
    expect(draft.execution.name).toContain('North')
    expect(draft.filtersChanged).toBe(false)
    draft.setFilter('plant', 'south')
    expect(draft.filtersChanged).toBe(true)
    expect(draft.missing.map((m) => m.key)).toContain('filters')
  })

  test('the proposed name names the picks of a load filter of several values', async () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    store.getLoadFilterFields = [
      {
        key: 'products',
        title: '',
        label: 'Products',
        type: 'select',
        multiple: true,
        options: [
          { value: 3, label: 'P-003' },
          { value: 7, label: 'P-007' },
          { value: 9, label: 'P-009' },
    ],
        },
      ]
    processing.processFromDb.mockResolvedValue(loadedOk())
    const draft = setup()
    draft.setFilter('products', [3, 7, 9])
    await draft.load()

    expect(draft.execution.name).toMatch(/ · P-003, P-007 \+1$/)
  })

  test('the checks run on a stored instance and say what they found', async () => {
    processing.processFiles.mockResolvedValue(loadedOk())
    store.getInstanceDataChecksById.mockResolvedValue(
      new FakeInstance('i1', {}, null, null, null, {
        missing: [{ product: 'P-1', week: 43 }],
        tight: [],
      }),
    )
    const draft = setup()
    draft.addFiles([file('a.json')])
    await draft.load()
    await draft.runChecks()

    expect(store.createInstance).toHaveBeenCalled()
    // The checks run under the DAG of the instance just created, not the active one.
    expect(store.getInstanceDataChecksById).toHaveBeenCalledWith(
      'i1',
      'instance_dag',
      expect.any(Object),
    )
    expect(draft.checks.status).toBe('errors')
    expect(draft.checks.results).toEqual([
      {
        key: 'missing',
        title: 'Missing',
        description: '',
        kind: 'error',
        columns: [{ key: 'product', title: 'Product' }, { key: 'week', title: 'Week' }],
        records: [{ product: 'P-1', week: 43 }],
      },
    ])
    expect(draft.execution.instance.id).toBe('i1')
    expect(draft.missing.map((m) => m.key)).not.toContain('checks')

    draft.setInstance(new FakeInstance(null, {}))
    expect(draft.checks.status).toBe('stale')
  })

  test('check errors stop the launch when the app blocks on them', async () => {
    store.appConfig.parameters.enableBlockAdvanceOnCheckErrors = true
    processing.processFiles.mockResolvedValue(loadedOk())
    store.getInstanceDataChecksById.mockResolvedValue(
      new FakeInstance('i1', {}, null, null, null, { missing: [{ product: 'P-1' }] }),
    )
    const draft = setup()
    draft.addFiles([file('a.json')])
    await draft.load()
    await draft.runChecks()
    expect(draft.missing.map((m) => m.key)).toContain('checks')
  })

  test('launches the execution and follows it', async () => {
    processing.processFiles.mockResolvedValue(loadedOk())
    const draft = setup()
    draft.addFiles([file('a.json')])
    await draft.load()
    draft.setParameter('objective', 'cost')
    expect(draft.canLaunch).toBe(true)

    expect(await draft.launchExecution()).toBe(true)
    expect(store.createExecution).toHaveBeenCalledWith(expect.objectContaining({ name: 'A' }), '')
    expect(store.fetchLoadedExecution).toHaveBeenCalledWith('e1')
    expect(draft.isLaunched).toBe(true)
    expect(draft.launchedExecution?.executionId).toBe('e1')
    expect(draft.hasProgress).toBe(false)
  })

  test('a launch the backend refuses says why, until the next attempt', async () => {
    processing.processFiles.mockResolvedValue(loadedOk())
    const draft = setup()
    draft.addFiles([file('a.json')])
    await draft.load()
    draft.setParameter('objective', 'cost')
    store.createExecution.mockRejectedValueOnce(new Error('The orchestrator is not reachable'))

    expect(await draft.launchExecution()).toBe(false)
    expect(draft.launch.error).toBe('The orchestrator is not reachable')
    expect(draft.isLaunched).toBe(false)
    expect(draft.hasProgress).toBe(true)

    expect(await draft.launchExecution()).toBe(true)
    expect(draft.launch.error).toBeNull()
  })

  test('applies the pending edits before launching, and stops if they cannot be applied', async () => {
    processing.processFiles.mockResolvedValue(loadedOk())
    const draft = setup()
    draft.addFiles([file('a.json')])
    await draft.load()
    draft.setParameter('objective', 'cost')
    useTableChanges().recordChange('lines', 'r1', 'cap', 1, 2)

    const apply = vi.fn(async () => false)
    draft.registerPendingChangesApplier(apply)
    expect(await draft.launchExecution()).toBe(false)
    expect(apply).toHaveBeenCalled()
    expect(store.createExecution).not.toHaveBeenCalled()

    apply.mockResolvedValue(true)
    expect(await draft.launchExecution()).toBe(true)
  })

  test('creates the execution with an uploaded solution instead of running the solver', async () => {
    processing.processFiles.mockResolvedValue(loadedOk())
    const draft = setup()
    draft.addFiles([file('a.json')])
    await draft.load()
    draft.setParameter('objective', 'cost')
    draft.setSolutionMode(true)
    expect(draft.canLaunch).toBe(false)
    await draft.setSolutionFile(file('solution.json'))
    await flushPromises()
    expect(draft.canLaunch).toBe(true)

    await draft.launchExecution()
    expect(store.createExecution).toHaveBeenCalledWith(expect.any(Object), '?run=0')
    expect(store.uploadSolutionData).toHaveBeenCalledWith('e1', { plan: [] })
  })

  test('a relaunch is an editable copy of the execution it comes from', () => {
    const draft = setup()
    draft.startFrom({
      name: 'Plan 42',
      description: 'Base',
      config: { objective: 'cost', timeLimit: 600 },
      experiment: { instance: new FakeInstance('i9', { lines: [] }) },
    })
    expect(draft.isLoaded).toBe(true)
    expect(draft.fromExecution).toBe('Plan 42')
    expect(draft.execution.description).toBe('Base')
    expect(draft.execution.config).toMatchObject({ objective: 'cost', timeLimit: 600 })
    expect(draft.execution.name).toBe('createExecution.name.relaunch')
    expect(draft.loadFilterFields).toEqual([])
  })

  test('without the parameters step the values are settled from the data', async () => {
    store.appConfig.parameters.configFieldsConfig = { showConfigFieldsStep: false, autoLoadValues: true }
    processing.processFiles.mockResolvedValue(loadedOk())
    const draft = setup()
    expect(draft.parameterFields).toEqual([])
    draft.addFiles([file('a.json')])
    await draft.load()
    expect(draft.execution.config).toMatchObject({ timeLimit: 300, start: '2026-10-26' })
  })

  test('the load filters are asked with files too, and sent with them to the ETL', async () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    store.getLoadFilterFields = [{ key: 'full', title: '', label: 'Full', type: 'boolean', required: true }]
    processing.processFiles.mockResolvedValue(loadedOk())
    const draft = setup()
    expect(draft.dataSourceMode).toBe('files')
    expect(draft.loadFilterFields.map((f) => f.key)).toEqual(['full'])
    draft.addFiles([file('a.xlsx')])
    expect(draft.canLoad).toBe(false)
    draft.setFilter('full', false)
    expect(draft.canLoad).toBe(true)
    await draft.load()
    expect(processing.processFiles).toHaveBeenCalledWith([expect.any(File)], { full: false })
  })

  test('the ETL review is sent to the backend before the checks, and its result is what runs', async () => {
    extensions.etlFlow = fakeEtlFlow()
    processing.processFiles.mockResolvedValue(etlLoaded())
    store.getInstanceDataChecksById.mockResolvedValue(new FakeInstance('i1', { lines: [], synced: true }))
    const draft = setup()
    draft.addFiles([file('a.xlsx')])
    await draft.load()
    expect(draft.etlReviewFlow?.state.tableSwitches).toEqual({ lines: { variant: 'from_db', fixed: false } })
    expect(draft.etlNeedsSync).toBe(true)

    await draft.runChecks()
    expect(extensions.etlFlow.submitUpdate).toHaveBeenCalledWith({ lines: [] })
    expect(store.createInstance).toHaveBeenCalledWith(
      expect.objectContaining({ instance: expect.objectContaining({ data: { lines: [], synced: true } }) }),
    )
    expect(draft.etlNeedsSync).toBe(false)

    draft.setParameter('objective', 'cost')
    await draft.launchExecution()
    expect(extensions.etlFlow.submitUpdate).toHaveBeenCalledTimes(1)
  })

  test('the launch sends the ETL review first when the checks did not', async () => {
    extensions.etlFlow = fakeEtlFlow()
    processing.processFiles.mockResolvedValue(etlLoaded())
    const draft = setup()
    draft.addFiles([file('a.xlsx')])
    await draft.load()
    draft.setParameter('objective', 'cost')
    extensions.etlFlow.state.tableSwitches.lines.fixed = true
    await flushPromises()

    expect(await draft.launchExecution()).toBe(true)
    expect(extensions.etlFlow.submitUpdate).toHaveBeenCalledWith({ lines: [] })
    expect(store.createExecution).toHaveBeenCalledWith(
      expect.objectContaining({ instance: expect.objectContaining({ data: { lines: [], synced: true } }) }),
      '',
    )
  })

  test('a failed ETL sync stops the launch, and the panel says why', async () => {
    extensions.etlFlow = fakeEtlFlow()
    extensions.etlFlow.submitUpdate.mockRejectedValue(new Error('ETL down'))
    processing.processFiles.mockResolvedValue(etlLoaded())
    const draft = setup()
    draft.addFiles([file('a.xlsx')])
    await draft.load()
    draft.setParameter('objective', 'cost')

    expect(await draft.launchExecution()).toBe(false)
    expect(store.createExecution).not.toHaveBeenCalled()
    expect(draft.launch.error).toBe('ETL down')
    expect(draft.etlNeedsSync).toBe(true)
  })

  test('a failed ETL sync before the checks says why', async () => {
    extensions.etlFlow = fakeEtlFlow()
    extensions.etlFlow.submitUpdate.mockRejectedValue(new Error(''))
    processing.processFiles.mockResolvedValue(etlLoaded())
    const draft = setup()
    draft.addFiles([file('a.xlsx')])
    await draft.load()

    await draft.runChecks()

    expect(store.createInstance).not.toHaveBeenCalled()
    expect(snackbar).toHaveBeenCalledWith('createExecution.snackbar.syncError', 'error')
  })

  test('a draft keeps the ETL review and its switches, still to be sent', async () => {
    extensions.etlFlow = fakeEtlFlow()
    processing.processFiles.mockResolvedValue(etlLoaded())
    let draft = setup()
    draft.addFiles([file('a.xlsx')])
    await draft.load()
    extensions.etlFlow.state.tableSwitches.lines.fixed = true
    await draft.saveDraft()

    extensions.etlFlow = fakeEtlFlow()
    draft = setup()
    const saved = await draft.readDraft()
    await draft.resumeDraft(saved!)
    expect(draft.etlReviewFlow?.state.tableSwitches).toEqual({ lines: { variant: 'from_db', fixed: true } })
    expect(draft.etlNeedsSync).toBe(true)

    draft.setParameter('objective', 'cost')
    await draft.launchExecution()
    expect(extensions.etlFlow.submitUpdate).toHaveBeenCalledWith({ lines: [] })
  })

  test('the launch waits while the checks run', async () => {
    processing.processFiles.mockResolvedValue(loadedOk())
    let finish: (value: any) => void = () => {}
    store.getInstanceDataChecksById.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const draft = setup()
    draft.addFiles([file('a.json')])
    await draft.load()
    draft.setParameter('objective', 'cost')

    const running = draft.runChecks()
    await flushPromises()
    expect(draft.missing.map((m) => m.key)).toContain('checks')
    expect(draft.canLaunch).toBe(false)
    finish(new FakeInstance('i1', {}))
    await running
    expect(draft.canLaunch).toBe(true)
  })

  test('a relaunch runs with the default solver when the app does not let the user pick one', () => {
    store.appConfig.parameters.solverConfig = { showSolverStep: false, defaultSolver: 'mip' }
    const draft = setup()
    draft.startFrom({
      name: 'Plan 42',
      config: { solver: 'heuristic' },
      experiment: { instance: new FakeInstance('i9', { lines: [] }) },
    })
    expect(draft.execution.config.solver).toBe('mip')
  })

  test('a load that fails outright shows why', async () => {
    processing.processFiles.mockRejectedValue(new Error('The file is not a workbook'))
    const draft = setup()
    draft.addFiles([file('a.xlsx')])
    await draft.load()

    expect(draft.loadStatus).toBe('error')
    expect(draft.loadErrors?.groups[0].items).toEqual(['The file is not a workbook'])
  })

  test('picking a file again replaces the one with its name, and clears the errors of the last load', async () => {
    processing.processFiles.mockRejectedValue(new Error('bad'))
    const draft = setup()
    draft.addFiles([file('a.json'), file('b.json')])
    await draft.load()
    expect(draft.loadStatus).toBe('error')

    draft.addFiles([file('a.json')])

    expect(draft.files.map((f) => f.name)).toEqual(['b.json', 'a.json'])
    expect(draft.loadStatus).toBe('empty')
    expect(draft.loadErrors).toBeNull()
  })

  test('a required parameter of several values is missing while nothing is picked', () => {
    store.appConfig.parameters.configFields = [
      { key: 'regions', title: 'f.regions', type: 'select', multiple: true, required: true, options: [{ value: 'n', label: 'North' }] },
    ]
    const draft = setup()
    draft.setParameter('regions', [])
    expect(draft.missing.map((m) => m.key)).toContain('param:regions')

    draft.setParameter('regions', ['n'])
    expect(draft.missing.map((m) => m.key)).not.toContain('param:regions')
  })

  describe('checks', () => {
    const loaded = async () => {
      processing.processFiles.mockResolvedValue(loadedOk())
      const draft = setup()
      draft.addFiles([file('a.json')])
      await draft.load()
      return draft
    }

    test('only warnings leave the data good to launch, and no findings is ok', async () => {
      const draft = await loaded()
      store.getInstanceDataChecksById.mockResolvedValueOnce(
        new FakeInstance('i1', {}, null, null, null, { tight: [{ line: 'L1' }, { line: 'L2' }] }),
      )
      await draft.runChecks()
      expect(draft.checks.status).toBe('warnings')
      expect(draft.checks.results.map((r) => [r.key, r.kind])).toEqual([['tight', 'warning']])

      store.getInstanceDataChecksById.mockResolvedValueOnce(new FakeInstance('i1', {}))
      await draft.runChecks()
      expect(draft.checks.status).toBe('ok')
      expect(draft.checks.results).toEqual([])
    })

    test('errors come first, then the checks that found the most', async () => {
      const draft = await loaded()
      store.getInstanceDataChecksById.mockResolvedValueOnce(
        new FakeInstance('i1', {}, null, null, null, {
          tight: [{ line: 'L1' }, { line: 'L2' }],
          missing: [{ product: 'P-1' }],
        }),
      )
      await draft.runChecks()
      expect(draft.checks.results.map((r) => r.key)).toEqual(['missing', 'tight'])
    })

    test.each([
      ['the instance cannot be stored', () => store.createInstance.mockResolvedValueOnce(null), 'projectExecution.snackbar.instanceCreationError'],
      ['the checks do not come back', () => store.getInstanceDataChecksById.mockResolvedValueOnce(null), 'projectExecution.snackbar.instanceDataChecksError'],
    ])('when %s, nothing is checked and it says so', async (_, fail, message) => {
      const draft = await loaded()
      fail()
      await draft.runChecks()

      expect(draft.checks.status).toBe('none')
      expect(draft.checks.checkedAt).toBeNull()
      expect(snackbar).toHaveBeenCalledWith(message, 'error')
    })

    test('do not run before there is data', async () => {
      const draft = setup()
      await draft.runChecks()
      expect(store.createInstance).not.toHaveBeenCalled()
    })
  })

  test('developer mode is on from the app config, or for one deployment from its values', () => {
    expect(setup().developerMode).toBe(false)

    store.appConfig.parameters.isDeveloperMode = true
    expect(setup().developerMode).toBe(true)

    store.appConfig.parameters.isDeveloperMode = false
    config.isDeveloperMode = true
    try {
      expect(setup().developerMode).toBe(true)
    } finally {
      config.isDeveloperMode = false
    }
  })

  describe('an uploaded solution', () => {
    const loadedForSolution = async () => {
      processing.processFiles.mockResolvedValue(loadedOk())
      const draft = setup()
      draft.addFiles([file('a.json')])
      await draft.load()
      draft.setParameter('objective', 'cost')
      draft.setSolutionMode(true)
      return draft
    }

    test('that breaks the solution schema keeps the launch waiting, and says why', async () => {
      vi.mocked(parseSolutionFile).mockResolvedValueOnce({
        data: { plan: 'x' },
        checkSchema: async () => [{ instancePath: '/plan', message: 'must be array' }],
      } as any)
      const draft = await loadedForSolution()
      await draft.setSolutionFile(file('solution.json'))

      expect(draft.solution.data).toBeNull()
      expect(draft.solution.errors).toBeTruthy()
      expect(draft.canLaunch).toBe(false)
    })

    test('that cannot be read keeps the launch waiting, and says why', async () => {
      vi.mocked(parseSolutionFile).mockRejectedValueOnce(new Error('Not JSON'))
      const draft = await loadedForSolution()
      await draft.setSolutionFile(file('solution.json'))

      expect(draft.solution.errors).toBe('Not JSON')
      expect(draft.canLaunch).toBe(false)
    })

    test('a file picked while the last one is read is the one that counts', async () => {
      let finishFirst: (parsed: any) => void = () => {}
      vi.mocked(parseSolutionFile)
        .mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)))
        .mockResolvedValueOnce({ data: { plan: ['second'] }, checkSchema: async () => [] } as any)
      const draft = await loadedForSolution()

      const first = draft.setSolutionFile(file('first.json'))
      await draft.setSolutionFile(file('second.json'))
      finishFirst({ data: { plan: ['first'] }, checkSchema: async () => [] })
      await first

      expect(draft.solution.file?.name).toBe('second.json')
      expect(draft.solution.data).toEqual({ plan: ['second'] })
    })

    test('dropping the file while it is read leaves no solution', async () => {
      let finish: (parsed: any) => void = () => {}
      vi.mocked(parseSolutionFile).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
      const draft = await loadedForSolution()

      const reading = draft.setSolutionFile(file('solution.json'))
      draft.setSolutionMode(false)
      finish({ data: { plan: [] }, checkSchema: async () => [{ message: 'late' }] })
      await reading

      expect(draft.solution.data).toBeNull()
      expect(draft.solution.errors).toBeNull()
    })

    test('turning the mode off drops the file', async () => {
      const draft = await loadedForSolution()
      await draft.setSolutionFile(file('solution.json'))
      draft.setSolutionMode(false)

      expect(draft.solution.file).toBeNull()
      expect(draft.solution.data).toBeNull()
      expect(draft.canLaunch).toBe(true)
    })

    test('that the backend does not take fails the launch, and says why', async () => {
      const draft = await loadedForSolution()
      await draft.setSolutionFile(file('solution.json'))
      store.uploadSolutionData.mockResolvedValueOnce(false)

      expect(await draft.launchExecution()).toBe(false)
      expect(draft.launch.error).toBe('projectExecution.steps.step8.developerMode.uploadError')
      expect(store.fetchLoadedExecution).not.toHaveBeenCalled()
    })
  })

  describe('drafts', () => {
    test('a draft puts back the data, its edits not applied, the name and the parameters, and is then gone', async () => {
      processing.processFiles.mockResolvedValue(loadedOk({ lines: [{ id: 'r1', cap: 1 }] }))
      let draft = setup()
      draft.addFiles([file('plan.json')])
      await draft.load()
      draft.setName('Week 44')
      draft.setDescription('With overtime')
      draft.setParameter('objective', 'cost')
      useTableChanges().recordChange('lines', 'r1', 'cap', 1, 2)
      expect(await draft.saveDraft()).toBe(true)

      useTableChanges().clearAllChanges()
      draft = setup()
      const saved = await draft.readDraft()
      expect(saved).toMatchObject({ name: 'Week 44', pendingChangesCount: 1, loadedFileNames: ['plan.json'] })
      await draft.resumeDraft(saved!)

      expect(draft.isLoaded).toBe(true)
      expect(draft.execution.instance.data).toEqual({ lines: [{ id: 'r1', cap: 1 }] })
      expect(draft.execution).toMatchObject({ name: 'Week 44', description: 'With overtime' })
      expect(draft.execution.config).toMatchObject({ objective: 'cost', timeLimit: 300 })
      expect(draft.pendingChangesCount).toBe(1)
      expect(draft.filesChanged).toBe(false)
      expect(draft.etlNeedsSync).toBe(false)
      expect(await draft.readDraft()).toBeNull()
    })

    test('a draft puts back the load filters and the ones the data was brought with', async () => {
      extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
      store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
      store.getLoadFilterFields = [{ key: 'plant', title: '', label: 'Plant', type: 'number' }]
      processing.processFromDb.mockResolvedValue(loadedOk())
      let draft = setup()
      draft.setFilter('plant', 4)
      await draft.load()
      draft.setFilter('plant', 5)
      await draft.saveDraft()

      draft = setup()
      await draft.resumeDraft((await draft.readDraft())!)

      expect(draft.filters).toEqual({ plant: 5 })
      expect(draft.filtersChanged).toBe(true)
    })

    test('a draft saved before loading keeps the picked files only', async () => {
      let draft = setup()
      draft.addFiles([file('plan.json')])
      await draft.saveDraft()

      draft = setup()
      await draft.resumeDraft((await draft.readDraft())!)

      expect(draft.files.map((f) => f.name)).toEqual(['plan.json'])
      expect(draft.isLoaded).toBe(false)
      expect(draft.loadStatus).toBe('empty')
    })

    test('a draft of a relaunch is still a relaunch', async () => {
      let draft = setup()
      draft.startFrom({ name: 'Plan 42', config: {}, experiment: { instance: new FakeInstance('i9', { lines: [] }) } })
      await draft.saveDraft()

      draft = setup()
      await draft.resumeDraft((await draft.readDraft())!)

      expect(draft.fromExecution).toBe('Plan 42')
    })

    test('discarding it leaves none', async () => {
      const draft = setup()
      draft.addFiles([file('plan.json')])
      await draft.saveDraft()
      await draft.discardDraft()

      expect(await draft.readDraft()).toBeNull()
    })
  })

  test('a relaunch of an execution without its data leaves the screen empty', () => {
    const draft = setup()
    draft.startFrom({ name: 'Plan 42', config: {} })

    expect(draft.isLoaded).toBe(false)
    expect(draft.fromExecution).toBeNull()
  })
})
