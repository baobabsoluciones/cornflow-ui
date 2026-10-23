import { describe, test, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
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

const { store, processing, extensions, snackbar } = vi.hoisted(() => ({
  store: {} as Record<string, any>,
  processing: {
    processFiles: vi.fn(),
    processFromDb: vi.fn(),
    processInstanceData: vi.fn(),
  },
  extensions: { etlBackend: null as any },
  snackbar: vi.fn(),
}))

vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => store }))
vi.mock('@cornflow-ui/core/composables/useInstanceProcessing', () => ({
  useInstanceProcessing: () => ({ ...processing, supportedExtensions: ref(['json', 'xlsx']) }),
  buildInstanceDataFromAlternativeFields: vi.fn(() => ({ parameters: { horizon: 4 } })),
}))
vi.mock('@cornflow-ui/core/plugins/extensions', () => ({
  getPremiumEtlBackend: () => extensions.etlBackend,
  getPremiumExternalEtlFlow: () => null,
}))
vi.mock('@cornflow-ui/core/services/SnackbarService', () => ({ showSnackbar: snackbar }))
vi.mock('@cornflow-ui/core/services/AuthService', () => ({ default: { getUserId: () => '1' } }))
vi.mock('@cornflow-ui/core/composables/create-execution/solutionFile', () => ({
  parseSolutionFile: vi.fn(async () => ({ data: { plan: [] }, checkSchema: async () => [] })),
}))

import { useExecutionDraft } from '@cornflow-ui/core/composables/create-execution/useExecutionDraft'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'

const configFields = [
  { key: 'timeLimit', title: 'f.time', type: 'number', default: 300, required: true },
  { key: 'objective', title: 'f.objective', type: 'select', required: true, options: [{ value: 'cost', label: 'Cost' }] },
  { key: 'start', title: 'f.start', type: 'date', source: 'parameters', param: 'start' },
]

function resetStore() {
  Object.assign(store, {
    appConfig: {
      Instance: FakeInstance,
      parameters: {
        configFields: [...configFields],
        configFieldsConfig: { showConfigFieldsStep: true, autoLoadValues: false },
        solverConfig: { showSolverStep: true, defaultSolver: 'mip' },
        etl: { useEtlBackend: false, enableLoadFromDb: false, alternativeParameterFields: [] },
        enableBlockAdvanceOnCheckErrors: false,
      },
    },
    schemaConfig: {
      instanceSchema: { properties: { lines: { title: 'Lines', items: { properties: { cap: { title: 'Capacity' } } } } } },
      instanceChecksSchema: {
        properties: {
          missing: { title: 'Missing', is_warning: false },
          tight: { title: 'Tight', is_warning: true },
        },
      },
    },
    getSchemaConfig: { instanceSchema: {}, instanceChecksSchema: {} },
    getSchemaName: 'dag',
    getExecutionSolvers: ['mip', 'heuristic'],
    rawConfigurations: { masterData: {} },
    loadedExecutions: [] as any[],
    createInstance: vi.fn(async () => ({ id: 'i1' })),
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

const file = (name: string) => new File(['{}'], name)

describe('useExecutionDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
    extensions.etlBackend = null
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

  test('offers the database when the ETL can bring it, with the load filters first', () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    let draft = setup()
    expect(draft.dataSourceMode).toBe('database')
    expect(draft.canLoad).toBe(true)

    store.appConfig.parameters.configFields = [
      ...configFields,
      { key: 'plant', title: 'f.plant', type: 'select', preEtl: true, required: true, options: [] },
    ]
    draft = setup()
    expect(draft.dataSourceMode).toBe('database-filtered')
    expect(draft.loadFilterFields.map((f) => f.key)).toEqual(['plant'])
    expect(draft.parameterFields.map((f) => f.key)).not.toContain('plant')
    expect(draft.canLoad).toBe(false)
    draft.setFilter('plant', 'north')
    expect(draft.canLoad).toBe(true)
  })

  test('brings the database data without files and asks to reload when the filters change', async () => {
    extensions.etlBackend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    store.appConfig.parameters.etl = { useEtlBackend: true, enableLoadFromDb: true }
    store.appConfig.parameters.configFields = [
      ...configFields,
      { key: 'plant', title: 'f.plant', type: 'select', preEtl: true, options: [{ value: 'north', label: 'North' }] },
    ]
    processing.processFromDb.mockResolvedValue(loadedOk())
    const draft = setup()
    draft.setFilter('plant', 'north')
    await draft.load()

    expect(processing.processFromDb).toHaveBeenCalledWith(expect.objectContaining({ plant: 'north' }))
    expect(draft.execution.name).toContain('North')
    expect(draft.filtersChanged).toBe(false)
    draft.setFilter('plant', 'south')
    expect(draft.filtersChanged).toBe(true)
    expect(draft.missing.map((m) => m.key)).toContain('filters')
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
    expect(store.getInstanceDataChecksById).toHaveBeenCalledWith('i1', expect.any(Object))
    expect(draft.checks.status).toBe('errors')
    expect(draft.checks.results).toEqual([
      { key: 'missing', title: 'Missing', kind: 'error', rows: ['P-1 · 43'] },
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
})
