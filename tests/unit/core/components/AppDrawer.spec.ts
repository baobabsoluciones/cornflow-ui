import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

const { state, auth, snackbar, appConfig } = vi.hoisted(() => ({
  state: { store: null as any, sections: [] as any[], executions: null as any },
  auth: { logout: vi.fn() },
  snackbar: vi.fn(),
  appConfig: {
    getCore: vi.fn(),
    getInstanceDependentAppRoutePrefixes: () => [],
  },
}))

vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => state.store }))
vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({ default: vi.fn(async () => auth) }))
vi.mock('@cornflow-ui/core/services/SnackbarService', () => ({ showSnackbar: snackbar }))
vi.mock('@/app/config', () => ({ default: appConfig }))
vi.mock('@cornflow-ui/core/config', () => ({ default: { name: 'Planner' } }))
vi.mock('@cornflow-ui/core/composables/navigation/useDrawerSections', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useDrawerSections: () => ({ sections: computed(() => state.sections), isAdmin: computed(() => false) }),
}))
vi.mock('@cornflow-ui/core/composables/navigation/useDrawerExecutions', () => ({
  useDrawerExecutions: () => state.executions,
}))

import AppDrawer from '@cornflow-ui/core/components/AppDrawer.vue'

const SECTIONS = [
  {
    key: 'executions',
    scope: 'general',
    title: 'Executions',
    icon: 'mdi-chart-timeline-variant',
    subPages: [
      { title: 'History', icon: 'mdi-history', to: '/history-execution' },
      { title: 'Execution', icon: 'mdi-play-circle-outline', to: '/project-execution' },
    ],
  },
  {
    key: 'master-data',
    scope: 'general',
    title: 'Master data',
    icon: 'mdi-database',
    subPages: [
      { title: 'Plants', to: '/configuration/plants' },
      { title: 'Group', to: '/configuration/group/group', subPages: [{ title: 'Lines', to: '/configuration/lines' }] },
    ],
  },
  { key: 'app-0', scope: 'general', title: 'Agent', icon: 'mdi-robot', to: '/agent' },
]

const EXECUTION_SECTIONS = [
  {
    key: 'input-data',
    scope: 'execution',
    title: 'Input data',
    icon: 'mdi-application-cog',
    subPages: [{ title: 'Orders', to: '/input-data/orders' }],
  },
  {
    key: 'results',
    scope: 'execution',
    title: 'Results',
    icon: 'mdi-chart-box',
    subPages: [{ title: 'Plan', to: '/results/plan' }],
  },
]

const latest = [
  { id: 'e1', name: 'Plan 44', date: '26 Oct · 10:42', status: { label: 'Optimal', tone: 'success', spin: false } },
  { id: 'e2', name: 'Plan 43', date: '19 Oct · 08:50', status: { label: 'Infeasible', tone: 'danger', spin: false } },
]

function makeExecutions() {
  return {
    loaded: ref(null),
    latest: ref(latest),
    loadingRecent: ref(false),
    opening: ref(null),
    refresh: vi.fn(async () => {}),
    open: vi.fn(async () => true),
  }
}

function makeRouter() {
  const routes = [
    '/history-execution',
    '/project-execution',
    '/configuration/plants',
    '/configuration/lines',
    '/configuration/group/group',
    '/agent',
    '/input-data/orders',
    '/results/plan',
    '/user-settings',
    '/sign-in',
  ].map((path) => ({ path, component: { template: '<div />' } }))
  return createRouter({ history: createMemoryHistory(), routes })
}

const i18n = () =>
  createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false })

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function pointer(wrapper: any, type: 'pointerenter' | 'pointerleave', pointerType = 'mouse') {
  await wrapper.find('[data-testid="app-drawer"]').trigger(type, { pointerType })
  await pause(250)
}

async function mountDrawer(path = '/history-execution') {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AppDrawer, {
    global: { plugins: [i18n(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('AppDrawer', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    auth.logout.mockResolvedValue(undefined)
    appConfig.getCore.mockReturnValue({ parameters: { showOpenIdUsername: false } })
    state.sections = SECTIONS
    state.executions = makeExecutions()
    state.store = reactive({
      isDrawerPinned: false,
      setDrawerPinned(value: boolean) {
        this.isDrawerPinned = value
      },
      getUser: { username: 'planner', fullName: 'Plan Ner', email: 'planner@example.com' },
      getSchemaName: 'planning_dag',
      selectedExecution: null,
      isMultiSchemaDeployment: false,
      noSchemaAccess: false,
      availableSchemas: ['planning_dag'],
      canSwitchSchema: false,
      loadedExecutions: [],
      setActiveSchema: vi.fn(async function (this: any, schema: string) {
        this.getSchemaName = schema
        return true
      }),
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  test('folded, it is a rail with one button per group and the loaded execution', async () => {
    ;({ wrapper } = await mountDrawer())
    expect(wrapper.find('[data-testid="app-drawer"]').classes()).not.toContain('is-expanded')
    const buttons = wrapper.findAll('.app-drawer__rail-block.is-general .app-drawer__rail-button')
    expect(buttons.map((b: any) => b.attributes('aria-label'))).toEqual(['Executions', 'Master data', 'Agent'])
    expect(buttons[0].classes()).toContain('is-active')
    expect(wrapper.find('[data-testid="app-drawer-rail-execution"]').exists()).toBe(true)
  })

  test("the loaded execution's groups go with it, apart from the shared ones", async () => {
    state.sections = [...SECTIONS, ...EXECUTION_SECTIONS]
    ;({ wrapper } = await mountDrawer('/results/plan'))
    const railLabels = (block: string) =>
      wrapper.findAll(`.app-drawer__rail-block.is-${block} .app-drawer__rail-button`).map((b: any) => b.attributes('aria-label'))
    expect(railLabels('execution')).toEqual(['drawer.loadedExecution', 'Input data', 'Results'])
    expect(railLabels('general')).toEqual(['Executions', 'Master data', 'Agent'])

    state.store.isDrawerPinned = true
    await flushPromises()
    const heads = (block: string) =>
      wrapper.findAll(`[data-testid="app-drawer-${block}-block"] .drawer-group__head`).map((h: any) => h.text())
    expect(heads('execution')).toEqual([expect.stringContaining('Input data'), expect.stringContaining('Results')])
    expect(heads('general')).toEqual([
      expect.stringContaining('Executions'),
      expect.stringContaining('Master data'),
      'Agent',
    ])
    expect(wrapper.find('[data-testid="app-drawer-execution-block"] .drawer-group__page.is-active').text()).toBe('Plan')
  })

  test('with no execution loaded, its block says what will show there', async () => {
    state.store.isDrawerPinned = true
    ;({ wrapper } = await mountDrawer())
    expect(wrapper.find('.app-drawer__hint').text()).toBe('drawer.executionHint')
  })

  test('the header shows the app name, and with several DAGs the active one', async () => {
    state.store.isDrawerPinned = true
    ;({ wrapper } = await mountDrawer())
    expect(wrapper.find('.app-drawer__app-name').text()).toBe('Planner')
    expect(wrapper.find('.app-drawer__module').exists()).toBe(false)
    wrapper.unmount()

    state.store.isMultiSchemaDeployment = true
    state.store.getSchemaName = 'stock_dag'
    appConfig.getCore.mockReturnValue({ parameters: { schemaLabels: { stock_dag: 'Stock' } } })
    ;({ wrapper } = await mountDrawer())
    expect(wrapper.find('.app-drawer__app-name').text()).toBe('Planner')
    expect(wrapper.find('.app-drawer__module').text()).toBe('Stock')
  })

  test('for a user who may switch DAG, the header is the module selector', async () => {
    state.store.isDrawerPinned = true
    state.store.isMultiSchemaDeployment = true
    state.store.canSwitchSchema = true
    state.store.availableSchemas = ['planning_dag', 'stock_dag']
    appConfig.getCore.mockReturnValue({ parameters: { schemaLabels: { planning_dag: 'Planning', stock_dag: 'Stock' } } })
    ;({ wrapper } = await mountDrawer())
    const trigger = wrapper.find('[data-testid="app-drawer-module"]')
    expect(trigger.text()).toContain('Planner')
    expect(trigger.find('.app-drawer__module').text()).toBe('Planning')

    await trigger.trigger('click')
    await flushPromises()
    const options = [...document.body.querySelectorAll<HTMLButtonElement>('[data-testid^="app-drawer-module-"]')]
    expect(options.map((o) => [o.textContent?.trim(), o.getAttribute('aria-checked')])).toEqual([
      ['Planning', 'true'],
      ['Stock', 'false'],
    ])
    options[1].click()
    await flushPromises()
    expect(state.store.setActiveSchema).toHaveBeenCalledWith('stock_dag')
  })

  test('switching DAG with executions open asks first', async () => {
    state.store.isDrawerPinned = true
    state.store.isMultiSchemaDeployment = true
    state.store.canSwitchSchema = true
    state.store.availableSchemas = ['planning_dag', 'stock_dag']
    state.store.loadedExecutions = [{ executionId: 'e1' }]
    ;({ wrapper } = await mountDrawer())
    await wrapper.find('[data-testid="app-drawer-module"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid="app-drawer-module-stock_dag"]')!.click()
    await flushPromises()
    expect(state.store.setActiveSchema).not.toHaveBeenCalled()

    document.body.querySelector<HTMLButtonElement>('[data-testid="app-drawer-module-confirm"]')!.click()
    await flushPromises()
    expect(state.store.setActiveSchema).toHaveBeenCalledWith('stock_dag')
  })

  test('folded, with several DAGs the icon carries the initial of the active one', async () => {
    state.store.isMultiSchemaDeployment = true
    state.store.getSchemaName = 'stock_dag'
    appConfig.getCore.mockReturnValue({ parameters: { schemaLabels: { stock_dag: 'Stock' } } })
    ;({ wrapper } = await mountDrawer())
    expect(wrapper.find('.app-drawer__rail-module').text()).toBe('S')
  })

  test('clicking a group of the rail pins the menu open on it', async () => {
    ;({ wrapper } = await mountDrawer())
    await wrapper.findAll('.app-drawer__rail-block.is-general button.app-drawer__rail-button')[1].trigger('click')
    expect(state.store.isDrawerPinned).toBe(true)
    const open = wrapper.findAll('.drawer-group__head[aria-expanded="true"]')
    expect(open.map((h: any) => h.text())).toEqual(['Master data'])
  })

  test('pinned, the groups are an accordion opened on the current page', async () => {
    state.store.isDrawerPinned = true
    ;({ wrapper } = await mountDrawer('/configuration/lines'))
    const heads = () => wrapper.findAll('button.drawer-group__head')
    expect(heads().map((h: any) => h.attributes('aria-expanded'))).toEqual(['false', 'true'])
    // A group of tables is one page: on one of its tables, the group is the current page.
    const pages = wrapper.findAll('.drawer-group__page')
    expect(pages.map((p: any) => p.text())).toEqual(['Plants', 'Group'])
    expect(wrapper.find('.drawer-group__page.is-active').text()).toBe('Group')

    await heads()[0].trigger('click')
    expect(heads().map((h: any) => h.attributes('aria-expanded'))).toEqual(['true', 'false'])
    // The closed group still says it holds the current page.
    expect(heads()[1].find('.drawer-group__dot').exists()).toBe(true)
    expect(heads()[1].find('.drawer-group__count').text()).toBe('2')
  })

  test('a group that is a page of its own is a link', async () => {
    state.store.isDrawerPinned = true
    ;({ wrapper } = await mountDrawer('/agent'))
    const agent = wrapper.find('a.drawer-group__head')
    expect(agent.attributes('href')).toBe('/agent')
    expect(agent.classes()).toContain('is-active')
  })

  test('resting the pointer opens the whole menu over the content, and leaving folds it', async () => {
    ;({ wrapper } = await mountDrawer())
    await pointer(wrapper, 'pointerenter')
    const drawer = wrapper.find('[data-testid="app-drawer"]')
    expect(drawer.classes()).toEqual(expect.arrayContaining(['is-expanded', 'is-floating']))
    expect(wrapper.find('[data-testid="app-drawer-execution"]').exists()).toBe(true)
    expect(state.store.isDrawerPinned).toBe(false)

    await pointer(wrapper, 'pointerleave')
    expect(drawer.classes()).not.toContain('is-expanded')
    expect(wrapper.find('[data-testid="app-drawer-rail-execution"]').exists()).toBe(true)
  })

  test('a touch does not open it', async () => {
    ;({ wrapper } = await mountDrawer())
    await pointer(wrapper, 'pointerenter', 'touch')
    expect(wrapper.find('[data-testid="app-drawer"]').classes()).not.toContain('is-expanded')
  })

  test('opened by the pointer, the pin keeps it open', async () => {
    ;({ wrapper } = await mountDrawer())
    await pointer(wrapper, 'pointerenter')
    const pin = wrapper.find('[data-testid="app-drawer-pin"]')
    expect(pin.attributes('aria-label')).toBe('drawer.pin')
    await pin.trigger('click')
    expect(state.store.isDrawerPinned).toBe(true)

    await pointer(wrapper, 'pointerleave')
    expect(wrapper.find('[data-testid="app-drawer"]').classes()).toContain('is-expanded')
    expect(wrapper.find('[data-testid="app-drawer"]').classes()).not.toContain('is-floating')
  })

  test('opened by the pointer, it stays open while its execution selector is', async () => {
    ;({ wrapper } = await mountDrawer())
    await pointer(wrapper, 'pointerenter')
    await wrapper.find('[data-testid="app-drawer-execution"]').trigger('click')
    await flushPromises()
    await pointer(wrapper, 'pointerleave')
    expect(wrapper.find('[data-testid="app-drawer"]').classes()).toContain('is-expanded')

    document.body.querySelectorAll<HTMLButtonElement>('.drawer-executions__item')[1].click()
    await flushPromises()
    await pause(0)
    expect(wrapper.find('[data-testid="app-drawer"]').classes()).not.toContain('is-expanded')
  })

  test('the pin button unpins it', async () => {
    state.store.isDrawerPinned = true
    ;({ wrapper } = await mountDrawer())
    const pin = wrapper.find('[data-testid="app-drawer-pin"]')
    expect(pin.attributes('aria-label')).toBe('drawer.unpin')
    await pin.trigger('click')
    expect(state.store.isDrawerPinned).toBe(false)
    expect(wrapper.find('[data-testid="app-drawer"]').classes()).not.toContain('is-expanded')
  })

  test('the execution selector refreshes the latest and opens the one picked', async () => {
    state.store.isDrawerPinned = true
    ;({ wrapper } = await mountDrawer())
    expect(state.executions.refresh).toHaveBeenCalled()
    state.executions.refresh.mockClear()

    await wrapper.find('[data-testid="app-drawer-execution"]').trigger('click')
    await flushPromises()
    expect(state.executions.refresh).toHaveBeenCalled()
    const items = document.body.querySelectorAll<HTMLButtonElement>('.drawer-executions__item')
    expect([...items].map((i) => i.textContent?.trim())).toEqual([
      expect.stringContaining('Plan 44'),
      expect.stringContaining('Plan 43'),
    ])
    items[1].click()
    await flushPromises()
    expect(state.executions.open).toHaveBeenCalledWith(expect.objectContaining({ id: 'e2' }))
  })

  test('log out asks first, then logs out and goes to sign in', async () => {
    state.store.isDrawerPinned = true
    let router: any
    ;({ wrapper, router } = await mountDrawer())
    await wrapper.find('[data-testid="app-drawer-logout"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid="app-drawer-logout-confirm"]')!.click()
    await flushPromises()
    expect(auth.logout).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/sign-in')
    expect(snackbar).toHaveBeenCalledWith('logOut.snackbar_message_success', 'success')
  })

  test('a failed log out says so', async () => {
    auth.logout.mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.store.isDrawerPinned = true
    ;({ wrapper } = await mountDrawer())
    await wrapper.find('[data-testid="app-drawer-logout"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid="app-drawer-logout-confirm"]')!.click()
    await flushPromises()
    expect(snackbar).toHaveBeenCalledWith('logOut.snackbar_message_error', 'error')
  })

  test('the user opens the user settings', async () => {
    state.store.isDrawerPinned = true
    let router: any
    ;({ wrapper, router } = await mountDrawer())
    expect(wrapper.find('.app-drawer__user-name').text()).toBe('planner')
    await wrapper.find('.app-drawer__user-link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/user-settings')
  })

  test('on a narrow screen the pinned menu lies over the content and the scrim closes it', async () => {
    const matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    vi.stubGlobal('matchMedia', matchMedia)
    state.store.isDrawerPinned = true
    ;({ wrapper } = await mountDrawer())
    expect(wrapper.find('[data-testid="app-drawer"]').classes()).toContain('is-overlay')
    expect(wrapper.find('[data-testid="app-drawer-pin"]').attributes('aria-label')).toBe('drawer.close')
    await wrapper.find('[data-testid="app-drawer-scrim"]').trigger('click')
    expect(state.store.isDrawerPinned).toBe(false)
    vi.unstubAllGlobals()
  })
})
