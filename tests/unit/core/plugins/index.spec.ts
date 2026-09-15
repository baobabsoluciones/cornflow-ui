import { describe, test, expect, vi, beforeEach } from 'vitest'
import { registerPlugins } from '@cornflow-ui/core/plugins/index'
import type { App } from 'vue'

// Mock the plugins
vi.mock('@cornflow-ui/core/plugins/webfontloader', () => ({
  loadFonts: vi.fn()
}))

vi.mock('@cornflow-ui/core/plugins/vuetify', () => ({
  default: { install: vi.fn() }
}))

const { mockRouterInstance } = vi.hoisted(() => ({
  mockRouterInstance: { install: vi.fn() }
}))

vi.mock('@cornflow-ui/core/router', () => ({
  default: mockRouterInstance,
  getRouter: () => mockRouterInstance
}))

vi.mock('@cornflow-ui/core/plugins/i18n', () => ({
  default: { install: vi.fn() }
}))

describe('plugins/index', () => {
  let mockApp: App
  let mockLoadFonts: any
  let mockVuetify: any
  let mockRouter: any
  let mockI18n: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Create mock app with use method
    mockApp = {
      use: vi.fn().mockReturnThis(),
    } as unknown as App

    // Get the mocked modules
    const webfontloader = await import('@cornflow-ui/core/plugins/webfontloader')
    const vuetify = await import('@cornflow-ui/core/plugins/vuetify')
    const router = await import('@cornflow-ui/core/router')
    const i18n = await import('@cornflow-ui/core/plugins/i18n')

    mockLoadFonts = webfontloader.loadFonts
    mockVuetify = vuetify.default
    mockRouter = router.default
    mockI18n = i18n.default
  })

  test('should register all plugins in correct order', () => {
    registerPlugins(mockApp)

    // Check that loadFonts is called
    expect(mockLoadFonts).toHaveBeenCalledTimes(1)

    // Check that app.use is called for each plugin
    expect(mockApp.use).toHaveBeenCalledTimes(3)
    expect(mockApp.use).toHaveBeenNthCalledWith(1, mockVuetify)
    expect(mockApp.use).toHaveBeenNthCalledWith(2, mockRouter)
    expect(mockApp.use).toHaveBeenNthCalledWith(3, mockI18n)
  })

  test('should load fonts before registering plugins', () => {
    const callOrder: string[] = []
    
    mockLoadFonts.mockImplementation(() => {
      callOrder.push('loadFonts')
    })
    
    mockApp.use = vi.fn().mockImplementation(() => {
      callOrder.push('app.use')
      return mockApp
    })

    registerPlugins(mockApp)

    expect(callOrder[0]).toBe('loadFonts')
    expect(callOrder[1]).toBe('app.use')
  })

  test('should handle plugin registration errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApp.use = vi.fn().mockImplementation(() => {
      throw new Error('Plugin registration failed')
    })

    expect(() => registerPlugins(mockApp)).toThrow('Plugin registration failed')
    
    consoleSpy.mockRestore()
  })
})
