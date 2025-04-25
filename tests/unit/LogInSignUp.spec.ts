import { mount } from '@vue/test-utils'
import { describe, test, vi, beforeEach, expect } from 'vitest'
import LoginSignup from '../../src/components/LogInSignUp.vue'

// Hoisted mocks
const mockConfig = vi.hoisted(() => ({
  auth: { type: 'cornflow' },
  initConfig: vi.fn().mockResolvedValue(undefined)
}))

const mockAuthService = vi.hoisted(() => ({
  login: vi.fn().mockResolvedValue({ status: 200 }),
  signup: vi.fn().mockResolvedValue({ status: 200 })
}))

const mockGeneralStore = vi.hoisted(() => ({
  appConfig: { parameters: { enableSignup: true } }
}))

// Mock Vue Router to avoid dependency issues
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    query: { from: null, expired: null }
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn()
  })),
  createRouter: vi.fn(() => ({
    push: vi.fn(),
    beforeEach: vi.fn(),
    afterEach: vi.fn()
  })),
  createWebHistory: vi.fn(),
  createWebHashHistory: vi.fn()
}))

vi.mock('../../src/config', () => ({ 
  default: mockConfig 
}))

vi.mock('../../src/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore)
}))

vi.mock('../../src/services/AuthService', () => ({
  default: mockAuthService
}))

describe('LoginSignup.vue', () => {
  // Create a helper to mount the component with common options
  const mountComponent = (options = {}) => {
    return mount(LoginSignup, {
      global: {
        provide: {
          showSnackbar: vi.fn()
        },
        mocks: {
          $t: (key) => key
        },
        stubs: {
          'v-card': true,
          'v-card-title': true,
          'v-card-subtitle': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-text-field': true,
          'v-form': true,
          'v-btn': true,
          'v-row': true,
          'v-col': true,
          'v-img': true,
          'MButton': true,
          'divider': true
        }
      },
      shallow: true,
      ...options
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.auth.type = 'cornflow'
  })

  test('renders without errors', () => {
    const wrapper = mountComponent()
    expect(wrapper.exists()).toBe(true)
  })
  
  test('changes auth type based on configuration', () => {
    // Test with cornflow auth
    mockConfig.auth.type = 'cornflow'
    const wrapper = mountComponent()
    expect(wrapper.vm.isCornflowAuth).toBeTruthy()
    
    // Test with azure auth 
    mockConfig.auth.type = 'azure'
    const azureWrapper = mountComponent()
    expect(azureWrapper.vm.isCornflowAuth).toBeFalsy()
    
    // Test with cognito auth
    mockConfig.auth.type = 'cognito'
    const cognitoWrapper = mountComponent()
    expect(cognitoWrapper.vm.isCornflowAuth).toBeFalsy()
  })
  
  test('auth service is properly mocked', () => {
    // Verify mock functions are defined
    expect(mockAuthService.login).toBeDefined()
    expect(mockAuthService.signup).toBeDefined()
    
    // Call the mocked functions
    mockAuthService.login('test', 'test')
    mockAuthService.signup('test', 'test', 'test@test.com')
    
    // Verify they were called as expected
    expect(mockAuthService.login).toHaveBeenCalledWith('test', 'test')
    expect(mockAuthService.signup).toHaveBeenCalledWith('test', 'test', 'test@test.com')
  })
})
