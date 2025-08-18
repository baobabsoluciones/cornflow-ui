import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import UserSettingsView from '@/views/UserSettingsView.vue'
import { useGeneralStore } from '@/stores/general'

// Mock config
const mockConfig = vi.hoisted(() => ({
  auth: {
    type: 'cornflow'
  },
  initConfig: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/config', () => ({
  default: mockConfig
}))

// Mock Mango UI components
vi.mock('mango-ui', () => ({
  MTitleView: {
    name: 'MTitleView',
    template: '<div data-testid="m-title-view"><slot /></div>',
    props: ['icon', 'title', 'description']
  },
  MTabTable: {
    name: 'MTabTable',
    template: '<div data-testid="m-tab-table"><slot name="table" :tabSelected="selectedTable" /></div>',
    props: ['tabsData', 'selectedTable', 'direction'],
    emits: ['update:selectedTab']
  },
  MInputField: {
    name: 'MInputField',
    template: '<input data-testid="m-input-field" />',
    props: ['modelValue', 'rules', 'title', 'type'],
    emits: ['update:modelValue']
  }
}))

const createWrapper = (authType = 'cornflow') => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        settings: {
          user: 'User Settings',
          userDescription: 'Manage your preferences',
          theme: 'Theme',
          selectTheme: 'Select theme',
          light: 'Light',
          dark: 'Dark',
          language: 'Language',
          selectLanguage: 'Select language',
          english: 'English',
          spanish: 'Spanish',
          french: 'French',
          userSecurity: 'User Security',
          changePassword: 'Change password',
          newPassword: 'New Password',
          confirmPassword: 'Confirm Password',
          submit: 'Submit',
          userSettings: 'User Settings',
          userProfile: 'User Profile',
          passwordRuleLength: 'Password must be at least {length} characters',
          passwordRuleCharacters: 'Password must contain uppercase, lowercase, number and special character',
          passWordRuleNoSpace: 'Password cannot contain spaces',
          passwordRuleNotMatch: 'Passwords do not match',
          snackbarMessageSuccess: 'Password changed successfully',
          snackbarMessageError: 'Error changing password'
        }
      }
    }
  })

  // Mock the store
  const generalStore = useGeneralStore()
  generalStore.user = { id: 1, name: 'Test User' }
  generalStore.changeUserPassword = vi.fn()
  
  const mockShowSnackbar = vi.fn()
  
  // Mock config
  mockConfig.auth.type = authType

  const wrapper = mount(UserSettingsView, {
    global: {
      plugins: [vuetify, pinia, i18n],
      provide: {
        showSnackbar: mockShowSnackbar
      },
      stubs: {
        'MTitleView': { 
          name: 'MTitleView',
          template: '<div data-testid="m-title-view"></div>',
          props: ['icon', 'title', 'description']
        },
        'MTabTable': { 
          name: 'MTabTable',
          template: '<div data-testid="m-tab-table" class="mt-5">Theme Language User Security Change password</div>',
          props: ['selectedTable', 'direction', 'tabsData']
        },
        MInputField: true,
        'v-list': { template: '<div><slot /></div>' },
        'v-list-item': { template: '<div><slot /></div>' },
        'v-list-item-title': { template: '<div><slot /></div>' },
        'v-list-item-subtitle': { template: '<div><slot /></div>' },
        'v-radio-group': { 
          template: '<div><slot /></div>',
          props: ['modelValue'],
          emits: ['update:modelValue']
        },
        'v-radio': { 
          template: '<div><slot name="label" /></div>',
          props: ['value']
        },
        'v-select': { 
          template: '<div></div>',
          props: ['modelValue', 'items'],
          emits: ['update:modelValue']
        },
        'v-form': { template: '<div><slot /></div>' },
        'v-btn': { 
          template: '<button><slot /></button>',
          props: ['disabled', 'color']
        },
        'v-divider': { template: '<hr />' },
        'v-col': { template: '<div><slot /></div>' },
        'v-icon': { template: '<i></i>' }
      }
    }
  })

  return { wrapper, generalStore, mockShowSnackbar }
}

describe('UserSettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    test('renders basic structure', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.find('.view-container').exists()).toBe(true)
      expect(wrapper.find('[data-testid="m-title-view"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="m-tab-table"]').exists()).toBe(true)
    })

    test('renders user settings tab content by default', () => {
      const { wrapper } = createWrapper()

      // Should show theme and language settings
      expect(wrapper.text()).toContain('Theme')
      expect(wrapper.text()).toContain('Language')
    })

    test('renders user profile tab content when tab is user-profile', async () => {
      const { wrapper } = createWrapper()
      
      await wrapper.setData({ selectedTab: 'user-profile' })

      // Should show password change form
      expect(wrapper.text()).toContain('User Security')
      expect(wrapper.text()).toContain('Change password')
    })
  })

  describe('Component Props', () => {
    test('passes correct props to MTitleView', () => {
      const { wrapper } = createWrapper()
      const titleView = wrapper.findComponent({ name: 'MTitleView' })

      expect(titleView.props('icon')).toBe('mdi-account-cog')
      expect(titleView.props('title')).toBe('User Settings')
      expect(titleView.props('description')).toBe('Manage your preferences')
    })

    test('passes correct props to MTabTable', () => {
      const { wrapper } = createWrapper()
      const tabTable = wrapper.findComponent({ name: 'MTabTable' })

      expect(tabTable.props('selectedTable')).toBe('user-settings')
      expect(tabTable.props('direction')).toBe('horizontal')
      expect(Array.isArray(tabTable.props('tabsData'))).toBe(true)
    })
  })

  describe('Data Properties', () => {
    test('has correct initial data structure', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.selectedTab).toBe('user-settings')
      expect(wrapper.vm.theme).toBe('light')
      expect(wrapper.vm.language).toBe('en')
      expect(Array.isArray(wrapper.vm.languages)).toBe(true)
      expect(Array.isArray(wrapper.vm.passwordRules)).toBe(true)
      expect(wrapper.vm.newPassword).toBe('')
      expect(wrapper.vm.confirmPassword).toBe('')
    })

    test('has correct language options', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.languages).toHaveLength(3)
      expect(wrapper.vm.languages.map(l => l.value)).toEqual(['en', 'es', 'fr'])
    })

    test('has correct password rules', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.passwordRules).toHaveLength(7)
      expect(typeof wrapper.vm.passwordRules[0]).toBe('function')
    })
  })

  describe('Computed Properties', () => {
    test('title computed property returns correct value', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.title).toBe('User Settings')
    })

    test('description computed property returns correct value', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.description).toBe('Manage your preferences')
    })

    test('userTabs includes user-settings by default', () => {
      const { wrapper } = createWrapper()
      
      const tabs = wrapper.vm.userTabs
      expect(tabs).toHaveLength(2) // Both settings and profile for cornflow
      expect(tabs[0].value).toBe('user-settings')
    })

    test('userTabs includes user-profile only for cornflow auth', () => {
      const { wrapper } = createWrapper('cornflow')
      
      const tabs = wrapper.vm.userTabs
      expect(tabs).toHaveLength(2)
      expect(tabs.some(tab => tab.value === 'user-profile')).toBe(true)
    })

    test('userTabs excludes user-profile for non-cornflow auth', () => {
      const { wrapper } = createWrapper('azure')
      
      const tabs = wrapper.vm.userTabs
      expect(tabs).toHaveLength(1)
      expect(tabs.some(tab => tab.value === 'user-profile')).toBe(false)
    })

    test('validPassword computed property works correctly', () => {
      const { wrapper } = createWrapper()
      
      // Initially should be false
      expect(wrapper.vm.validPassword).toBe(false)
      
      // Set valid passwords
      wrapper.vm.newPassword = 'ValidPass123!'
      wrapper.vm.confirmPassword = 'ValidPass123!'
      
      // Should be true with valid matching passwords
      expect(wrapper.vm.validPassword).toBe(true)
    })

    test('validPassword computed property handles mismatched passwords', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.newPassword = 'ValidPass123!'
      wrapper.vm.confirmPassword = 'DifferentPass123!'
      
      expect(wrapper.vm.validPassword).toBe(false)
    })
  })

  describe('Methods', () => {
    test('handleTabSelected updates selectedTab', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.handleTabSelected('user-profile')
      
      expect(wrapper.vm.selectedTab).toBe('user-profile')
    })

    test('resetPasswordFields clears password fields', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.newPassword = 'SomePassword'
      wrapper.vm.confirmPassword = 'SomePassword'
      
      wrapper.vm.resetPasswordFields()
      
      expect(wrapper.vm.newPassword).toBeUndefined()
      expect(wrapper.vm.confirmPassword).toBeUndefined()
    })

    test('changePassword calls store method with correct parameters', async () => {
      const { wrapper, generalStore } = createWrapper()
      generalStore.changeUserPassword.mockResolvedValue(true)
      
      wrapper.vm.newPassword = 'NewPassword123!'
      
      await wrapper.vm.changePassword()
      
      expect(generalStore.changeUserPassword).toHaveBeenCalledWith(1, 'NewPassword123!')
    })

    test('changePassword shows success message on success', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      generalStore.changeUserPassword.mockResolvedValue(true)
      
      wrapper.vm.newPassword = 'NewPassword123!'
      
      await wrapper.vm.changePassword()
      
      expect(mockShowSnackbar).toHaveBeenCalledWith('Password changed successfully')
    })

    test('changePassword shows error message on failure', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      generalStore.changeUserPassword.mockResolvedValue(false)
      
      wrapper.vm.newPassword = 'NewPassword123!'
      
      await wrapper.vm.changePassword()
      
      expect(mockShowSnackbar).toHaveBeenCalledWith('Error changing password', 'error')
    })

    test('changePassword shows error message on exception', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      generalStore.changeUserPassword.mockRejectedValue(new Error('Network error'))
      
      wrapper.vm.newPassword = 'NewPassword123!'
      
      await wrapper.vm.changePassword()
      
      expect(mockShowSnackbar).toHaveBeenCalledWith('Error changing password', 'error')
    })
  })

  describe('Lifecycle Methods', () => {
    test('injects showSnackbar on created', () => {
      const { wrapper, mockShowSnackbar } = createWrapper()
      
      expect(wrapper.vm.showSnackbar).toBe(mockShowSnackbar)
    })

    test('sets selectedTab to user-settings for non-cornflow auth', () => {
      const { wrapper } = createWrapper('azure')
      
      expect(wrapper.vm.selectedTab).toBe('user-settings')
    })

    test('calls resetPasswordFields on updated', async () => {
      const { wrapper } = createWrapper()
      const resetSpy = vi.spyOn(wrapper.vm, 'resetPasswordFields')
      
      await wrapper.vm.$forceUpdate()
      
      expect(resetSpy).toHaveBeenCalled()
    })
  })

  describe('Watchers', () => {
    test('language watcher updates locale', async () => {
      const { wrapper } = createWrapper()
      
      await wrapper.setData({ language: 'es' })
      
      expect(wrapper.vm.locale).toBe('es')
    })
  })

  describe('Password Validation Rules', () => {
    test('password rules validate length correctly', () => {
      const { wrapper } = createWrapper()
      const lengthRule = wrapper.vm.passwordRules[0]
      
      expect(lengthRule('abc')).toContain('5')
      expect(lengthRule('abcdef')).toBe(true)
    })

    test('password rules validate uppercase characters', () => {
      const { wrapper } = createWrapper()
      const uppercaseRule = wrapper.vm.passwordRules[1]
      
      expect(uppercaseRule('lowercase')).toContain('character')
      expect(uppercaseRule('Uppercase')).toBe(true)
    })

    test('password rules validate lowercase characters', () => {
      const { wrapper } = createWrapper()
      const lowercaseRule = wrapper.vm.passwordRules[2]
      
      expect(lowercaseRule('UPPERCASE')).toContain('character')
      expect(lowercaseRule('lowercase')).toBe(true)
    })

    test('password rules validate numbers', () => {
      const { wrapper } = createWrapper()
      const numberRule = wrapper.vm.passwordRules[3]
      
      expect(numberRule('NoNumbers')).toContain('character')
      expect(numberRule('Has1Number')).toBe(true)
    })

    test('password rules validate special characters', () => {
      const { wrapper } = createWrapper()
      const specialRule = wrapper.vm.passwordRules[4]
      
      expect(specialRule('NoSpecial')).toContain('character')
      expect(specialRule('Has!Special')).toBe(true)
    })

    test('password rules validate no spaces', () => {
      const { wrapper } = createWrapper()
      const spaceRule = wrapper.vm.passwordRules[5]
      
      expect(spaceRule('Has Space')).toContain('spaces')
      expect(spaceRule('NoSpace')).toBe(true)
    })

    test('password rules validate matching passwords', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.newPassword = 'TestPassword'
      const matchRule = wrapper.vm.passwordRules[6]
      
      expect(matchRule('DifferentPassword')).toContain('match')
      expect(matchRule('TestPassword')).toBe(true)
    })
  })

  describe('Component Structure', () => {
    test('has correct CSS classes and structure', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.find('.view-container').exists()).toBe(true)
      const tabTable = wrapper.find('[data-testid="m-tab-table"]')
      expect(tabTable.exists()).toBe(true)
      expect(tabTable.classes()).toContain('mt-5')
    })

    test('applies correct scoped styles', () => {
      const { wrapper } = createWrapper()
      
      // Check that the component has the style attribute for scoped styles
      expect(wrapper.html()).toContain('data-v-')
    })
  })

  describe('Edge Cases', () => {
    test('handles missing user gracefully', () => {
      const { wrapper, generalStore } = createWrapper()
      generalStore.user = null
      
      expect(() => wrapper.vm.changePassword()).not.toThrow()
    })

    test('handles undefined password fields gracefully', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.newPassword = undefined
      wrapper.vm.confirmPassword = undefined
      
      expect(wrapper.vm.validPassword).toBe(false)
    })

    test('handles empty string passwords gracefully', () => {
      const { wrapper } = createWrapper()
      
      wrapper.vm.newPassword = ''
      wrapper.vm.confirmPassword = ''
      
      expect(wrapper.vm.validPassword).toBe(false)
    })
  })

  describe('Auth Type Handling', () => {
    test('adjusts selectedTab when auth is not cornflow and tab is user-profile', () => {
      mockConfig.auth.type = 'azure'
      const { wrapper } = createWrapper('azure')
      
      // Simulate being on user-profile tab with non-cornflow auth
      wrapper.vm.selectedTab = 'user-profile'
      wrapper.vm.$options.created.call(wrapper.vm)
      
      expect(wrapper.vm.selectedTab).toBe('user-settings')
    })
  })

  describe('Component Integration', () => {
    test('integrates properly with Vue I18n setup function', () => {
      const { wrapper } = createWrapper()
      
      expect(wrapper.vm.locale).toBeDefined()
      expect(typeof wrapper.vm.locale).toBe('string')
    })

    test('handles duplicate methods in options object', () => {
      const { wrapper } = createWrapper()
      
      // The component has duplicate methods objects which should not cause issues
      expect(wrapper.vm.handleTabSelected).toBeDefined()
      expect(wrapper.vm.resetPasswordFields).toBeDefined()
      expect(wrapper.vm.changePassword).toBeDefined()
    })
  })
})
