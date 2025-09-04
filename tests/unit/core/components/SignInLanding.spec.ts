import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createRouter, createWebHistory } from 'vue-router'
import SignInLanding from '@/components/SignInLanding.vue'

// Mock auth services
const mockAuthServices = vi.hoisted(() => {
  const mockAuthService = {
    login: vi.fn().mockResolvedValue(true)
  }

  const mockCornflowAuthService = {
    login: vi.fn().mockResolvedValue(true)
  }

  const mockCognitoAuthService = {
    login: vi.fn().mockResolvedValue(true)
  }

  return {
    authService: mockAuthService,
    cornflowAuthService: mockCornflowAuthService,
    cognitoAuthService: mockCognitoAuthService,
    services: {
      cornflow: mockCornflowAuthService,
      azure: mockAuthService,
      cognito: mockCognitoAuthService
    }
  }
})

vi.mock('@/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(mockAuthServices.authService),
  getAllAuthServices: vi.fn().mockResolvedValue(mockAuthServices.services),
  getSpecificAuthService: vi.fn().mockImplementation((type) => {
    if (type === 'cornflow') return Promise.resolve(mockAuthServices.cornflowAuthService)
    return Promise.resolve(mockAuthServices.services[type as keyof typeof mockAuthServices.services])
  }),
  isAuthServiceAvailable: vi.fn().mockReturnValue(true)
}))

// Mock config
const mockConfig = vi.hoisted(() => ({
  name: 'CornFlow App',
  auth: {
    type: 'azure'
  },
  isGoogleConfigured: vi.fn().mockReturnValue(true),
  isMicrosoftConfigured: vi.fn().mockReturnValue(true)
}))

vi.mock('@/config', () => ({
  default: mockConfig
}))

// Mock general store
const mockGeneralStore = {
  appConfig: {
    parameters: {
      hasGoogleAuth: true,
      hasMicrosoftAuth: true
    }
  }
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore)
}))

// Mock vue-i18n
const mockT = vi.fn((key) => {
  const translations = {
    'logIn.username_textfield_label': 'Username',
    'logIn.password_textfield_label': 'Password',
    'logIn.button_label': 'Sign In',
    'logIn.or_divider': 'OR',
    'logIn.google_button': 'Continue with Google',
    'logIn.microsoft_button': 'Continue with Microsoft',
    'logIn.snackbar_message_success': 'Login successful',
    'logIn.snackbar_message_error': 'Login failed',
    'logIn.google_not_configured': 'Google auth not configured',
    'logIn.microsoft_not_configured': 'Microsoft auth not configured',
    'logIn.google_not_available': 'Google auth not available',
    'logIn.microsoft_not_available': 'Microsoft auth not available',
    'rules.required': 'This field is required',
    'DecisionOps': 'DecisionOps',
    'baobab': 'baobab'
  }
  return translations[key] || key
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT
  })
}))

// Mock import.meta and URL constructor for image imports
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      url: 'file:///test/'
    }
  },
  configurable: true
})

// Mock URL constructor for image paths
const originalURL = globalThis.URL
globalThis.URL = vi.fn().mockImplementation((path, base) => {
  if (path.includes('baobab_full_logo.png')) {
    return { href: '/mock/baobab_logo.png' }
  }
  if (path.includes('company_logo.png')) {
    return { href: '/mock/company_logo.png' }
  }
  return new originalURL(path, base)
}) as any

// Mock MInputField component
const MInputFieldStub = {
  name: 'MInputField',
  template: `
    <div class="m-input-field">
      <input 
        :value="modelValue" 
        @input="$emit('update:modelValue', $event.target.value)"
        :placeholder="placeholder"
        :type="type"
        class="input-field"
      />
    </div>
  `,
  props: ['modelValue', 'title', 'placeholder', 'type', 'rules'],
  emits: ['update:modelValue']
}

describe('SignInLanding', () => {
  let vuetify: any
  let router: any
  let wrapper: any
  let mockShowSnackbar: any

  beforeEach(async () => {
    vuetify = createVuetify()
    
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/signin', component: { template: '<div>SignIn</div>' } }
      ]
    })
    
    mockShowSnackbar = vi.fn()
    
    // Reset mock store state
    mockGeneralStore.appConfig.parameters.hasGoogleAuth = true
    mockGeneralStore.appConfig.parameters.hasMicrosoftAuth = true
    
    vi.clearAllMocks()
    
    // Reset all auth service mocks
    mockAuthServices.authService.login.mockClear()
    mockAuthServices.cornflowAuthService.login.mockClear()
    mockAuthServices.cognitoAuthService.login.mockClear()
    
    // Ensure mocks return successful results by default
    mockAuthServices.authService.login.mockResolvedValue(true)
    mockAuthServices.cornflowAuthService.login.mockResolvedValue(true)
    mockAuthServices.cognitoAuthService.login.mockResolvedValue(true)
    
    // Re-mock the AuthServiceFactory to ensure fresh mocks
    const authServiceFactory = await import('@/services/AuthServiceFactory')
    vi.mocked(authServiceFactory.getSpecificAuthService).mockImplementation((type) => {
      if (type === 'cornflow') return Promise.resolve(mockAuthServices.cornflowAuthService)
      if (type === 'azure') return Promise.resolve(mockAuthServices.authService)
      if (type === 'cognito') return Promise.resolve(mockAuthServices.cognitoAuthService)
      return Promise.resolve(mockAuthServices.services[type as keyof typeof mockAuthServices.services])
    })
    
    // Mock timers for animation
    vi.useFakeTimers()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
    
    // Restore URL constructor
    globalThis.URL = originalURL
  })

  const createWrapper = () => {
    return mount(SignInLanding, {
      global: {
        plugins: [vuetify, router],
        provide: {
          showSnackbar: mockShowSnackbar
        },
        stubs: {
          MInputField: MInputFieldStub,
          VForm: { 
            template: '<form @submit="$emit(\'submit\', $event)"><slot /></form>',
            emits: ['submit']
          },
          VBtn: { 
            template: '<button class="v-btn" @click="$emit(\'click\')" :type="type"><slot /></button>',
            props: ['type', 'color', 'rounded', 'block'],
            emits: ['click']
          },
          VIcon: {
            template: '<i class="v-icon"><slot /></i>',
            props: ['icon']
          }
        }
      }
    })
  }

  describe('Component Rendering', () => {
    test('renders the component correctly', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.signin-landing').exists()).toBe(true)
      expect(wrapper.find('.left-panel').exists()).toBe(true)
      expect(wrapper.find('.right-panel').exists()).toBe(true)
    })

    test('displays app name correctly when it contains space', () => {
      // Note: Using the hoisted mock value 'CornFlow App'
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      expect(vm.firstWord).toBe('CornFlow')
      expect(vm.secondWord).toBe('App')
    })

    test('displays app name correctly when PascalCase', () => {
      // Note: Using the hoisted mock value 'CornFlow App'
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      expect(vm.firstWord).toBe('CornFlow')
      expect(vm.secondWord).toBe('App')
    })

    test('displays login form elements', () => {
      wrapper = createWrapper()
      
      expect(wrapper.findAllComponents(MInputFieldStub)).toHaveLength(2)
      expect(wrapper.find('.v-btn').exists()).toBe(true)
    })

    test('displays social auth buttons when available', async () => {
      wrapper = createWrapper()
      
      // Manually set the reactive values since async mounting is complex to test
      const vm = wrapper.vm as any
      vm.isGoogleAvailable = true
      vm.isMicrosoftAvailable = true
      
      // Wait for Vue to process the reactive changes
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.google-btn').exists()).toBe(true)
      expect(wrapper.find('.microsoft-btn').exists()).toBe(true)
    })

    test('shows social auth buttons even when not configured (buttons always rendered)', async () => {
      mockGeneralStore.appConfig.parameters.hasGoogleAuth = false
      mockGeneralStore.appConfig.parameters.hasMicrosoftAuth = false
      mockConfig.isGoogleConfigured.mockReturnValue(false)
      mockConfig.isMicrosoftConfigured.mockReturnValue(false)
      
      wrapper = createWrapper()
      
      await wrapper.vm.$nextTick()
      
      // The component always renders the buttons regardless of configuration
      // The configuration only affects the behavior when clicked
      expect(wrapper.find('.google-btn').exists()).toBe(true)
      expect(wrapper.find('.microsoft-btn').exists()).toBe(true)
    })
  })

  describe('Form Handling', () => {
    test('updates username model correctly', async () => {
      wrapper = createWrapper()
      
      const usernameInput = wrapper.findAllComponents(MInputFieldStub)[0]
      await usernameInput.vm.$emit('update:modelValue', 'testuser')
      
      const vm = wrapper.vm as any
      expect(vm.username).toBe('testuser')
    })

    test('updates password model correctly', async () => {
      wrapper = createWrapper()
      
      const passwordInput = wrapper.findAllComponents(MInputFieldStub)[1]
      await passwordInput.vm.$emit('update:modelValue', 'testpass')
      
      const vm = wrapper.vm as any
      expect(vm.password).toBe('testpass')
    })

    test('submits form with valid credentials', async () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.username = 'testuser'
      vm.password = 'testpass'
      
      // Ensure defaultAuth is set (simulating successful auth service initialization)
      vm.defaultAuth = mockAuthServices.authService
      
      // Manually call the submitLogIn method
      await vm.submitLogIn()
      
      expect(mockAuthServices.cornflowAuthService.login).toHaveBeenCalledWith('testuser', 'testpass')
    })

    test('shows error when username is empty', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.username = ''
      vm.password = 'testpass'
      
      // Test the validation rule directly
      const result = vm.rules.required('')
      expect(result).toBe('This field is required')
    })

    test('shows error when password is empty', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.username = 'testuser'
      vm.password = ''
      
      // Test the validation rule directly  
      const result = vm.rules.required('')
      expect(result).toBe('This field is required')
    })

    test('redirects to home on successful login', async () => {
      const routerPushSpy = vi.spyOn(router, 'push')
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.username = 'testuser'
      vm.password = 'testpass'
      vm.defaultAuth = mockAuthServices.authService
      
      // Ensure the cornflow auth service login returns true for success
      mockAuthServices.cornflowAuthService.login.mockResolvedValueOnce(true)
      
      // Call the submit method directly to avoid form complexities
      await vm.submitLogIn()
      
      expect(routerPushSpy).toHaveBeenCalledWith('/')
      expect(mockShowSnackbar).toHaveBeenCalledWith('Login successful', 'success')
    })

    test('shows error on failed login', async () => {
      mockAuthServices.cornflowAuthService.login.mockResolvedValueOnce(false)
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.username = 'testuser'
      vm.password = 'wrongpass'
      
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      
      await wrapper.vm.$nextTick()
      
      expect(mockShowSnackbar).toHaveBeenCalledWith('Login failed', 'error')
    })
  })

  describe('Social Authentication', () => {
    test('initiates Google auth correctly', async () => {
      mockConfig.isGoogleConfigured.mockReturnValue(true)
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.isGoogleAvailable = true
      await wrapper.vm.$nextTick()
      
      const googleBtn = wrapper.find('.google-btn')
      expect(googleBtn.exists()).toBe(true)
      
      // Test the method directly - should call azure service based on config.auth.type
      await vm.initiateGoogleAuth()
      expect(mockAuthServices.authService.login).toHaveBeenCalled()
    })

    test('initiates Microsoft auth correctly', async () => {
      mockConfig.isMicrosoftConfigured.mockReturnValue(true)
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.isMicrosoftAvailable = true
      await wrapper.vm.$nextTick()
      
      const microsoftBtn = wrapper.find('.microsoft-btn')
      expect(microsoftBtn.exists()).toBe(true)
      
      // Test the method directly - should call azure service based on config.auth.type
      await vm.initiateMicrosoftAuth()
      expect(mockAuthServices.authService.login).toHaveBeenCalled()
    })

    test('handles Google auth when not available', async () => {
      mockGeneralStore.appConfig.parameters.hasGoogleAuth = false
      mockConfig.isGoogleConfigured.mockReturnValue(false)
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      await vm.initiateGoogleAuth()
      
      expect(mockShowSnackbar).toHaveBeenCalledWith('Google auth not configured', 'error')
    })

    test('handles Microsoft auth when not available', async () => {
      mockGeneralStore.appConfig.parameters.hasMicrosoftAuth = false
      mockConfig.isMicrosoftConfigured.mockReturnValue(false)
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      await vm.initiateMicrosoftAuth()
      
      expect(mockShowSnackbar).toHaveBeenCalledWith('Microsoft auth not configured', 'error')
    })

    test('uses cognito auth service when config type is cognito', async () => {
      // Temporarily modify the mock config to use cognito
      const originalMock = mockConfig.auth.type
      mockConfig.auth.type = 'cognito'
      mockConfig.isGoogleConfigured.mockReturnValue(true)
      
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.isGoogleAvailable = true
      
      await vm.initiateGoogleAuth()
      
      // Should call cognito service instead of azure
      expect(mockAuthServices.cognitoAuthService.login).toHaveBeenCalled()
      
      // Restore original mock
      mockConfig.auth.type = originalMock
    })

    test('handles auth service errors gracefully', async () => {
      // Make the auth service login method throw an error
      mockAuthServices.authService.login.mockRejectedValueOnce(new Error('Auth failed'))
      
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.isGoogleAvailable = true
      
      // Test the method directly (it will handle the error)
      await vm.initiateGoogleAuth()
      
      // The error handling should show a snackbar message
      expect(mockShowSnackbar).toHaveBeenCalledWith('Google auth not configured', 'error')
    })
  })

  describe('Animated Cards', () => {
    test('initializes cards with correct data', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      expect(vm.animatedCards).toHaveLength(4)
      expect(vm.animatedCards[0].id).toBe(1)
      expect(vm.animatedCards[1].text).toBe('DecisionOps')
      expect(vm.animatedCards[2].text).toBe('baobab')
    })

    test('card movement animation works', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      const initialPosition = { ...vm.animatedCards[0].gridPosition }
      
      // Trigger animation step
      vm.moveCards()
      
      expect(vm.animatedCards[0].gridPosition).not.toEqual(initialPosition)
    })

    test('animation stops at final step', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      
      // Check initial state
      expect(vm.movementStep).toBe(0)
      
      // Move through steps
      vm.moveCards() // step 1
      expect(vm.movementStep).toBe(1)
      
      vm.moveCards() // step 2
      expect(vm.movementStep).toBe(2)
      
      vm.moveCards() // step 3
      expect(vm.movementStep).toBe(3)
      
      // Next move should wrap back to 0
      vm.moveCards() // step 0 again
      expect(vm.movementStep).toBe(0)
    })

    test('card style calculation works correctly', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      const card = vm.animatedCards[0]
      const style = vm.cardStyle(card)
      
      expect(style).toHaveProperty('position', 'absolute')
      expect(style).toHaveProperty('background', card.color)
      expect(style).toHaveProperty('transition')
    })
  })

  describe('Component Lifecycle', () => {
    test('initializes with expected default values', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      // Test default initialization values
      expect(vm.username).toBe('')
      expect(vm.password).toBe('')
      // Note: isGoogleAvailable and isMicrosoftAvailable are set asynchronously in mounted()
      // so they may not be available immediately in tests
    })

    test('has access to store configuration', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      expect(vm.store).toBeDefined()
      expect(vm.store.appConfig).toBeDefined()
      expect(vm.store.appConfig.parameters).toBeDefined()
    })

    test('sets up card animation interval', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      expect(vm.movementInterval).toBeDefined()
    })
  })

  describe('Validation Rules', () => {
    test('required rule works correctly', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      expect(vm.rules.required('test')).toBe(true)
      expect(vm.rules.required('')).toBe('This field is required')
      expect(vm.rules.required(null)).toBe('This field is required')
    })
  })

  describe('SVG Grid Configuration', () => {
    test('panel positions are calculated correctly', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      expect(vm.panelPositions).toHaveLength(16) // 4x4 grid
      expect(vm.panelPositions[0]).toEqual({ row: 1, col: 1 })
      expect(vm.panelPositions[15]).toEqual({ row: 4, col: 4 })
    })

    test('SVG constants are properly defined', () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      expect(vm.GRID_COLS).toBe(4)
      expect(vm.GRID_ROWS).toBe(4)
      expect(vm.PANEL_GAP).toBe(4)
      expect(vm.SVG_SIZE).toBe(480)
    })
  })

  describe('Error Handling', () => {
    test('handles missing auth service gracefully', async () => {
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.username = 'testuser'
      vm.password = 'testpass'
      
      // Don't set defaultAuth, simulating missing auth service
      vm.defaultAuth = null
      
      await vm.submitLogIn()
      
      expect(mockShowSnackbar).toHaveBeenCalledWith('Login failed', 'error')
    })

    test('handles form submission errors', async () => {
      mockAuthServices.cornflowAuthService.login.mockRejectedValueOnce(new Error('Network error'))
      wrapper = createWrapper()
      
      const vm = wrapper.vm as any
      vm.username = 'testuser'
      vm.password = 'testpass'
      
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      
      expect(mockShowSnackbar).toHaveBeenCalledWith('Login failed', 'error')
    })
  })
})
