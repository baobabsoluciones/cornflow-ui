import { describe, test, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const { store } = vi.hoisted(() => ({
  store: {
    fetchTableOptions: vi.fn(async () => [{ value: 7, title: 'North plant' }]),
    getConfigurations: { masterData: {} },
    appConfig: { parameters: {} },
  } as Record<string, any>,
}))
vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => store }))
vi.mock('@cornflow-ui/core/components/project-execution/CreateExecutionReviewInstance.vue', () => ({
  default: {
    name: 'CreateExecutionReviewInstance',
    props: ['newExecution', 'instanceErrors', 'isEditMode', 'externalEtlFlow', 'isStepActive'],
    template: '<div data-testid="review" />',
    methods: { applyPendingChanges: () => Promise.resolve(true) },
  },
}))

import ChecksStatus from '@cornflow-ui/core/components/create-execution/ChecksStatus.vue'
import ExecutionParametersForm from '@cornflow-ui/core/components/create-execution/ExecutionParametersForm.vue'
import LaunchPanel from '@cornflow-ui/core/components/create-execution/LaunchPanel.vue'
import ExecutionDataCard from '@cornflow-ui/core/components/create-execution/ExecutionDataCard.vue'

const i18n = () =>
  createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false })
const global = () => ({ plugins: [i18n()], stubs: { teleport: true } })

/** A draft as `useExecutionDraft` returns it, with only what each test needs set. */
function makeDraft(overrides: Record<string, any> = {}) {
  return reactive({
    execution: { instance: null, config: {}, name: '', description: '' },
    files: [] as File[],
    loadStatus: 'empty',
    loadErrors: null,
    rawLoadErrors: null,
    loadWarning: null,
    fromExecution: null,
    nameProposed: false,
    fromDataKeys: [],
    dataErrors: null,
    checks: { status: 'none', results: [], checkedAt: null },
    launch: { running: false, step: null, executionId: null },
    solution: { enabled: false, file: null, data: null, errors: null },
    etlReviewState: null,
    acceptedExtensions: ['json', 'xlsx'],
    dataSourceMode: 'files',
    loadFilterFields: [],
    alternativeFields: [],
    parameterFields: [],
    showParameters: true,
    showSolver: false,
    solvers: [],
    defaultSolver: 'mip',
    developerMode: false,
    blockOnCheckErrors: false,
    hasChecks: true,
    isLoaded: false,
    canLoad: false,
    filtersChanged: false,
    filesChanged: false,
    missingRequiredFilters: [],
    pendingChangesCount: 0,
    missing: [],
    canLaunch: false,
    isLaunched: false,
    launchedExecution: null,
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    setFilter: vi.fn(),
    load: vi.fn(),
    loadFromParameters: vi.fn(),
    setInstance: vi.fn(),
    setDataErrors: vi.fn(),
    registerPendingChangesApplier: vi.fn(),
    setParameter: vi.fn(),
    setName: vi.fn(),
    setDescription: vi.fn(),
    runChecks: vi.fn(),
    setSolutionMode: vi.fn(),
    setSolutionFile: vi.fn(),
    launchExecution: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }) as any
}

describe('ChecksStatus', () => {
  test('offers to check when the data has not been checked', async () => {
    const wrapper = mount(ChecksStatus, { props: { status: 'none' }, global: global() })
    expect(wrapper.text()).toContain('createExecution.checks.none')
    await wrapper.find('[data-testid="checks-run"]').trigger('click')
    expect(wrapper.emitted('run')).toHaveLength(1)
  })

  test('hides the button while running', () => {
    const wrapper = mount(ChecksStatus, { props: { status: 'running' }, global: global() })
    expect(wrapper.find('[data-testid="checks-run"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('createExecution.checks.running')
  })

  test('lists what the checks found, errors open', () => {
    const wrapper = mount(ChecksStatus, {
      props: {
        status: 'errors',
        blocking: true,
        results: [
          { key: 'a', title: 'Missing products', kind: 'error', rows: ['P-1 · 43', 'P-2 · 44'] },
          { key: 'b', title: 'Tight capacity', kind: 'warning', rows: ['L2 · 97,5'] },
        ],
      },
      global: global(),
    })
    expect(wrapper.text()).toContain('Missing products')
    expect(wrapper.text()).toContain('P-1 · 43')
    expect(wrapper.text()).not.toContain('L2 · 97,5')
    expect(wrapper.text()).toContain('createExecution.checks.fixBeforeLaunch')
  })
})

describe('ExecutionParametersForm', () => {
  const fields = [
    { key: 'objective', title: 'Objective', type: 'select', required: true, options: [{ value: 'cost', label: 'Cost' }, { value: 'service', label: 'Service' }] },
    { key: 'start', title: 'Start', type: 'date' },
    { key: 'gap', title: 'Gap', type: 'float', default: 0.01 },
    { key: 'overtime', title: 'Overtime', type: 'boolean', default: false },
  ]

  test('shows the fields to decide on and folds the ones with a default', async () => {
    const wrapper = mount(ExecutionParametersForm, {
      props: { fields, values: { gap: 0.01, overtime: false }, solvers: ['mip', 'greedy'], defaultSolver: 'mip' },
      global: global(),
    })
    const labels = () => wrapper.findAll('.parameters-form__label').map((l) => l.text())
    expect(labels()).toEqual(['Objective', 'Start'])
    expect(wrapper.find('.parameters-form__advanced-summary').text()).toBe('— · 0,01 · Overtime: createexecution.parameters.no')

    await wrapper.find('[data-testid="parameters-advanced"]').trigger('click')
    expect(labels()).toEqual(['Objective', 'Start', 'createExecution.parameters.solver', 'Gap', 'Overtime'])
  })

  test('picks an option and says a value came from the data', async () => {
    const wrapper = mount(ExecutionParametersForm, {
      props: { fields, values: { start: '2026-10-26' }, fromData: ['start'] },
      global: global(),
    })
    expect(wrapper.text()).toContain('createExecution.parameters.fromData')
    await wrapper.findAll('[role="radio"]')[1].trigger('click')
    expect(wrapper.emitted('change')).toEqual([['objective', 'service']])
  })

  test('takes the options of a field fed by a table', async () => {
    const wrapper = mount(ExecutionParametersForm, {
      props: { fields: [{ key: 'plant', title: 'Plant', type: 'select', joinFrom: 'plants.name', required: true }], values: {} },
      global: global(),
    })
    await flushPromises()
    expect(store.fetchTableOptions).toHaveBeenCalledWith('plants.name')
    expect(wrapper.text()).toContain('North plant')
  })
})

describe('LaunchPanel', () => {
  test('lists what is missing and points outside for the data', async () => {
    const draft = makeDraft({
      missing: [
        { key: 'data', text: 'The data is missing', target: 'data' },
        { key: 'name', text: 'The name is missing', target: 'name' },
      ],
    })
    const wrapper = mount(LaunchPanel, { props: { draft }, global: global() })
    expect(wrapper.find('[data-testid="launch-panel-resolve"]').attributes('disabled')).toBeDefined()
    const items = wrapper.findAll('.launch-panel__missing-item')
    expect(items.map((i) => i.text())).toEqual(['The data is missing', 'The name is missing'])
    await items[0].trigger('click')
    expect(wrapper.emitted('go')).toEqual([['data']])
  })

  test('applies the pending changes when it resolves', async () => {
    const draft = makeDraft({ canLaunch: true, pendingChangesCount: 2 })
    const wrapper = mount(LaunchPanel, { props: { draft }, global: global() })
    const resolve = wrapper.find('[data-testid="launch-panel-resolve"]')
    expect(resolve.text()).toContain('createExecution.launch.applyAndResolve')
    await resolve.trigger('click')
    expect(draft.launchExecution).toHaveBeenCalled()
  })

  test('folds into a strip that still says whether it can launch', async () => {
    const draft = makeDraft({ missing: [{ key: 'name', text: 'x', target: 'name' }] })
    const wrapper = mount(LaunchPanel, { props: { draft, collapsed: true }, global: global() })
    expect(wrapper.find('.launch-panel__strip').exists()).toBe(true)
    expect(wrapper.find('.launch-panel__strip-status').classes()).toContain('is-missing')
  })

  test('follows the execution once launched', () => {
    const draft = makeDraft({
      isLaunched: true,
      execution: { name: 'Plan 43', config: {}, instance: null, description: '' },
      launchedExecution: { executionId: 'e1', state: 1, createdAt: '2026-10-23T10:00:00Z' },
    })
    const wrapper = mount(LaunchPanel, { props: { draft }, global: global() })
    expect(wrapper.find('[data-testid="launch-result"]').text()).toContain('Plan 43')
    expect(wrapper.find('[data-testid="launch-result-view"]').attributes('disabled')).toBeUndefined()
  })
})

describe('ExecutionDataCard', () => {
  test('with files only, it is a drop zone that adds what is dropped', async () => {
    const draft = makeDraft()
    const wrapper = mount(ExecutionDataCard, { props: { draft }, global: global() })
    expect(wrapper.text()).toContain('createExecution.data.dropTitle')
    const dropped = new File(['{}'], 'a.json')
    await wrapper.find('[data-testid="data-card-empty"]').trigger('drop', { dataTransfer: { files: [dropped] } })
    expect(draft.addFiles).toHaveBeenCalledWith([dropped])
  })

  test('with the database and filters, it asks for the filters before getting the data', async () => {
    const draft = makeDraft({
      dataSourceMode: 'database-filtered',
      canLoad: true,
      loadFilterFields: [{ key: 'plant', title: 'Plant', type: 'select', required: true, options: [{ value: 'n', label: 'North' }] }],
    })
    const wrapper = mount(ExecutionDataCard, { props: { draft }, global: global() })
    expect(wrapper.find('[data-testid="load-filters"]').exists()).toBe(true)
    await wrapper.find('[data-testid="data-card-get-data"]').trigger('click')
    expect(draft.load).toHaveBeenCalled()
  })

  test('shows the load errors grouped by table', () => {
    const draft = makeDraft({
      loadStatus: 'error',
      files: [new File(['{}'], 'bad.json')],
      loadErrors: { count: 2, groups: [{ table: 'lines', title: 'Lines', items: ['Row 1: bad', 'Row 2: bad'] }] },
    })
    const wrapper = mount(ExecutionDataCard, { props: { draft }, global: global() })
    const errors = wrapper.find('[data-testid="data-card-errors"]')
    expect(errors.text()).toContain('Lines')
    expect(errors.text()).toContain('Row 2: bad')
  })

  test('once loaded, it shows the tables and sums the data up', async () => {
    const draft = makeDraft({
      isLoaded: true,
      loadStatus: 'loaded',
      execution: { instance: { data: { a: [1, 2], b: { x: 1 } } }, config: {}, name: '', description: '' },
    })
    const wrapper = mount(ExecutionDataCard, { props: { draft }, global: global() })
    await flushPromises()
    expect(wrapper.find('[data-testid="review"]').exists()).toBe(true)
    expect(wrapper.find('.data-card__meta').text()).toBe('createExecution.data.size')
    expect(draft.registerPendingChangesApplier).toHaveBeenCalledWith(expect.any(Function))
  })
})
