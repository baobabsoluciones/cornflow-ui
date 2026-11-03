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
    launch: { running: false, step: null, executionId: null, error: null },
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

describe('ChecksStatus, the states', () => {
  const result = (key: string, kind: 'error' | 'warning', rows: number) => ({
    key,
    title: `Check ${key}`,
    description: '',
    kind,
    columns: [{ key: 'row', title: 'Row' }],
    records: Array.from({ length: rows }, (_, i) => ({ row: i })),
  })
  const checkedAt = new Date(2026, 10, 2, 9, 30)
  const mountStatus = (props: Record<string, any>) => mount(ChecksStatus, { props, global: global() })
  const head = (wrapper: any) => [
    wrapper.find('.checks-status__title').text(),
    wrapper.find('.checks-status__subtitle').text(),
    wrapper.find('.checks-status__icon').classes().find((c: string) => c.startsWith('is-')),
  ]

  test('fine: says when the data was checked', () => {
    expect(head(mountStatus({ status: 'ok', checkedAt }))).toEqual([
      'createExecution.checks.ok',
      'createExecution.checks.checkedAt',
      'is-success',
    ])
    expect(mountStatus({ status: 'ok' }).find('.checks-status__subtitle').text()).toBe('createExecution.checks.checkedNow')
  })

  test('with warnings: they do not stop the launch', () => {
    expect(head(mountStatus({ status: 'warnings', checkedAt, results: [result('a', 'warning', 2)] }))).toEqual([
      'createExecution.checks.warnings',
      'createExecution.checks.checkedAt · createExecution.checks.notBlocking',
      'is-warning',
    ])
  })

  test('with errors and warnings: both counted; the errors stop the launch only when the app blocks on them', () => {
    const results = [result('a', 'error', 1), result('b', 'warning', 3)]
    expect(head(mountStatus({ status: 'errors', checkedAt, results }))).toEqual([
      'createExecution.checks.errors · createExecution.checks.warnings',
      'createExecution.checks.checkedAt · createExecution.checks.notBlocking',
      'is-danger',
    ])
    expect(mountStatus({ status: 'errors', results: [result('a', 'error', 1)] }).find('.checks-status__title').text()).toBe(
      'createExecution.checks.errors',
    )
  })

  test('out of date: the findings stay, greyed, and the button runs them again', () => {
    const wrapper = mountStatus({ status: 'stale', results: [result('a', 'error', 1)] })
    expect(head(wrapper)).toEqual(['createExecution.checks.stale', 'createExecution.checks.staleHint', 'is-warning'])
    expect(wrapper.find('.checks-status__results').classes()).toContain('is-stale')
    expect(wrapper.find('[data-testid="checks-run"]').text()).toBe('createExecution.checks.runAgain')
  })

  test('not run yet: says what checking does', () => {
    expect(head(mountStatus({ status: 'none' }))).toEqual([
      'createExecution.checks.none',
      'createExecution.checks.noneHint',
      'is-neutral',
    ])
  })

  test('lists six checks and opens the rest from "more"', async () => {
    const results = Array.from({ length: 8 }, (_, i) => result(String(i), 'warning', 1))
    const wrapper = mount(ChecksStatus, {
      props: { status: 'warnings', results },
      global: { plugins: [i18n()] },
      attachTo: document.body,
    })
    expect(wrapper.findAll('.checks-status__result:not(.is-more)')).toHaveLength(6)

    await wrapper.find('.checks-status__result.is-more').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="checks-detail"]')).not.toBeNull()
    wrapper.unmount()
  })

  test('"see detail" opens every check', async () => {
    const wrapper = mount(ChecksStatus, {
      props: { status: 'errors', results: [result('a', 'error', 1)] },
      global: { plugins: [i18n()] },
      attachTo: document.body,
    })
    await wrapper.find('[data-testid="checks-detail-open"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="checks-detail"]')).not.toBeNull()
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

  test('a field shows the hint of its placeholder key, and none when the key has no text', () => {
    const messages = { en: { f: { horizon: 'Horizon', horizonHint: 'Days to plan (1 to 28)' } } }
    const wrapper = mount(ExecutionParametersForm, {
      props: {
        fields: [
          { key: 'horizon', title: 'f.horizon', type: 'number', required: true, placeholder: 'f.horizonHint' },
          { key: 'gap', title: 'f.gap', type: 'float', required: true, placeholder: 'f.gapHint' },
        ],
        values: {},
      },
      global: { plugins: [createI18n({ legacy: false, locale: 'en', messages, missingWarn: false, fallbackWarn: false })] },
    })
    const inputs = wrapper.findAll('input')
    expect(inputs[0].attributes('placeholder')).toBe('Days to plan (1 to 28)')
    expect(inputs[1].attributes('placeholder')).toBeFalsy()
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

describe('ExecutionParametersForm with parameters of several values', () => {
  const regions = {
    key: 'regions',
    title: 'Regions',
    type: 'select',
    multiple: true,
    options: [
      { value: 'n', label: 'North' },
      { value: 's', label: 'South' },
      { value: 'e', label: 'East' },
    ],
  }
  const popover = { name: 'CorePopover', template: '<div><slot name="trigger" /><slot /></div>' }
  const mountForm = (props: Record<string, any>) =>
    mount(ExecutionParametersForm, {
      props: { values: {}, ...props },
      global: { ...global(), stubs: { teleport: true, CorePopover: popover } },
    })

  test('a required one is a dropdown with checks: each pick adds to the list, and none is no value', async () => {
    const wrapper = mountForm({ fields: [{ ...regions, required: true }], values: { regions: ['n'] } })
    expect(wrapper.find('.core-multi-select').exists()).toBe(true)

    const items = wrapper.findAll('.core-menu__item')
    await items[2].trigger('click')
    await items[0].trigger('click')

    expect(wrapper.emitted('change')).toEqual([
      ['regions', ['n', 'e']],
      ['regions', null],
    ])
  })

  test('an empty list is a missing value once the errors show', () => {
    const wrapper = mountForm({ fields: [{ ...regions, required: true }], values: { regions: [] }, showErrors: true })

    expect(wrapper.find('.parameters-form__required').classes()).toContain('is-missing')
  })

  test('with a default it folds into "Advanced", which names the picks', () => {
    const fields = [{ ...regions, default: ['n'] }]

    expect(mountForm({ fields, values: { regions: ['n', 's', 'e'] } }).find('.parameters-form__advanced-summary').text()).toBe(
      'North, South +1',
    )
    expect(mountForm({ fields, values: { regions: [] } }).find('.parameters-form__advanced-summary').text()).toBe('—')
  })

  test('offers to go back to the default list only when the picks differ from it', async () => {
    const fields = [{ ...regions, default: ['n', 's'] }]
    const reset = async (values: Record<string, any>) => {
      const wrapper = mountForm({ fields, values })
      await wrapper.find('[data-testid="parameters-advanced"]').trigger('click')
      return wrapper
    }

    expect((await reset({ regions: ['n', 's'] })).find('.parameters-form__reset').exists()).toBe(false)
    const changed = await reset({ regions: ['n'] })
    await changed.find('.parameters-form__reset').trigger('click')
    expect(changed.emitted('change')).toEqual([['regions', ['n', 's']]])
    expect((await reset({})).find('.parameters-form__reset').exists()).toBe(true)
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

  test('says why the last launch failed, and unfolds to say it', async () => {
    const draft = makeDraft({ canLaunch: true })
    draft.launchExecution.mockImplementation(async () => {
      draft.launch.error = 'The orchestrator is not reachable'
      return false
    })
    const wrapper = mount(LaunchPanel, { props: { draft, collapsed: true }, global: global() })
    expect(wrapper.find('[data-testid="launch-panel-error"]').exists()).toBe(false)

    await wrapper.find('.launch-panel__strip-resolve').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:collapsed')).toEqual([[false]])
    await wrapper.setProps({ collapsed: false })
    const error = wrapper.find('[data-testid="launch-panel-error"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('createExecution.launch.failed')
    expect(error.text()).toContain('The orchestrator is not reachable')
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

describe('LaunchPanel: name, checks, notes and the uploaded solution', () => {
  const mountPanel = (overrides: Record<string, any> = {}, props: Record<string, any> = {}) => {
    const draft = makeDraft(overrides)
    const wrapper = mount(LaunchPanel, { props: { draft, ...props }, global: global(), attachTo: document.body })
    return { draft, wrapper }
  }

  test('the name is typed in the panel, which says when it was proposed', async () => {
    const { draft, wrapper } = mountPanel({
      nameProposed: true,
      execution: { name: 'Plan week 43', config: {}, instance: null, description: '' },
    })
    expect(wrapper.text()).toContain('createExecution.launch.nameProposed')

    await wrapper.find('[data-testid="launch-panel-name"]').setValue('My plan')
    expect(draft.setName).toHaveBeenCalledWith('My plan')
    wrapper.unmount()
  })

  test('the description is a link until it is asked for or has a value', async () => {
    const { draft, wrapper } = mountPanel()
    expect(wrapper.find('textarea').exists()).toBe(false)

    await wrapper.find('.launch-panel__link').trigger('click')
    await wrapper.find('textarea').setValue('With overtime')
    expect(draft.setDescription).toHaveBeenCalledWith('With overtime')
    wrapper.unmount()

    const described = mountPanel({ execution: { name: '', config: {}, instance: null, description: 'Base' } })
    expect((described.wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('Base')
    described.wrapper.unmount()
  })

  test('a missing name takes the user to the field, outlined for a moment', async () => {
    vi.useFakeTimers()
    const { wrapper } = mountPanel({ missing: [{ key: 'name', text: 'The name is missing', target: 'name' }] })

    await wrapper.find('.launch-panel__missing-item').trigger('click')
    await flushPromises()
    const input = wrapper.find('[data-testid="launch-panel-name"]').element
    expect(input.closest('.core-text-field')!.classList).toContain('is-invalid')
    expect(document.activeElement).toBe(input)

    vi.advanceTimersByTime(1800)
    await flushPromises()
    expect(input.closest('.core-text-field')!.classList).not.toContain('is-invalid')
    vi.useRealTimers()
    wrapper.unmount()
  })

  test('a missing parameter shows the errors and points at it', async () => {
    const { wrapper } = mountPanel({
      parameterFields: [{ key: 'objective', title: 'Objective', type: 'select', required: true, options: [] }],
      missing: [{ key: 'param:objective', text: 'Objective is missing', target: 'param:objective' }],
    })
    await wrapper.find('.launch-panel__missing-item').trigger('click')

    const form = wrapper.findComponent(ExecutionParametersForm)
    expect(form.props('showErrors')).toBe(true)
    expect(form.props('highlight')).toBe('objective')
    wrapper.unmount()
  })

  test('a missing check outlines the checks', async () => {
    const { wrapper } = mountPanel({ missing: [{ key: 'checks', text: 'Run the checks', target: 'checks' }] })
    await wrapper.find('.launch-panel__missing-item').trigger('click')
    expect(wrapper.findComponent(ChecksStatus).props('highlight')).toBe(true)
    wrapper.unmount()
  })

  test('the checks show only when the DAG has them, and run from the panel', async () => {
    expect(mountPanel({ hasChecks: false }).wrapper.findComponent(ChecksStatus).exists()).toBe(false)

    const { draft, wrapper } = mountPanel({ isLoaded: true })
    expect(wrapper.findComponent(ChecksStatus).props('disabled')).toBe(false)
    await wrapper.find('[data-testid="checks-run"]').trigger('click')
    expect(draft.runChecks).toHaveBeenCalled()
    wrapper.unmount()
  })

  test('without parameters or a solver to pick there is no parameters section', () => {
    const { wrapper } = mountPanel()
    expect(wrapper.findComponent(ExecutionParametersForm).exists()).toBe(false)
    wrapper.unmount()
  })

  test.each([
    ['edits not applied yet', { pendingChangesCount: 2 }, 'createExecution.launch.pendingNote'],
    ['data not checked', {}, 'createExecution.launch.notCheckedNote'],
    ['checks out of date', { checks: { status: 'stale', results: [], checkedAt: null } }, 'createExecution.launch.staleNote'],
  ])('with nothing missing, a note says about %s', (_, overrides, text) => {
    const { wrapper } = mountPanel(overrides)
    expect(wrapper.find('.launch-panel__note').text()).toBe(text)
    wrapper.unmount()
  })

  test('no note while something is missing, nor once the checks are up to date', () => {
    const missing = mountPanel({ missing: [{ key: 'name', text: 'x', target: 'name' }] })
    expect(missing.wrapper.find('.launch-panel__note').exists()).toBe(false)
    const checked = mountPanel({ checks: { status: 'ok', results: [], checkedAt: new Date() } })
    expect(checked.wrapper.find('.launch-panel__note').exists()).toBe(false)
    missing.wrapper.unmount()
    checked.wrapper.unmount()
  })

  describe('folded', () => {
    test('says it is ready, and resolves from the strip', async () => {
      const { draft, wrapper } = mountPanel({ canLaunch: true }, { collapsed: true })
      expect(wrapper.find('.launch-panel__strip-label').text()).toBe('createExecution.launch.ready')
      expect(wrapper.find('.launch-panel__strip-status').classes()).toContain('is-ready')

      await wrapper.find('.launch-panel__strip-resolve').trigger('click')
      expect(draft.launchExecution).toHaveBeenCalled()
      wrapper.unmount()
    })

    test('says how much is missing, and cannot resolve', () => {
      const { wrapper } = mountPanel(
        { missing: [{ key: 'name', text: 'The name', target: 'name' }, { key: 'data', text: 'The data', target: 'data' }] },
        { collapsed: true },
      )
      expect(wrapper.find('.launch-panel__strip-label').text()).toBe('createExecution.launch.missingCount')
      expect(wrapper.find('.launch-panel__strip-status').attributes('title')).toBe('The name · The data')
      expect(wrapper.find('.launch-panel__strip-resolve').attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })

    test('folds and unfolds with its buttons', async () => {
      const { wrapper } = mountPanel()
      await wrapper.find('[aria-label="createExecution.launch.collapse"]').trigger('click')
      expect(wrapper.emitted('update:collapsed')).toEqual([[true]])

      await wrapper.setProps({ collapsed: true })
      await wrapper.find('[aria-label="createExecution.launch.expand"]').trigger('click')
      expect(wrapper.emitted('update:collapsed')?.at(-1)).toEqual([false])
      wrapper.unmount()
    })

    test('does not fold once launched', () => {
      const { wrapper } = mountPanel(
        { isLaunched: true, launchedExecution: { executionId: 'e1', state: 1, createdAt: '2026-10-23T10:00:00Z' } },
        { collapsed: true },
      )
      expect(wrapper.find('.launch-panel__strip').exists()).toBe(false)
      expect(wrapper.find('[aria-label="createExecution.launch.collapse"]').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  test.each([
    ['sync', 'createExecution.launch.syncing'],
    ['solution', 'createExecution.launch.uploadingSolution'],
    ['execution', 'createExecution.launch.creating'],
  ])('while launching, the button says the step (%s)', (step, text) => {
    const { wrapper } = mountPanel({ canLaunch: true, launch: { running: true, step, executionId: null, error: null } })
    expect(wrapper.find('[data-testid="launch-panel-resolve"]').text()).toContain(text)
    wrapper.unmount()
  })

  describe('an uploaded solution, in developer mode', () => {
    const popover = { name: 'CorePopover', template: '<div><slot name="trigger" /><slot /></div>' }
    const mountDeveloper = (solution: Record<string, any> = {}) => {
      const draft = makeDraft({
        developerMode: true,
        canLaunch: true,
        solution: { enabled: false, file: null, data: null, errors: null, ...solution },
      })
      const wrapper = mount(LaunchPanel, {
        props: { draft },
        global: { ...global(), stubs: { teleport: true, CorePopover: popover } },
      })
      return { draft, wrapper }
    }

    test('the menu turns the mode on and off', async () => {
      const off = mountDeveloper()
      expect(off.wrapper.find('.launch-panel__menu-item').text()).toBe('createExecution.launch.uploadSolution')
      await off.wrapper.find('.launch-panel__menu-item').trigger('click')
      expect(off.draft.setSolutionMode).toHaveBeenCalledWith(true)

      const on = mountDeveloper({ enabled: true })
      expect(on.wrapper.find('.launch-panel__menu-item').text()).toBe('createExecution.launch.solveNormally')
      await on.wrapper.find('.launch-panel__menu-item').trigger('click')
      expect(on.draft.setSolutionMode).toHaveBeenCalledWith(false)
    })

    test('the menu is only there in developer mode', () => {
      const { wrapper } = mountPanel({ canLaunch: true })
      expect(wrapper.find('[aria-label="createExecution.launch.moreOptions"]').exists()).toBe(false)
      wrapper.unmount()
    })

    test('the picked file goes to the draft, and the button says what it creates', async () => {
      const { draft, wrapper } = mountDeveloper({ enabled: true })
      expect(wrapper.find('[data-testid="launch-panel-resolve"]').text()).toContain('createExecution.launch.createWithSolution')
      expect(wrapper.find('.launch-panel__solution .launch-panel__link').text()).toBe('createExecution.launch.solutionPick')

      const input = wrapper.find('.launch-panel__solution input[type="file"]')
      const picked = new File(['{}'], 'solution.json')
      Object.defineProperty(input.element, 'files', { value: [picked], configurable: true })
      await input.trigger('change')
      expect(draft.setSolutionFile).toHaveBeenCalledWith(picked)
    })

    test('names the file once read, and says why one was not taken', () => {
      const read = mountDeveloper({ enabled: true, file: new File(['{}'], 'plan.json'), data: { plan: [] } })
      expect(read.wrapper.find('.launch-panel__solution-file').text()).toBe('plan.json')
      expect(read.wrapper.find('.launch-panel__solution .launch-panel__link').text()).toBe('createExecution.launch.solutionChange')

      const wrong = mountDeveloper({ enabled: true, file: new File(['{}'], 'plan.json'), errors: '<ul><li>/plan: must be array</li></ul>' })
      expect(wrong.wrapper.find('.launch-panel__solution-file').exists()).toBe(false)
      expect(wrong.wrapper.find('.launch-panel__solution-error').text()).toBe('/plan: must be array')
    })
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

  test('a load filter typed in shows the hint of its placeholder key', () => {
    const messages = { en: { f: { weekHint: 'First week, e.g. 2026-W44' } } }
    const draft = makeDraft({
      dataSourceMode: 'database-filtered',
      loadFilterFields: [{ key: 'week', title: 'Week', type: 'text', placeholder: 'f.weekHint' }],
    })
    const wrapper = mount(ExecutionDataCard, {
      props: { draft },
      global: { plugins: [createI18n({ legacy: false, locale: 'en', messages, missingWarn: false, fallbackWarn: false })] },
    })
    expect(wrapper.find('[data-testid="load-filters"] input').attributes('placeholder')).toBe('First week, e.g. 2026-W44')
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

describe('ExecutionDataCard: files, filters and Excel', () => {
  const popover = {
    name: 'CorePopover',
    props: ['open'],
    emits: ['update:open'],
    template: '<div class="popover-stub" :data-open="String(!!open)"><slot name="trigger" /><slot /></div>',
  }
  const mountCard = (overrides: Record<string, any> = {}) => {
    const draft = makeDraft(overrides)
    const wrapper = mount(ExecutionDataCard, {
      props: { draft },
      global: { ...global(), stubs: { teleport: true, CorePopover: popover } },
    })
    return { draft, wrapper }
  }
  const loaded = (overrides: Record<string, any> = {}) => ({
    isLoaded: true,
    loadStatus: 'loaded',
    execution: { instance: { data: { a: [1] } }, config: { plant: 'n' }, name: '', description: '' },
    ...overrides,
  })

  test('"Upload" opens the file picker, and the picked files are added', async () => {
    const { draft, wrapper } = mountCard()
    const input = wrapper.find('input[type="file"]')
    const click = vi.spyOn(input.element as HTMLInputElement, 'click')

    await wrapper.find('[data-testid="data-card-upload"]').trigger('click')
    expect(click).toHaveBeenCalled()

    const picked = [new File(['{}'], 'a.json'), new File(['{}'], 'b.json')]
    Object.defineProperty(input.element, 'files', { value: picked, configurable: true })
    await input.trigger('change')
    expect(draft.addFiles).toHaveBeenCalledWith(picked)
  })

  test('the drop zone is marked while a file is dragged over it', async () => {
    const { wrapper } = mountCard()
    const zone = wrapper.find('[data-testid="data-card-empty"]')

    await zone.trigger('dragover')
    expect(zone.classes()).toContain('is-dragging')
    await zone.trigger('dragleave')
    expect(zone.classes()).not.toContain('is-dragging')
  })

  test('lists the picked files, each with its cross, and marks them when the load failed', async () => {
    const files = [new File(['{}'], 'a.json'), new File(['{}'], 'b.json')]
    const { draft, wrapper } = mountCard({ files, loadStatus: 'error' })
    const chips = wrapper.findAll('.data-card__file')

    expect(chips.map((c) => c.find('.data-card__file-name').text())).toEqual(['a.json', 'b.json'])
    expect(chips[0].classes()).toContain('is-error')
    await chips[1].find('.data-card__file-remove').trigger('click')
    expect(draft.removeFile).toHaveBeenCalledWith(1)
  })

  test('says what the load warned about', () => {
    const { wrapper } = mountCard(loaded({ loadWarning: 'Two rows were left out' }))
    expect(wrapper.text()).toContain('Two rows were left out')
  })

  test('the Excel menu downloads the data on screen', async () => {
    const { wrapper } = mountCard(loaded())
    await flushPromises()
    await wrapper.findAll('.data-card__menu-item')[0].trigger('click')
    expect(review.downloadExcel).toHaveBeenCalled()
  })

  describe('the load filters, once loaded', () => {
    const plant = { key: 'plant', title: 'Plant', type: 'select', required: true, options: [{ value: 'n', label: 'North' }, { value: 's', label: 'South' }] }
    const filtersPopover = (wrapper: any) =>
      wrapper.findAllComponents({ name: 'CorePopover' }).find((p: any) => p.find('.data-card__filters-panel').exists())

    test('are edited apart and reload the data with the new values', async () => {
      const { draft, wrapper } = mountCard(loaded({ loadFilterFields: [plant] }))
      await flushPromises()
      filtersPopover(wrapper).vm.$emit('update:open', true)
      await flushPromises()

      await wrapper.find('.data-card__filters-panel select').setValue('1')
      expect(draft.setFilter).not.toHaveBeenCalled()
      const reload = wrapper.findAll('.data-card__filters-actions button').at(-1)!
      await reload.trigger('click')
      await flushPromises()

      expect(draft.setFilter).toHaveBeenCalledWith('plant', 's')
      expect(draft.load).toHaveBeenCalled()
      expect(filtersPopover(wrapper).attributes('data-open')).toBe('false')
    })

    test('cannot reload with a required filter empty, and cancelling keeps the data as it is', async () => {
      const { draft, wrapper } = mountCard(loaded({ loadFilterFields: [plant] }))
      await flushPromises()
      filtersPopover(wrapper).vm.$emit('update:open', true)
      await flushPromises()

      await wrapper.find('.data-card__filters-panel select').setValue('')
      const [cancel, reload] = wrapper.findAll('.data-card__filters-actions button')
      expect(reload.attributes('disabled')).toBeDefined()

      await cancel.trigger('click')
      expect(filtersPopover(wrapper).attributes('data-open')).toBe('false')
      expect(draft.setFilter).not.toHaveBeenCalled()
      expect(draft.load).not.toHaveBeenCalled()
    })

    test('say when they no longer match the data on screen', () => {
      const { wrapper } = mountCard(loaded({ loadFilterFields: [plant], filtersChanged: true }))
      expect(wrapper.find('.data-card__stale').text()).toBe('createExecution.data.filtersChanged')
    })
  })
})
