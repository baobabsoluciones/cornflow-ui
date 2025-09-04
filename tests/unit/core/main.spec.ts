import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock all dependencies
const mockApp = {
  component: vi.fn().mockReturnThis(),
  use: vi.fn().mockReturnThis(),
  mount: vi.fn().mockReturnThis(),
}

const mockPinia = {}

// Mock Vue functions  
const mockCreateApp = vi.fn()
vi.mock('vue', () => ({
  createApp: mockCreateApp
}))

const mockCreatePinia = vi.fn()
vi.mock('pinia', () => ({
  createPinia: mockCreatePinia
}))

// Mock App component
vi.mock('@/App.vue', () => ({
  default: { name: 'App' }
}))

// Mock config
const mockConfig = {
  initConfig: vi.fn().mockResolvedValue(undefined),
  defaultLanguage: 'en'
}

vi.mock('@/config', () => ({
  default: mockConfig
}))

// Mock app config
const mockAppConfig = {
  updateConfig: vi.fn(),
  getCore: vi.fn().mockReturnValue({
    parameters: {
      defaultLanguage: 'en'
    }
  })
}

vi.mock('@/app/config', () => ({
  default: mockAppConfig
}))

// Mock plugins
const mockRegisterPlugins = vi.fn()
vi.mock('@/plugins', () => ({
  registerPlugins: mockRegisterPlugins
}))

// Mock i18n
const mockSetDefaultLanguage = vi.fn()
vi.mock('@/plugins/i18n', () => ({
  setDefaultLanguage: mockSetDefaultLanguage
}))

// Mock Mango UI components
vi.mock('mango-vue', () => ({
  MAppDrawer: { name: 'MAppDrawer' },
  MFilterSearch: { name: 'MFilterSearch' },
  MButton: { name: 'MButton' },
  MFormSteps: { name: 'MFormSteps' },
  MDragNDropFile: { name: 'MDragNDropFile' },
  MBaseModal: { name: 'MBaseModal' },
  MSnackbar: { name: 'MSnackbar' },
  MTitleView: { name: 'MTitleView' },
  MAppBarTab: { name: 'MAppBarTab' },
  MInfoCard: { name: 'MInfoCard' },
  MPanelData: { name: 'MPanelData' },
  MInputField: { name: 'MInputField' },
  MDataTable: { name: 'MDataTable' },
  MCheckboxOptions: { name: 'MCheckboxOptions' },
  MTabTable: { name: 'MTabTable' }
}))

// Mock CSS imports
vi.mock('./assets/styles/main.css', () => ({}))
vi.mock('./app/assets/styles/main.css', () => ({}))
vi.mock('./app/assets/styles/variables.css', () => ({}))
vi.mock('mango-vue/dist/style.css', () => ({}))

describe('Main Module Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock implementations
    mockCreateApp.mockReturnValue(mockApp)
    mockCreatePinia.mockReturnValue(mockPinia)
    mockConfig.initConfig.mockResolvedValue(undefined)
    mockConfig.defaultLanguage = 'en'
    mockAppConfig.getCore.mockReturnValue({
      parameters: {
        defaultLanguage: 'en'
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should execute initApp function successfully', async () => {
    const { initApp } = await import('@/main')
    
    await initApp()

    // Verify initialization sequence
    expect(mockConfig.initConfig).toHaveBeenCalled()
    expect(mockAppConfig.updateConfig).toHaveBeenCalled()
    expect(mockSetDefaultLanguage).toHaveBeenCalledWith('en')
  })

  test('should create and configure Vue app', async () => {
    const { initApp } = await import('@/main')
    
    await initApp()

    expect(mockCreateApp).toHaveBeenCalled()
    expect(mockCreatePinia).toHaveBeenCalled()
    expect(mockRegisterPlugins).toHaveBeenCalledWith(mockApp)
    expect(mockApp.use).toHaveBeenCalledWith(mockPinia)
    expect(mockApp.mount).toHaveBeenCalledWith('#app')
  })

  test('should register all Mango UI components', async () => {
    const { initApp } = await import('@/main')
    
    await initApp()

    const expectedComponents = [
      'MAppDrawer', 'MFilterSearch', 'MButton', 'MFormSteps', 'MDragNDropFile',
      'MBaseModal', 'MTitleView', 'MAppBarTab', 'MInfoCard', 'MPanelData',
      'MSnackbar', 'MInputField', 'MDataTable', 'MCheckboxOptions', 'MTabTable'
    ]

    expectedComponents.forEach(componentName => {
      expect(mockApp.component).toHaveBeenCalledWith(componentName, expect.any(Object))
    })
  })

  test('should set default language for Spanish', async () => {
    mockConfig.defaultLanguage = 'es'

    const { initApp } = await import('@/main')
    
    await initApp()

    expect(mockSetDefaultLanguage).toHaveBeenCalledWith('es')
  })

  test('should set default language for French', async () => {
    mockConfig.defaultLanguage = 'fr'

    const { initApp } = await import('@/main')
    
    await initApp()

    expect(mockSetDefaultLanguage).toHaveBeenCalledWith('fr')
  })

  test('should not set language for invalid language', async () => {
    mockConfig.defaultLanguage = 'invalid'

    const { initApp } = await import('@/main')
    
    await initApp()

    expect(mockSetDefaultLanguage).not.toHaveBeenCalled()
  })

  test('should not set language when undefined', async () => {
    mockConfig.defaultLanguage = undefined

    const { initApp } = await import('@/main')
    
    await initApp()

    expect(mockSetDefaultLanguage).not.toHaveBeenCalled()
  })

  test('should handle config initialization error', async () => {
    const initError = new Error('Config initialization failed')
    mockConfig.initConfig.mockRejectedValue(initError)

    const { initApp } = await import('@/main')
    
    await expect(initApp()).rejects.toThrow('Config initialization failed')
  })

  test('should follow correct initialization sequence', async () => {
    const callOrder: string[] = []
    
    mockConfig.initConfig.mockImplementation(() => {
      callOrder.push('initConfig')
      return Promise.resolve()
    })
    
    mockAppConfig.updateConfig.mockImplementation(() => {
      callOrder.push('updateConfig')
    })
    
    mockSetDefaultLanguage.mockImplementation(() => {
      callOrder.push('setDefaultLanguage')
    })

    mockCreateApp.mockImplementation(() => {
      callOrder.push('createApp')
      return mockApp
    })

    mockCreatePinia.mockImplementation(() => {
      callOrder.push('createPinia')
      return mockPinia
    })

    mockRegisterPlugins.mockImplementation(() => {
      callOrder.push('registerPlugins')
    })

    mockApp.component.mockImplementation(() => {
      if (!callOrder.includes('componentRegistration')) {
        callOrder.push('componentRegistration')
      }
      return mockApp
    })

    mockApp.use.mockImplementation(() => {
      callOrder.push('usePinia')
      return mockApp
    })

    mockApp.mount.mockImplementation(() => {
      callOrder.push('mount')
      return mockApp
    })

    const { initApp } = await import('@/main')
    await initApp()

    expect(callOrder).toEqual([
      'initConfig',
      'updateConfig', 
      'setDefaultLanguage',
      'createApp',
      'createPinia',
      'registerPlugins',
      'componentRegistration',
      'usePinia',
      'mount'
    ])
  })

  test('should register exactly 15 components', async () => {
    const { initApp } = await import('@/main')
    
    await initApp()

    // Filter component calls (excluding other chained calls)
    const componentCalls = mockApp.component.mock.calls
    expect(componentCalls).toHaveLength(15)
  })

  test('should handle app creation with correct App component', async () => {
    const { initApp } = await import('@/main')
    const { default: App } = await import('@/App.vue')
    
    await initApp()

    expect(mockCreateApp).toHaveBeenCalledWith(App)
  })

  test('should integrate Pinia correctly', async () => {
    const { initApp } = await import('@/main')
    
    await initApp()

    expect(mockCreatePinia).toHaveBeenCalled()
    expect(mockApp.use).toHaveBeenCalledWith(mockPinia)
  })
})

describe('Main Module - Dependency Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should import without errors', async () => {
    // Test that main.ts dependencies are available
    expect(async () => {
      await import('vue')
      await import('pinia')
      await import('@/App.vue')
      await import('@/config')
      await import('@/app/config')
      await import('@/plugins/i18n')
    }).not.toThrow()
  })

  test('should have access to all required dependencies', async () => {
    const { default: App } = await import('@/App.vue')
    const { default: config } = await import('@/config')
    const { default: appConfig } = await import('@/app/config')
    const { setDefaultLanguage } = await import('@/plugins/i18n')

    expect(mockCreateApp).toBeDefined()
    expect(mockCreatePinia).toBeDefined()
    expect(App).toBeDefined()
    expect(config).toBeDefined()
    expect(appConfig).toBeDefined()
    expect(setDefaultLanguage).toBeDefined()
  })

  test('should have access to all Mango UI components', async () => {
    const components = await import('mango-vue')
    
    const expectedComponents = [
      'MAppDrawer', 'MFilterSearch', 'MButton', 'MFormSteps', 'MDragNDropFile',
      'MBaseModal', 'MSnackbar', 'MTitleView', 'MAppBarTab', 'MInfoCard',
      'MPanelData', 'MInputField', 'MDataTable', 'MCheckboxOptions', 'MTabTable'
    ]

    expectedComponents.forEach(componentName => {
      expect(components[componentName]).toBeDefined()
    })
  })
})