import { describe, test, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const { store, appConfig, forbiddenViews } = vi.hoisted(() => ({
  store: {} as Record<string, any>,
  forbiddenViews: [] as string[],
  appConfig: {
    getCore: vi.fn(),
    getAppSections: vi.fn(),
    getFrontendAutomationSectionSubsections: vi.fn(),
  },
}))

vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => store }))
vi.mock('@/app/config', () => ({ default: appConfig }))
vi.mock('@/app/rolesConfig', () => ({
  isViewAllowed: (_roles: string[], view: string) => !forbiddenViews.includes(view),
}))

import {
  isPageActive,
  useDrawerSections,
} from '@cornflow-ui/core/composables/navigation/useDrawerSections'

const user = { username: 'planner', email: 'p@example.com', roles: [] as { name: string }[] }

function resetStore() {
  Object.assign(store, {
    getUser: { ...user },
    getSchemaName: 'planning_dag',
    selectedExecution: null,
    getConfigurations: {},
    masterDataSections: [],
    masterDataGroups: undefined,
    appDashboardPages: [],
    appInstanceDashboardPages: [],
  })
}

function setup() {
  let api: ReturnType<typeof useDrawerSections>
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false })
  mount(
    defineComponent({
      setup() {
        api = useDrawerSections()
        return () => h('div')
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return api!
}

const keys = (api: ReturnType<typeof useDrawerSections>) => api.sections.value.map((s) => s.key)
const section = (api: ReturnType<typeof useDrawerSections>, key: string) =>
  api.sections.value.find((s) => s.key === key)!

describe('useDrawerSections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
    forbiddenViews.length = 0
    appConfig.getCore.mockReturnValue({ parameters: { showDashboardMainView: false } })
    appConfig.getAppSections.mockReturnValue([])
    appConfig.getFrontendAutomationSectionSubsections.mockReturnValue([])
  })

  test('without an execution selected: the history, then master data', () => {
    store.getConfigurations = { masterData: { tableA: { title: 'Table A', icon: 'mdi-table', group: null } } }
    const api = setup()
    expect(keys(api)).toEqual(['history', 'master-data'])
    expect(section(api, 'history')).toMatchObject({
      title: 'drawer.history',
      icon: 'mdi-history',
      to: '/history-execution',
      scope: 'general',
    })
    expect(api.canCreateExecution.value).toBe(true)
  })

  test('a role that may not create executions sees the history but not the way to create one', () => {
    forbiddenViews.push('project-execution')
    const api = setup()
    expect(api.canCreateExecution.value).toBe(false)
    expect(keys(api)).toEqual(['history'])
  })

  test('with an execution selected, its input data and results follow, with the dashboards', () => {
    store.selectedExecution = { experiment: { instance: { data: {} }, solution: { data: {} } }, state: 1 }
    store.getConfigurations = { masterData: {}, inputData: {}, resultsData: {} }
    store.appDashboardPages = [{ title: 'Board', icon: 'mdi-a', to: '/board' }]
    appConfig.getCore.mockReturnValue({ parameters: { showDashboardMainView: true } })
    const api = setup()
    expect(keys(api)).toEqual(['history', 'input-data', 'results'])
    expect(api.sections.value.map((s) => s.scope)).toEqual(['general', 'execution', 'execution'])
    expect(section(api, 'results').subPages!.map((p) => p.to)).toEqual(['/output-data', '/dashboard', '/board'])
  })

  test('results list undeclared solution tables only with showTablesWithoutSchema', () => {
    const solution = { schema: { properties: {} }, data: { extra: [{ a: 1 }] } }
    store.selectedExecution = { experiment: { instance: { data: {} }, solution }, state: 1 }
    store.getConfigurations = { masterData: {}, inputData: {}, resultsData: {} }
    const tables = (api: ReturnType<typeof useDrawerSections>) =>
      section(api, 'results').subPages!.flatMap((page: any) => (page.subPages ?? []).map((sub: any) => sub.key))

    expect(tables(setup())).toEqual([])
    appConfig.getCore.mockReturnValue({ parameters: { showTablesWithoutSchema: true } })
    expect(tables(setup())).toEqual(['extra'])
  })

  test('administration shows to admins when roles management is on', () => {
    store.getUser = { ...user, roles: [{ name: 'admin' }] }
    expect(keys(setup())).not.toContain('admin')
    appConfig.getCore.mockReturnValue({ parameters: { enableRolesManagement: true } })
    const api = setup()
    expect(api.isAdmin.value).toBe(true)
    expect(section(api, 'admin').subPages![0].to).toBe('/roles-management')
  })

  test('app sections declared for some roles or DAGs show only to them', () => {
    store.getUser = { ...user, roles: [{ name: 'planner' }] }
    appConfig.getAppSections.mockReturnValue([
      { titleKey: 'everyone', icon: 'mdi-a', to: '/everyone' },
      { titleKey: 'admins', icon: 'mdi-b', to: '/admins', roles: ['admin'] },
      { titleKey: 'planning', icon: 'mdi-c', to: '/planning', schemas: ['planning_dag'] },
      { titleKey: 'stock', icon: 'mdi-d', to: '/stock', schemas: ['stock_dag'] },
      { titleKey: 'needs-execution', icon: 'mdi-e', to: '/needs', requiresSelectedExecution: true },
    ])
    expect(setup().sections.value.filter((s) => s.key.startsWith('app-')).map((s) => s.to)).toEqual([
      '/everyone',
      '/planning',
    ])

    // One that needs an execution shows with it, as part of the loaded execution.
    store.selectedExecution = { experiment: { instance: { data: {} }, solution: { data: {} } }, state: 1 }
    const needs = setup().sections.value.find((s) => s.to === '/needs')
    expect(needs?.scope).toBe('execution')
  })

  test('dashboard pages declared for other DAGs are left out of the results', () => {
    store.selectedExecution = { experiment: { instance: { data: {} }, solution: { data: {} } }, state: 1 }
    store.getConfigurations = { masterData: {}, inputData: {}, resultsData: {} }
    store.appDashboardPages = [
      { title: 'Planning board', icon: 'mdi-a', to: '/planning-board', schemas: ['planning_dag'] },
      { title: 'Stock levels', icon: 'mdi-b', to: '/stock-levels', schemas: ['stock_dag'] },
    ]
    const destinations = section(setup(), 'results').subPages!.map((p) => p.to)
    expect(destinations).toContain('/planning-board')
    expect(destinations).not.toContain('/stock-levels')
  })

  test('master data sections get their sub-sections for the DAG and roles that may see them', () => {
    store.getUser = { ...user, roles: [{ name: 'planner' }] }
    store.masterDataSections = [{ id: 'pricing', title: 'Pricing', order: 1 }]
    store.getConfigurations = { masterData: { prices: { title: 'Prices', group: null, section: 'pricing' } } }
    const view = { name: 'View', titleKey: 'view', icon: 'mdi-view', component: vi.fn() }
    appConfig.getFrontendAutomationSectionSubsections.mockReturnValue([
      { ...view, path: 'board' },
      { ...view, path: 'planning-board', schemas: ['planning_dag'] },
      { ...view, path: 'stock-board', schemas: ['stock_dag'] },
      { ...view, path: 'admin-board', roles: ['admin'] },
    ])
    const pricing = setup().sections.value.find((s) => s.key === 'master-data-pricing')!
    const destinations = pricing.subPages!.map((p) => p.to)
    expect(destinations).toContain('/configuration/section/pricing/board')
    expect(destinations).toContain('/configuration/section/pricing/planning-board')
    expect(destinations).not.toContain('/configuration/section/pricing/stock-board')
    expect(destinations).not.toContain('/configuration/section/pricing/admin-board')
  })
})

describe('isPageActive', () => {
  test('matches the page, a route nested in it, or any page below it', () => {
    expect(isPageActive({ title: 'a', to: '/results' }, '/results')).toBe(true)
    expect(isPageActive({ title: 'a', to: '/results' }, '/results/plan')).toBe(true)
    expect(isPageActive({ title: 'a', to: '/results' }, '/results-old')).toBe(false)
    expect(
      isPageActive({ title: 'group', subPages: [{ title: 'b', to: '/configuration/b' }] }, '/configuration/b'),
    ).toBe(true)
    expect(isPageActive(null, '/x')).toBe(false)
  })
})
