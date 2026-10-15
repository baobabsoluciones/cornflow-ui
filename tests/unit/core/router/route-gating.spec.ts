import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockAuthService = vi.hoisted(() => ({
  isAuthenticated: vi.fn(() => true),
}))
vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(mockAuthService),
}))

const page = vi.hoisted(() => ({ template: '<div />' }))
const mockAppConfig = vi.hoisted(() => ({
  getDashboardRoutes: () => [
    {
      path: 'stock-board',
      name: 'Stock board',
      component: page,
      meta: { schemas: ['stock_dag'] },
    },
  ],
  getInstanceDashboardRoutes: () => [],
  getAppSectionRoutes: () => [
    {
      path: 'admin-board',
      name: 'Admin board',
      component: page,
      meta: { roles: ['admin'] },
    },
    { path: 'open-board', name: 'Open board', component: page, meta: {} },
  ],
  getCore: () => ({ parameters: { defaultView: 'history-execution' } }),
}))
vi.mock('@/app/config', () => ({ default: mockAppConfig }))

vi.mock('@cornflow-ui/core/config', () => ({
  default: {
    useHashMode: false,
    initConfig: vi.fn().mockResolvedValue(undefined),
  },
}))

const mockStore = vi.hoisted(() => ({
  getUser: { roles: [] as { name: string }[] },
  getSchemaName: 'planning_dag',
  initialDataLoading: false,
  getConfigurations: {},
}))
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => mockStore,
}))

for (const view of [
  'IndexView',
  'LoginView',
  'ProjectExecutionView',
  'HistoryExecutionView',
  'DashboardView',
  'UserSettingsView',
  'SectionView',
  'ConfigurationSectionSubsectionView',
  'RolesManagementView',
  'NotFoundView',
]) {
  vi.doMock(`@cornflow-ui/core/views/${view}.vue`, () => ({
    default: { name: view, template: '<div><router-view /></div>' },
  }))
}

async function navigate(path: string) {
  const { createAppRouter } = await import('@cornflow-ui/core/router/index')
  const router = createAppRouter()
  await router.push(path)
  return router.currentRoute.value
}

describe('routes gated by role or DAG', () => {
  beforeEach(() => {
    mockStore.getUser = { roles: [{ name: 'planner' }] }
    mockStore.getSchemaName = 'planning_dag'
  })

  test('a route without roles or schemas is open to everyone', async () => {
    const route = await navigate('/open-board')

    expect(route.path).toBe('/open-board')
  })

  test('a route declared for other roles leads to the forbidden page', async () => {
    const route = await navigate('/admin-board')

    expect(route.path).toBe('/not-found')
    expect(route.query.reason).toBe('forbidden')
  })

  test('a route declared for the user role is reachable', async () => {
    mockStore.getUser = { roles: [{ name: 'admin' }] }

    const route = await navigate('/admin-board')

    expect(route.path).toBe('/admin-board')
  })

  test('a route declared for another DAG is not reachable from this one', async () => {
    expect((await navigate('/stock-board')).path).toBe('/not-found')

    mockStore.getSchemaName = 'stock_dag'
    expect((await navigate('/stock-board')).path).toBe('/stock-board')
  })
})
