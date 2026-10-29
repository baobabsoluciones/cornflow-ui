import { describe, test, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const { store, review } = vi.hoisted(() => ({
  review: { downloadExcel: vi.fn(), uploadExcel: vi.fn(), toggleMaximize: vi.fn() },
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
    props: ['newExecution', 'instanceErrors', 'isEditMode', 'externalEtlFlow', 'isStepActive', 'showToolbar'],
    template: '<div data-testid="review" :data-toolbar="String(showToolbar)" />',
    methods: {
      applyPendingChanges: () => Promise.resolve(true),
      downloadExcel: () => review.downloadExcel(),
      uploadExcel: () => review.uploadExcel(),
      toggleMaximize: () => review.toggleMaximize(),
    },
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

  const checkResults = [
    {
      key: 'a',
      title: 'Missing products',
      description: '',
      kind: 'error',
      columns: [{ key: 'product', title: 'Product' }, { key: 'week', title: 'Week' }],
      records: [{ product: 'P-1', week: 43 }, { product: 'P-2', week: 44 }],
    },
    {
      key: 'b',
      title: 'Tight capacity',
      description: 'Lines above 95 %',
      kind: 'warning',
      columns: [{ key: 'line', title: 'Line' }],
      records: [{ line: 'L2' }],
    },
  ]

  test('lists each check on one line with how many rows it found', () => {
    const wrapper = mount(ChecksStatus, {
      props: { status: 'errors', blocking: true, results: checkResults },
      global: global(),
    })
    const lines = wrapper.findAll('.checks-status__result')
    expect(lines.map((l) => l.find('.checks-status__result-title').text())).toEqual(['Missing products', 'Tight capacity'])
    expect(lines.map((l) => l.find('.checks-status__result-count').text())).toEqual(['2', '1'])
    expect(wrapper.text()).not.toContain('P-1')
    expect(wrapper.text()).toContain('createExecution.checks.fixBeforeLaunch')
  })

  test('a check opens the detail on its table, which can be searched', async () => {
    const wrapper = mount(ChecksStatus, {
      props: { status: 'errors', results: checkResults },
      // The dialog is portalled to the body, as on screen.
      global: { plugins: [i18n()] },
      attachTo: document.body,
    })
    await wrapper.findAll('.checks-status__result')[1].trigger('click')
    await flushPromises()
    const detail = document.body.querySelector('[data-testid="checks-detail"]')!
    expect(detail.querySelector('.checks-detail__title')?.textContent).toBe('Tight capacity')
    expect([...detail.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Line'])

    detail.querySelectorAll<HTMLButtonElement>('.checks-detail__check')[0].click()
    await flushPromises()
    expect([...detail.querySelectorAll('tbody tr')].map((tr) => tr.textContent)).toEqual(['P-143', 'P-244'])
    const search = detail.querySelector<HTMLInputElement>('.checks-detail__search input')!
    search.value = 'p-2'
    search.dispatchEvent(new Event('input'))
    await flushPromises()
    expect([...detail.querySelectorAll('tbody tr')].map((tr) => tr.textContent)).toEqual(['P-244'])
    wrapper.unmount()
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

  test.each([
    ['files', {}],
    ['database', { dataSourceMode: 'database' }],
  ])('with %s, it says which formats the app accepts', (_mode, overrides) => {
    const messages = { en: { createExecution: { data: { formats: 'Accepted formats: {formats}' } } } }
    const draft = makeDraft({ acceptedExtensions: ['xlsx', 'csv'], ...overrides })
    const wrapper = mount(ExecutionDataCard, {
      props: { draft },
      global: { plugins: [createI18n({ legacy: false, locale: 'en', messages, missingWarn: false })] },
    })
    expect(wrapper.find('[data-testid="data-card-formats"]').text()).toBe('Accepted formats: Excel or CSV')
  })

  test('does not offer the formats while the data loads', () => {
    const draft = makeDraft({ loadStatus: 'loading', files: [new File(['{}'], 'a.json')] })
    const wrapper = mount(ExecutionDataCard, { props: { draft }, global: global() })
    expect(wrapper.find('[data-testid="data-card-formats"]').exists()).toBe(false)
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

  test('with files only, it still asks for the load filters the ETL gets with them', async () => {
    const draft = makeDraft({
      files: [new File(['{}'], 'a.xlsx')],
      loadFilterFields: [{ key: 'full', title: 'Full', type: 'boolean', required: true }],
    })
    const wrapper = mount(ExecutionDataCard, { props: { draft }, global: global() })
    const select = wrapper.find('[data-testid="load-filters"] select')
    expect(select.findAll('option').map((o) => o.text())).toEqual([
      'createExecution.data.choose',
      'createExecution.data.yes',
      'createExecution.data.no',
    ])
    await select.setValue('1')
    expect(draft.setFilter).toHaveBeenCalledWith('full', false)
  })

  test('a load filter of several values is a dropdown with checks, and once loaded the header names the picks', async () => {
    const field = {
      key: 'product_ids',
      title: 'Products',
      type: 'select',
      multiple: true,
      options: [
        { value: 3, label: 'P-003' },
        { value: 7, label: 'P-007' },
        { value: 9, label: 'P-009' },
      ],
    }
    const draft = makeDraft({ dataSourceMode: 'database-filtered', loadFilterFields: [field] })
    const popover = { name: 'CorePopover', template: '<div><slot name="trigger" /><slot /></div>' }
    const wrapper = mount(ExecutionDataCard, {
      props: { draft },
      global: { ...global(), stubs: { teleport: true, CorePopover: popover } },
    })
    const filters = wrapper.find('[data-testid="load-filters"]')
    expect(filters.find('.core-multi-select').exists()).toBe(true)
    await filters.findAll('.core-menu__item')[1].trigger('click')
    expect(draft.setFilter).toHaveBeenCalledWith('product_ids', [7])

    const loaded = makeDraft({
      isLoaded: true,
      loadStatus: 'loaded',
      loadFilterFields: [field],
      execution: { instance: { data: {} }, config: { product_ids: [3, 7, 9] }, name: '', description: '' },
    })
    const card = mount(ExecutionDataCard, { props: { draft: loaded }, global: global() })
    await flushPromises()
    expect(card.find('.data-card__meta').text()).toContain('P-003, P-007 +1')
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

  test('once loaded, the header holds the Excel actions of the review and maximize', async () => {
    const draft = makeDraft({
      isLoaded: true,
      loadStatus: 'loaded',
      execution: { instance: { data: { a: [1] } }, config: {}, name: '', description: '' },
    })
    const popover = { name: 'CorePopover', template: '<div><slot name="trigger" /><slot /></div>' }
    const wrapper = mount(ExecutionDataCard, {
      props: { draft },
      global: { ...global(), stubs: { teleport: true, CorePopover: popover } },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="review"]').attributes('data-toolbar')).toBe('false')
    expect(wrapper.find('[data-testid="data-card-upload"]').exists()).toBe(false)
    expect(wrapper.find('.data-card__review').attributes('data-table-bounds')).toBeDefined()

    await wrapper.find('[aria-label="projectExecution.maximize"]').trigger('click')
    expect(review.toggleMaximize).toHaveBeenCalled()

    const items = wrapper.findAll('.data-card__menu-item')
    expect(items.map((i) => i.text())).toEqual(['projectExecution.downloadExcel', 'projectExecution.uploadExcel'])
    await items[1].trigger('click')
    expect(review.uploadExcel).toHaveBeenCalled()
  })
})
