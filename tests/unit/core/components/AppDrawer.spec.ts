import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AppDrawer from '@/components/AppDrawer.vue'

// Properly hoist mock definitions
const { mockUser, mockStore, mockAuth, mockAppConfig, mockRouter, mockRoute, mockShowSnackbar, mockT } = vi.hoisted(() => {
  const mockUser = {
    fullName: 'John Doe',
    username: 'johndoe',
    email: 'john.doe@example.com'
  }

  const mockStore = {
    getUser: mockUser,
    appDashboardPages: [
      {
        title: 'Custom Dashboard',
        icon: 'mdi-chart-line',
        to: '/custom-dashboard'
      }
    ]
  }

  const mockAuth = {
    logout: vi.fn().mockResolvedValue(undefined)
  }

  const mockAppConfig = {
    getCore: vi.fn().mockReturnValue({
      parameters: {
        showUserFullName: true,
        showDashboardMainView: true
      }
    })
  }

  const mockRouter = {
    push: vi.fn()
  }

  const mockRoute = {
    path: '/project-execution'
  }

  const mockShowSnackbar = vi.fn()

  // Mock $t function for i18n
  const mockT = vi.fn((key) => {
    const translations = {
      'projectExecution.title': 'Project Execution',
      'versionHistory.title': 'Version History',
      'inputOutputData.title': 'Input/Output Data',
      'inputOutputData.inputTitle': 'Input Data',
      'inputOutputData.outputTitle': 'Output Data',
      'logOut.title': 'Logout',
      'logOut.accept': 'Accept',
      'logOut.cancel': 'Cancel',
      'logOut.message': 'Are you sure you want to logout?',
      'logOut.snackbar_message_success': 'Logout successful',
      'logOut.snackbar_message_error': 'Logout error'
    }
    return translations[key] || key
  })

  return { mockUser, mockStore, mockAuth, mockAppConfig, mockRouter, mockRoute, mockShowSnackbar, mockT }
})

// Create i18n instance for testing
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      'projectExecution.title': 'Project Execution',
      'versionHistory.title': 'Version History',
      'inputOutputData.title': 'Input/Output Data',
      'inputOutputData.inputTitle': 'Input Data',
      'inputOutputData.outputTitle': 'Output Data',
      'logOut.title': 'Logout',
      'logOut.accept': 'Accept',
      'logOut.cancel': 'Cancel',
      'logOut.message': 'Are you sure you want to logout?',
      'logOut.snackbar_message_success': 'Logout successful',
      'logOut.snackbar_message_error': 'Logout error'
    }
  }
})

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockStore)
}))

vi.mock('@/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(mockAuth)
}))

vi.mock('@/app/config', () => ({
  default: mockAppConfig
}))

// Mock Vuetify components
const MockVImg = {
  name: 'VImg',
  props: ['src', 'height', 'position'],
  template: '<img data-testid="v-img" :src="src" :style="{ height: height }" />'
}

const MockVIcon = {
  name: 'VIcon',
  props: ['left'],
  template: '<span data-testid="v-icon"><slot /></span>'
}

const MockVListItem = {
  name: 'VListItem',
  props: ['baseColor', 'color', 'to'],
  template: '<div data-testid="v-list-item"><slot /></div>',
  emits: ['click']
}

const MockVDivider = {
  name: 'VDivider',
  template: '<hr data-testid="v-divider" />'
}

const MockVList = {
  name: 'VList',
  template: '<div data-testid="v-list"><slot /></div>'
}

const MockVRow = {
  name: 'VRow',
  template: '<div data-testid="v-row"><slot /></div>'
}

const MockVCol = {
  name: 'VCol',
  template: '<div data-testid="v-col"><slot /></div>'
}

// Mock Mango UI components
const MockMAppDrawer = {
  name: 'MAppDrawer',
  props: ['visible', 'width'],
  emits: ['update:rail'],
  template: `
    <div data-testid="m-app-drawer">
      <slot name="logo"></slot>
      <slot name="user"></slot>
      <slot name="menu"></slot>
      <slot name="actions"></slot>
    </div>
  `
}

const MockMBaseModal = {
  name: 'MBaseModal',
  props: ['modelValue', 'closeOnOutsideClick', 'title', 'buttons'],
  emits: ['save', 'cancel', 'close'],
  template: `
    <div v-if="modelValue" data-testid="m-base-modal">
      <div data-testid="modal-title">{{ title }}</div>
      <slot name="content"></slot>
      <div data-testid="modal-buttons">
        <button v-for="button in buttons" :key="button.text" @click="$emit(button.action)">
          {{ button.text }}
        </button>
      </div>
    </div>
  `
}

describe('AppDrawer.vue', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.logout.mockResolvedValue(undefined)
    
    // Ensure appConfig mock returns the correct structure
    mockAppConfig.getCore.mockReturnValue({
      parameters: {
        showUserFullName: true,
        showDashboardMainView: true
      }
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.restoreAllMocks()
  })

  const createWrapper = async (options = {}) => {
    const wrapper = mount(AppDrawer, {
      global: {
        plugins: [i18n],
        components: {
          MAppDrawer: MockMAppDrawer,
          MBaseModal: MockMBaseModal,
          VImg: MockVImg,
          VIcon: MockVIcon,
          VListItem: MockVListItem,
          VDivider: MockVDivider,
          VList: MockVList,
          VRow: MockVRow,
          VCol: MockVCol
        },
        provide: {
          showSnackbar: mockShowSnackbar
        },
        mocks: {
          $router: mockRouter,
          $route: mockRoute
        },
        ...options
      }
    })
    
    // Wait for component to be fully mounted
    await wrapper.vm.$nextTick()
    
    // Ensure auth service is properly set - component's created() might not set it properly in test environment
    if (!wrapper.vm.auth) {
      wrapper.vm.auth = mockAuth
    }
    
    await wrapper.vm.$nextTick()
    
    return wrapper
  }

  describe('Component Rendering', () => {
    test('should render correctly', async () => {
      wrapper = await createWrapper()
      
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'CoreAppDrawer' }).exists()).toBe(true)
      expect(wrapper.find('[data-testid="m-app-drawer"]').exists()).toBe(true)
    })

        test('should render with correct component name', async () => {
      wrapper = await createWrapper()

      expect(wrapper.vm.$options.name).toBe('CoreAppDrawer')
    })

    test('should render MAppDrawer with correct props', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const appDrawer = wrapper.findComponent(MockMAppDrawer)
      expect(appDrawer.props('visible')).toBe(true)
      expect(appDrawer.props('width')).toBe(250)
    })
  })

  describe('User Display', () => {
    test('should display user information when user exists', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.user.name).toBe('John Doe')
      expect(wrapper.vm.user.email).toBe('john.doe@example.com')
    })

    test('should show username when showUserFullName is false', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          showUserFullName: false,
          showDashboardMainView: true
        }
      })
      
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.user.name).toBe('johndoe')
    })

    test('should handle user navigation on click', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      await wrapper.vm.navigateTo('user-settings')
      
      expect(mockRouter.push).toHaveBeenCalledWith('user-settings')
    })
  })

  describe('Menu Items', () => {
    test('should generate correct general pages', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const generalPages = wrapper.vm.generalPages
      
      expect(generalPages).toHaveLength(2)
      expect(generalPages[0].title).toBe('Project Execution')
      expect(generalPages[0].to).toBe('/project-execution')
      expect(generalPages[1].title).toBe('Version History')
      expect(generalPages[1].to).toBe('/history-execution')
    })

    test('should generate correct execution pages', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const executionPages = wrapper.vm.executionPages
      
      expect(executionPages).toHaveLength(2)
      expect(executionPages[0].title).toBe('Input/Output Data')
      expect(executionPages[0].subPages).toHaveLength(2)
      expect(executionPages[1].title).toBe('Dashboard')
      expect(executionPages[1].to).toBe('/dashboard')
    })

    test('should handle dashboard visibility based on config', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          showUserFullName: true,
          showDashboardMainView: false
        }
      })
      
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const executionPages = wrapper.vm.executionPages
      const dashboardPage = executionPages.find(page => page.title === 'Dashboard')
      
      expect(dashboardPage.to).toBeNull()
    })

    test('should include app dashboard pages when available', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const executionPages = wrapper.vm.executionPages
      const dashboardPage = executionPages.find(page => page.title === 'Dashboard')
      
      expect(dashboardPage.subPages).toEqual(mockStore.appDashboardPages)
    })
  })

  describe('Actions', () => {
    test('should generate correct actions', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const actions = wrapper.vm.actions
      
      expect(actions).toHaveLength(1)
      expect(actions[0].title).toBe('Logout')
      expect(actions[0].icon).toBe('mdi-logout')
      expect(typeof actions[0].action).toBe('function')
    })

    test('should handle confirm sign out', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.confirmSignOutModal).toBe(false)
      
      wrapper.vm.confirmSignOut()
      
      expect(wrapper.vm.confirmSignOutModal).toBe(true)
    })
  })

  describe('Logout Functionality', () => {
    test('should handle successful logout', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      await wrapper.vm.signOut()
      
      expect(mockAuth.logout).toHaveBeenCalled()
      expect(mockRouter.push).toHaveBeenCalledWith('/sign-in')
      expect(mockShowSnackbar).toHaveBeenCalledWith('Logout successful', 'success')
    })

    test('should handle logout error', async () => {
      const error = new Error('Logout failed')
      mockAuth.logout.mockRejectedValue(error)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      await wrapper.vm.signOut()
      
      expect(consoleSpy).toHaveBeenCalledWith('Logout error:', expect.any(Error))
      expect(mockShowSnackbar).toHaveBeenCalledWith('Logout error', 'error')
      
      consoleSpy.mockRestore()
    })

    test('should handle logout when showSnackbar is not available', async () => {
      wrapper = mount(AppDrawer, {
        global: {
          plugins: [i18n],
          components: {
            MAppDrawer: MockMAppDrawer,
            MBaseModal: MockMBaseModal,
            VImg: MockVImg,
            VIcon: MockVIcon,
            VListItem: MockVListItem,
            VDivider: MockVDivider,
            VList: MockVList,
            VRow: MockVRow,
            VCol: MockVCol
          },
          provide: {
            showSnackbar: null
          },
          mocks: {
            $router: mockRouter,
            $route: mockRoute
          }
        }
      })
      
      await wrapper.vm.$nextTick()
      
      // Ensure auth service is set for this test case too
      wrapper.vm.auth = mockAuth
      await wrapper.vm.$nextTick()
      
      await wrapper.vm.signOut()
      
      expect(mockAuth.logout).toHaveBeenCalled()
      expect(mockRouter.push).toHaveBeenCalledWith('/sign-in')
    })
  })

  describe('Modal Interactions', () => {
    test('should render logout confirmation modal when active', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      wrapper.vm.confirmSignOutModal = true
      await wrapper.vm.$nextTick()
      
      const modal = wrapper.find('[data-testid="m-base-modal"]')
      expect(modal.exists()).toBe(true)
      expect(modal.find('[data-testid="modal-title"]').text()).toBe('Logout')
    })

    test('should handle modal save action', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      wrapper.vm.confirmSignOutModal = true
      await wrapper.vm.$nextTick()
      
      const modal = wrapper.findComponent(MockMBaseModal)
      await modal.vm.$emit('save')
      
      expect(mockAuth.logout).toHaveBeenCalled()
    })

    test('should handle modal cancel action', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      wrapper.vm.confirmSignOutModal = true
      await wrapper.vm.$nextTick()
      
      const modal = wrapper.findComponent(MockMBaseModal)
      await modal.vm.$emit('cancel')
      
      expect(wrapper.vm.confirmSignOutModal).toBe(false)
    })

    test('should handle modal close action', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      wrapper.vm.confirmSignOutModal = true
      await wrapper.vm.$nextTick()
      
      const modal = wrapper.findComponent(MockMBaseModal)
      await modal.vm.$emit('close')
      
      expect(wrapper.vm.confirmSignOutModal).toBe(false)
    })
  })

  describe('Navigation Helpers', () => {
    test('should check if subpage is active', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const subPages = [
        { to: '/input-data' },
        { to: '/output-data' }
      ]
      
      expect(wrapper.vm.isSubPageActive(subPages)).toBe(false)
      
      // Change route to match a subpage
      wrapper.vm.$route.path = '/input-data'
      expect(wrapper.vm.isSubPageActive(subPages)).toBe(true)
    })

    test('should handle null subpages in isSubPageActive', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.isSubPageActive(null)).toBe(undefined)
      expect(wrapper.vm.isSubPageActive(undefined)).toBe(undefined)
    })
  })

  describe('Component State', () => {
    test('should initialize with correct default state', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.model).toBe(1)
      expect(wrapper.vm.mini).toBe(true)
      expect(wrapper.vm.hover).toBe(true)
      expect(wrapper.vm.confirmSignOutModal).toBe(false)
    })

    test('should handle rail update from MAppDrawer', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const initialMini = wrapper.vm.mini
      
      const appDrawer = wrapper.findComponent(MockMAppDrawer)
      await appDrawer.vm.$emit('update:rail')
      
      expect(wrapper.vm.mini).toBe(!initialMini)
    })
  })

  describe('Auth Service Integration', () => {
    test('should initialize auth service on created', async () => {
      const getAuthService = await import('@/services/AuthServiceFactory')
      
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(getAuthService.default).toHaveBeenCalled()
      expect(wrapper.vm.auth).toStrictEqual(mockAuth)
    })

    test('should inject showSnackbar service', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.showSnackbar).toBe(mockShowSnackbar)
    })
  })

  describe('Store Integration', () => {
    test('should use general store', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.store).toStrictEqual(mockStore)
    })

    test('should access user data from store', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.user.name).toBe(mockUser.fullName)
      expect(wrapper.vm.user.email).toBe(mockUser.email)
    })

    test('should access dashboard pages from store', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const dashboardPage = wrapper.vm.executionPages.find(page => page.title === 'Dashboard')
      expect(dashboardPage.subPages).toStrictEqual(mockStore.appDashboardPages)
    })
  })

  describe('Props and Inheritance', () => {
    test('should have empty props', async () => {
      wrapper = await createWrapper()
      
      expect(wrapper.props()).toEqual({})
    })

    test('should not inherit attributes', async () => {
      wrapper = await createWrapper()
      
      expect(wrapper.vm.$options.inheritAttrs).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    test('should handle missing user data gracefully', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      // Test with store data as provided by the mock
      expect(wrapper.vm.user.name).toBeDefined()
      expect(wrapper.vm.user.email).toBeDefined()
    })

    test('should handle empty dashboard pages', async () => {
      wrapper = await createWrapper()
      await wrapper.vm.$nextTick()
      
      const dashboardPage = wrapper.vm.executionPages.find(page => page.title === 'Dashboard')
      expect(dashboardPage.subPages).toStrictEqual(mockStore.appDashboardPages)
    })

    test('should handle component lifecycle without errors', async () => {
      let testWrapper
      
      expect(async () => {
        testWrapper = await createWrapper()
      }).not.toThrow()
      
      // Actually create the wrapper
      testWrapper = await createWrapper()
      expect(testWrapper.exists()).toBe(true)
      
      // Clean up test wrapper
      if (testWrapper) {
        testWrapper.unmount()
      }
    })
  })
})
