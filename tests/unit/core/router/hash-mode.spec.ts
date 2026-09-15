import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Regression tests for the history-mode / config race.
 *
 * The router must NOT be created while the module graph is being evaluated: `config.useHashMode`
 * is only populated by the async `config.initConfig()`, so a router built at import time always
 * fell back to the hardcoded default and silently ignored `useHashMode: true`.
 */

const mockAuthService = {
  isAuthenticated: vi.fn().mockReturnValue(true),
  logout: vi.fn().mockResolvedValue(undefined),
}

const mockAppConfig = {
  getDashboardRoutes: vi.fn().mockReturnValue([]),
  getInstanceDashboardRoutes: vi.fn().mockReturnValue([]),
  getAppSectionRoutes: vi.fn().mockReturnValue([]),
  getCore: vi.fn().mockReturnValue({ parameters: {} }),
}

// `useHashMode` starts false, exactly like the real module before initConfig() resolves.
const mockConfig = {
  initConfig: vi.fn().mockResolvedValue(undefined),
  backend: 'http://localhost:3000',
  name: 'Test App',
  useHashMode: false,
}

const { createRouterSpy } = vi.hoisted(() => ({ createRouterSpy: vi.fn() }))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    createRouter: (...args: Parameters<typeof actual.createRouter>) => {
      createRouterSpy(...args)
      return actual.createRouter(...args)
    },
  }
})

vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(mockAuthService),
}))
vi.mock('@/app/config', () => ({ default: mockAppConfig }))
vi.mock('@cornflow-ui/core/config', () => ({ default: mockConfig }))
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: vi.fn().mockReturnValue({
    getSchemaConfig: { name: 'test-schema' },
    getConfigurations: {},
    setSchema: vi.fn().mockResolvedValue(undefined),
    setConfigurations: vi.fn().mockResolvedValue(undefined),
  }),
}))

// Views are irrelevant here; stub them so importing the router stays cheap.
const stubView = (name: string) => ({ default: { name, template: '<div />' } })
vi.mock('@cornflow-ui/core/views/IndexView.vue', () => stubView('IndexView'))
vi.mock('@cornflow-ui/core/views/LoginView.vue', () => stubView('LoginView'))
vi.mock('@cornflow-ui/core/views/ProjectExecutionView.vue', () =>
  stubView('ProjectExecutionView'),
)
vi.mock('@cornflow-ui/core/views/HistoryExecutionView.vue', () =>
  stubView('HistoryExecutionView'),
)
vi.mock('@cornflow-ui/core/views/DashboardView.vue', () => stubView('DashboardView'))
vi.mock('@cornflow-ui/core/views/UserSettingsView.vue', () => stubView('UserSettingsView'))
vi.mock('@cornflow-ui/core/views/SectionView.vue', () => stubView('SectionView'))
vi.mock('@cornflow-ui/core/views/ConfigurationSectionSubsectionView.vue', () =>
  stubView('ConfigurationSectionSubsectionView'),
)
vi.mock('@cornflow-ui/core/views/RolesManagementView.vue', () =>
  stubView('RolesManagementView'),
)
vi.mock('@cornflow-ui/core/views/NotFoundView.vue', () => stubView('NotFoundView'))

describe('router history mode', () => {
  beforeEach(() => {
    vi.resetModules()
    createRouterSpy.mockClear()
    mockConfig.useHashMode = false
  })

  afterEach(() => {
    mockConfig.useHashMode = false
  })

  test('importing the module does not create the router', async () => {
    await import('@cornflow-ui/core/router/index')

    expect(createRouterSpy).not.toHaveBeenCalled()
  })

  test('uses hash history when useHashMode is set before the router is built', async () => {
    const { createAppRouter } = await import('@cornflow-ui/core/router/index')

    // Simulates config.initConfig() resolving after the module graph was evaluated.
    mockConfig.useHashMode = true

    const router = createAppRouter()

    expect(router.resolve('/user-settings').href).toContain('#/user-settings')
  })

  test('uses web history when useHashMode is false', async () => {
    const { createAppRouter } = await import('@cornflow-ui/core/router/index')

    const router = createAppRouter()

    expect(router.resolve('/user-settings').href).not.toContain('#')
  })

  test('getRouter caches a single instance and builds it on first use', async () => {
    const { getRouter } = await import('@cornflow-ui/core/router/index')

    mockConfig.useHashMode = true
    const first = getRouter()
    const second = getRouter()

    expect(createRouterSpy).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
    expect(first.resolve('/user-settings').href).toContain('#/user-settings')
  })

  test('the default export proxies to the lazily built router', async () => {
    const routerModule = await import('@cornflow-ui/core/router/index')

    mockConfig.useHashMode = true
    // Property access is what triggers construction.
    const routes = routerModule.default.getRoutes()

    expect(createRouterSpy).toHaveBeenCalledTimes(1)
    expect(routes.length).toBeGreaterThan(0)
    expect(routerModule.default.resolve('/user-settings').href).toContain('#/user-settings')
  })
})
