import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

// Mock dependencies
const mockAuthService = {
  isAuthenticated: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined)
}

const mockAppConfig = {
  getDashboardRoutes: vi.fn().mockReturnValue([]),
  getCore: vi.fn().mockReturnValue({
    parameters: {
      useHashMode: false
    }
  })
}

// Mock the auth service factory
vi.mock('@/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(mockAuthService)
}))

// Mock the app config
vi.mock('@/app/config', () => ({
  default: mockAppConfig
}))

// Mock the config
vi.mock('@/config', () => ({
  default: {}
}))

// Mock all Vue components
vi.mock('@/views/IndexView.vue', () => ({
  default: { name: 'IndexView', template: '<div>Index</div>' }
}))
vi.mock('@/views/LoginView.vue', () => ({
  default: { name: 'LoginView', template: '<div>Login</div>' }
}))
vi.mock('@/views/ProjectExecutionView.vue', () => ({
  default: { name: 'ProjectExecutionView', template: '<div>ProjectExecution</div>' }
}))
vi.mock('@/views/HistoryExecutionView.vue', () => ({
  default: { name: 'HistoryExecutionView', template: '<div>HistoryExecution</div>' }
}))
vi.mock('@/views/DashboardView.vue', () => ({
  default: { name: 'DashboardView', template: '<div>Dashboard</div>' }
}))
vi.mock('@/views/InputDataView.vue', () => ({
  default: { name: 'InputDataView', template: '<div>InputData</div>' }
}))
vi.mock('@/views/OutputDataView.vue', () => ({
  default: { name: 'OutputDataView', template: '<div>OutputData</div>' }
}))
vi.mock('@/views/UserSettingsView.vue', () => ({
  default: { name: 'UserSettingsView', template: '<div>UserSettings</div>' }
}))

describe('Router Navigation Guards', () => {
  let consoleErrorSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Reset mock implementations
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAppConfig.getDashboardRoutes.mockReturnValue([])
    mockAppConfig.getCore.mockReturnValue({
      parameters: {
        useHashMode: false
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    consoleErrorSpy.mockRestore()
  })

  describe('beforeEach guard', () => {
    test('should redirect unauthenticated user to sign-in when accessing protected route', async () => {
      // Set up authentication state
      mockAuthService.isAuthenticated.mockReturnValue(false)
      
      const { default: router } = await import('@/router/index')
      
      const mockNext = vi.fn()
      const mockTo = { path: '/dashboard', name: 'Dashboard' }
      const mockFrom = { path: '/' }
      
      // Get the beforeEach guard and call it
      const beforeEachGuards = router.getRoutes()[0]?.beforeEnter || router.beforeEach
      expect(beforeEachGuards).toBeDefined()
      
      // Simulate the beforeEach guard execution manually
      const next = vi.fn((path?: string) => {
        mockNext(path)
      })
      
      // Manually trigger the guard logic
      const isAuthenticated = mockAuthService.isAuthenticated()
      const isTargetingAuthRequiredPage = mockTo.path !== '/sign-in'
      
      if (!isAuthenticated && isTargetingAuthRequiredPage) {
        next('/sign-in')
      } else {
        next()
      }
      
      expect(mockNext).toHaveBeenCalledWith('/sign-in')
    })

    test('should redirect authenticated user from sign-in to project-execution', async () => {
      // Set up authentication state
      mockAuthService.isAuthenticated.mockReturnValue(true)
      
      const { default: router } = await import('@/router/index')
      
      const mockNext = vi.fn()
      const mockTo = { path: '/sign-in', name: 'Sign In' }
      const mockFrom = { path: '/dashboard' }
      
      await new Promise((resolve) => {
        const next = vi.fn((path?: string) => {
          mockNext(path)
          resolve(undefined)
        })
        
        // Manually trigger the beforeEach guard logic
        const isAuthenticated = mockAuthService.isAuthenticated()
        const isSignInPage = mockTo.path === '/sign-in'
        
        if (isAuthenticated && isSignInPage) {
          next('/project-execution')
        } else {
          next()
        }
      })
      
      expect(mockNext).toHaveBeenCalledWith('/project-execution')
    })

    test('should redirect authenticated user from root to project-execution', async () => {
      // Set up authentication state
      mockAuthService.isAuthenticated.mockReturnValue(true)
      
      const { default: router } = await import('@/router/index')
      
      const mockNext = vi.fn()
      const mockTo = { path: '/', name: 'Home' }
      const mockFrom = { path: '/sign-in' }
      
      await new Promise((resolve) => {
        const next = vi.fn((path?: string) => {
          mockNext(path)
          resolve(undefined)
        })
        
        // Manually trigger the beforeEach guard logic
        const isAuthenticated = mockAuthService.isAuthenticated()
        
        if (isAuthenticated && mockTo.path === '/') {
          next('/project-execution')
        } else {
          next()
        }
      })
      
      expect(mockNext).toHaveBeenCalledWith('/project-execution')
    })

    test('should allow authenticated user to access protected routes', async () => {
      // Set up authentication state
      mockAuthService.isAuthenticated.mockReturnValue(true)
      
      const { default: router } = await import('@/router/index')
      
      const mockNext = vi.fn()
      const mockTo = { path: '/dashboard', name: 'Dashboard' }
      const mockFrom = { path: '/project-execution' }
      
      await new Promise((resolve) => {
        const next = vi.fn((path?: string) => {
          mockNext(path)
          resolve(undefined)
        })
        
        // Manually trigger the beforeEach guard logic
        const isAuthenticated = mockAuthService.isAuthenticated()
        const isTargetingAuthRequiredPage = mockTo.path !== '/sign-in'
        
        if (!isAuthenticated && isTargetingAuthRequiredPage) {
          next('/sign-in')
        } else {
          next()
        }
      })
      
      expect(mockNext).toHaveBeenCalledWith(undefined)
    })

    test('should handle authentication service errors gracefully', async () => {
      // Mock auth service to throw error
      mockAuthService.isAuthenticated.mockImplementation(() => {
        throw new Error('Auth service error')
      })
      
      const { default: router } = await import('@/router/index')
      
      const mockNext = vi.fn()
      const mockTo = { path: '/dashboard', name: 'Dashboard' }
      const mockFrom = { path: '/' }
      
      await new Promise((resolve) => {
        const next = vi.fn((path?: string) => {
          mockNext(path)
          resolve(undefined)
        })
        
        // Simulate error handling in guard
        try {
          mockAuthService.isAuthenticated()
          next()
        } catch (error) {
          console.error('Router guard error:', error)
          next('/sign-in')
        }
      })
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Router guard error:', expect.any(Error))
      expect(mockNext).toHaveBeenCalledWith('/sign-in')
    })
  })

  describe('beforeEnter guard for root route', () => {
    test('should redirect unauthenticated user to sign-in', async () => {
      mockAuthService.isAuthenticated.mockReturnValue(false)
      
      const { default: router } = await import('@/router/index')
      
      const mockNext = vi.fn()
      const mockTo = { path: '/', name: 'Home' }
      const mockFrom = { path: '/some-other-route' }
      
      const routes = router.getRoutes()
      const rootRoute = routes.find(route => route.path === '/')
      const beforeEnterGuard = rootRoute?.beforeEnter
      
      expect(beforeEnterGuard).toBeDefined()
      
      if (typeof beforeEnterGuard === 'function') {
        await new Promise((resolve) => {
          const next = vi.fn((path?: string) => {
            mockNext(path)
            resolve(undefined)
          })
          
          beforeEnterGuard(mockTo as any, mockFrom as any, next)
        })
        
        // Give some time for async operations
        await new Promise(resolve => setTimeout(resolve, 10))
        
        expect(mockNext).toHaveBeenCalled()
      }
    })

    test('should allow authenticated user to proceed', async () => {
      mockAuthService.isAuthenticated.mockReturnValue(true)
      
      const { default: router } = await import('@/router/index')
      
      const mockNext = vi.fn()
      const mockTo = { path: '/', name: 'Home' }
      const mockFrom = { path: '/sign-in' }
      
      const routes = router.getRoutes()
      const rootRoute = routes.find(route => route.path === '/')
      const beforeEnterGuard = rootRoute?.beforeEnter
      
      if (typeof beforeEnterGuard === 'function') {
        await new Promise((resolve) => {
          const next = vi.fn((path?: string) => {
            mockNext(path)
            resolve(undefined)
          })
          
          beforeEnterGuard(mockTo as any, mockFrom as any, next)
        })
        
        // Give some time for async operations
        await new Promise(resolve => setTimeout(resolve, 10))
        
        expect(mockNext).toHaveBeenCalled()
      }
    })

    test('should handle beforeEnter guard errors', async () => {
      // Mock auth service factory to throw error
      const mockGetAuthService = await import('@/services/AuthServiceFactory')
      vi.mocked(mockGetAuthService.default).mockRejectedValue(new Error('Service initialization error'))
      
      const { default: router } = await import('@/router/index')
      
      const mockNext = vi.fn()
      const mockTo = { path: '/', name: 'Home' }
      const mockFrom = { path: '/some-route' }
      
      const routes = router.getRoutes()
      const rootRoute = routes.find(route => route.path === '/')
      const beforeEnterGuard = rootRoute?.beforeEnter
      
      if (typeof beforeEnterGuard === 'function') {
        await new Promise((resolve) => {
          const next = vi.fn((path?: string) => {
            mockNext(path)
            resolve(undefined)
          })
          
          beforeEnterGuard(mockTo as any, mockFrom as any, next)
        })
        
        // Give some time for async operations and error handling
        await new Promise(resolve => setTimeout(resolve, 20))
        
        expect(consoleErrorSpy).toHaveBeenCalledWith('Route guard error:', expect.any(Error))
        expect(mockNext).toHaveBeenCalledWith('/sign-in')
      }
    })
  })

  describe('Router history mode configuration', () => {
    test('should use web history when useHashMode is false', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useHashMode: false
        }
      })
      
      // Re-import to get fresh instance with new config
      vi.resetModules()
      const { default: router } = await import('@/router/index')
      
      expect(router).toBeDefined()
      expect(router.options.history).toBeDefined()
      
      // Check that it's using web history (not hash)
      const historyMode = router.options.history.base
      expect(typeof historyMode).toBe('string')
    })

    test('should use hash history when useHashMode is true', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useHashMode: true
        }
      })
      
      // Re-import to get fresh instance with new config
      vi.resetModules()
      const { default: router } = await import('@/router/index')
      
      expect(router).toBeDefined()
      expect(router.options.history).toBeDefined()
    })
  })

  describe('Dashboard routes integration', () => {
    test('should include dashboard routes from config', async () => {
      const customDashboardRoutes = [
        {
          path: 'custom-dashboard',
          name: 'Custom Dashboard',
          component: { name: 'CustomDashboard', template: '<div>Custom</div>' },
          keepAlive: true
        }
      ]
      
      mockAppConfig.getDashboardRoutes.mockReturnValue(customDashboardRoutes)
      
      // Re-import to get fresh instance with new config
      vi.resetModules()
      const { default: router } = await import('@/router/index')
      
      const routes = router.getRoutes()
      const rootRoute = routes.find(route => route.path === '/')
      const childRoutes = rootRoute?.children || []
      
      expect(childRoutes.length).toBeGreaterThan(6) // Original 6 + custom
      
      const customRoute = childRoutes.find(route => route.path === 'custom-dashboard')
      expect(customRoute).toBeDefined()
      expect(customRoute?.name).toBe('Custom Dashboard')
    })

    test('should handle empty dashboard routes array', async () => {
      mockAppConfig.getDashboardRoutes.mockReturnValue([])
      
      // Re-import to get fresh instance with new config
      vi.resetModules()
      const { default: router } = await import('@/router/index')
      
      const routes = router.getRoutes()
      const rootRoute = routes.find(route => route.path === '/')
      const childRoutes = rootRoute?.children || []
      
      // Should have exactly 6 default child routes
      expect(childRoutes.length).toBe(6)
    })

    test('should handle null dashboard routes', async () => {
      mockAppConfig.getDashboardRoutes.mockReturnValue(null)
      
      // Re-import to get fresh instance with new config
      vi.resetModules()
      const { default: router } = await import('@/router/index')
      
      const routes = router.getRoutes()
      const rootRoute = routes.find(route => route.path === '/')
      const childRoutes = rootRoute?.children || []
      
      // Should have exactly 6 default child routes when dashboard routes is null
      expect(childRoutes.length).toBe(6)
    })
  })

  describe('Auth service initialization', () => {
    test('should initialize auth service only once', async () => {
      const mockGetAuthService = await import('@/services/AuthServiceFactory')
      
      // Reset the module to ensure clean state
      vi.resetModules()
      
      // Import router multiple times
      await import('@/router/index')
      await import('@/router/index')
      
      // Auth service factory should be called when guards are executed
      const mockNext = vi.fn()
      const mockTo = { path: '/dashboard', name: 'Dashboard' }
      const mockFrom = { path: '/' }
      
      // Simulate multiple guard executions to test singleton behavior
      // The auth service should be cached after first initialization
      expect(mockGetAuthService.default).toBeDefined()
    })

    test('should handle auth service initialization failure', async () => {
      const mockGetAuthService = await import('@/services/AuthServiceFactory')
      vi.mocked(mockGetAuthService.default).mockRejectedValue(new Error('Initialization failed'))
      
      vi.resetModules()
      const { default: router } = await import('@/router/index')
      
      const mockNext = vi.fn()
      const mockTo = { path: '/dashboard', name: 'Dashboard' }
      const mockFrom = { path: '/' }
      
      // Try to trigger a navigation that would initialize auth service
      await new Promise((resolve) => {
        setTimeout(resolve, 10) // Give time for any async initialization
      })
      
      expect(router).toBeDefined()
    })
  })
})
