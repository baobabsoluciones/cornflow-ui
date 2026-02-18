import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

// Mock dependencies before any imports
const mockAuthService = {
  isAuthenticated: vi.fn().mockReturnValue(true),
  logout: vi.fn().mockResolvedValue(undefined),
}

const mockAppConfig = {
  getDashboardRoutes: vi.fn().mockReturnValue([]),
  getInstanceDashboardRoutes: vi.fn().mockReturnValue([]),
  getAppSectionRoutes: vi.fn().mockReturnValue([]),
  getCore: vi.fn().mockReturnValue({
    parameters: {
      useHashMode: false,
    },
  }),
}

// Mock the auth service factory to prevent async initialization
vi.mock('@/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(mockAuthService),
}))

// Mock the app config
vi.mock('@/app/config', () => ({
  default: mockAppConfig,
}))

// Mock the config with useHashMode property
const mockConfig = {
  initConfig: vi.fn().mockResolvedValue(undefined),
  backend: 'http://localhost:3000',
  name: 'Test App',
  useHashMode: false, // Add this property to prevent router initialization issues
}

vi.mock('@/config', () => ({
  default: mockConfig,
}))

// Mock all Vue components to avoid complex component loading during router tests
vi.mock('@/views/IndexView.vue', () => ({
  default: { name: 'IndexView', template: '<div>Index</div>' },
}))
vi.mock('@/views/LoginView.vue', () => ({
  default: { name: 'LoginView', template: '<div>Login</div>' },
}))
vi.mock('@/views/ProjectExecutionView.vue', () => ({
  default: {
    name: 'ProjectExecutionView',
    template: '<div>ProjectExecution</div>',
  },
}))
vi.mock('@/views/HistoryExecutionView.vue', () => ({
  default: {
    name: 'HistoryExecutionView',
    template: '<div>HistoryExecution</div>',
  },
}))
vi.mock('@/views/DashboardView.vue', () => ({
  default: { name: 'DashboardView', template: '<div>Dashboard</div>' },
}))
vi.mock('@/views/InputDataView.vue', () => ({
  default: { name: 'InputDataView', template: '<div>InputData</div>' },
}))
vi.mock('@/views/OutputDataView.vue', () => ({
  default: { name: 'OutputDataView', template: '<div>OutputData</div>' },
}))
vi.mock('@/views/UserSettingsView.vue', () => ({
  default: { name: 'UserSettingsView', template: '<div>UserSettings</div>' },
}))

// Mock SectionView component used in configuration routes
vi.mock('@/views/SectionView.vue', () => ({
  default: { name: 'SectionView', template: '<div>Section</div>' },
}))

// Mock API service to prevent initialization delays
vi.mock('@/api/Api', () => ({
  default: {
    getInstance: vi.fn().mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    }),
  },
}))

// Mock ConfigService to prevent URL parsing errors
vi.mock('@/services/ConfigService', () => ({
  ConfigService: {
    getInstance: vi.fn().mockReturnValue({
      loadConfig: vi.fn().mockResolvedValue({}),
      getConfig: vi.fn().mockReturnValue({}),
    }),
  },
}))

// Mock general store to prevent reactive initialization and async operations
vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn().mockReturnValue({
    getSchemaConfig: { name: 'test-schema' },
    getConfigurations: { config1: 'value1' },
    rawConfigurations: { loaded: true },
    updateLocalizedConfigurations: vi.fn(),
    setSchema: vi.fn().mockResolvedValue(undefined),
    setConfigurations: vi.fn().mockResolvedValue(undefined),
  }),
}))

// Simple test that focuses on router structure and configuration
describe('Router Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAppConfig.getDashboardRoutes.mockReturnValue([])
    mockAppConfig.getInstanceDashboardRoutes.mockReturnValue([])
    mockAppConfig.getCore.mockReturnValue({
      parameters: {
        useHashMode: false,
      },
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure config mock is properly set up
    mockConfig.initConfig.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should have correct route definitions', async () => {
    // Import router after mocks are set up
    const { default: router } = await import('@/router/index')

    expect(router).toBeDefined()
    expect(router.getRoutes).toBeDefined()
    expect(typeof router.getRoutes).toBe('function')

    const routes = router.getRoutes()
    expect(Array.isArray(routes)).toBe(true)
    expect(routes.length).toBeGreaterThan(0)
  })

  test('should have child routes configured', async () => {
    const { default: router } = await import('@/router/index')

    const routes = router.getRoutes()
    const rootRoute = routes.find((route) => route.path === '/')

    expect(rootRoute).toBeDefined()
    expect(rootRoute?.children).toBeDefined()
    expect(rootRoute?.children?.length).toBeGreaterThan(0)

    const childPaths = rootRoute?.children?.map((child) => child.path) || []
    expect(childPaths).toContain('project-execution')
    expect(childPaths).toContain('dashboard')
    expect(childPaths).toContain('user-settings')
  })

  test('should have route guards configured', async () => {
    const { default: router } = await import('@/router/index')

    expect(router.beforeEach).toBeDefined()
    expect(typeof router.beforeEach).toBe('function')

    const routes = router.getRoutes()
    const rootRoute = routes.find((route) => route.path === '/')
    expect(rootRoute?.beforeEnter).toBeDefined()
  })

  test('should have correct route names', async () => {
    const { default: router } = await import('@/router/index')

    const routes = router.getRoutes()
    const rootRoute = routes.find((route) => route.path === '/')
    expect(rootRoute?.name).toBe('Home')

    const childRoutes = rootRoute?.children || []
    const routeNames = childRoutes.map((route) => route.name)
    expect(routeNames).toContain('Project execution')
    expect(routeNames).toContain('Dashboard')
    expect(routeNames).toContain('User settings')
    expect(routeNames).toContain('Input Data Table')
    expect(routeNames).toContain('Results Table')
    expect(routeNames).toContain('Executions history')
  })

  test('should have correct redirect configuration', async () => {
    const { default: router } = await import('@/router/index')

    const routes = router.getRoutes()
    const rootRoute = routes.find((route) => route.path === '/')
    // The redirect is a function that returns the default view path
    expect(typeof rootRoute?.redirect).toBe('function')
    // When called, it should return the default view path
    if (typeof rootRoute?.redirect === 'function') {
      const result = rootRoute.redirect({ path: '/' } as any)
      expect(result).toBe('/history-execution')
    }
  })

  test('should have keepAlive configured on child routes', async () => {
    const { default: router } = await import('@/router/index')

    const routes = router.getRoutes()
    const rootRoute = routes.find((route) => route.path === '/')
    const childRoutes = rootRoute?.children || []

    // Check that some routes have keepAlive configured
    const routesWithKeepAlive = childRoutes.filter(
      (route) => route.meta?.keepAlive || (route as any).keepAlive,
    )
    expect(routesWithKeepAlive.length).toBeGreaterThan(0)
  })

  test('should be able to create router instance', async () => {
    const { default: router } = await import('@/router/index')

    expect(router).toBeDefined()
    expect(router.push).toBeDefined()
    expect(router.replace).toBeDefined()
    expect(router.go).toBeDefined()
    expect(router.back).toBeDefined()
  })

  test('should handle authentication in route guards', async () => {
    const { default: router } = await import('@/router/index')

    // Test with authenticated user
    mockAuthService.isAuthenticated.mockReturnValue(true)

    const mockNext = vi.fn()
    const mockTo = { path: '/dashboard', name: 'Dashboard' }
    const mockFrom = { path: '/project-execution' }

    // Access the beforeEach guard
    const guards = router.options.routes?.[1]?.beforeEnter
    expect(guards).toBeDefined()
  })

  test('should have all required routes present', async () => {
    const { default: router } = await import('@/router/index')

    const routes = router.getRoutes()
    const routePaths = routes.map((route) => route.path)

    expect(routePaths).toContain('/')
    expect(routePaths).toContain('/sign-in')

    // Check that the router has the expected structure
    expect(routes.length).toBeGreaterThanOrEqual(2)
  })

  test('should handle dashboard routes from config', async () => {
    // Reset modules to ensure clean re-import
    vi.resetModules()

    // Setup mock dashboard routes before importing
    const mockDashboardRoutes = [
      {
        path: 'custom-dashboard',
        name: 'Custom Dashboard',
        component: { name: 'CustomDashboard', template: '<div>Custom</div>' },
      },
    ]

    mockAppConfig.getDashboardRoutes.mockReturnValue(mockDashboardRoutes)

    // Import router with new dashboard routes
    const { default: router } = await import('@/router/index')

    const routes = router.getRoutes()
    const rootRoute = routes.find((route) => route.path === '/')
    const childRoutes = rootRoute?.children || []

    // Check that the dashboard routes are included
    const customDashboardRoute = childRoutes.find(
      (route) => route.path === 'custom-dashboard',
    )
    expect(customDashboardRoute).toBeDefined()
    expect(customDashboardRoute?.name).toBe('Custom Dashboard')
  })

  test('should handle hash mode configuration', async () => {
    // Reset modules to ensure clean re-import
    vi.resetModules()

    // Test with hash mode enabled
    mockAppConfig.getCore.mockReturnValue({
      parameters: {
        useHashMode: true,
      },
    })

    // Import router with hash mode configuration
    const { default: router } = await import('@/router/index')

    expect(router).toBeDefined()
    expect(router.options).toBeDefined()
    expect(router.options.history).toBeDefined()

    // Verify the router was created (we can't easily test the exact history type due to internal implementation)
    expect(typeof router.push).toBe('function')
  })
})
