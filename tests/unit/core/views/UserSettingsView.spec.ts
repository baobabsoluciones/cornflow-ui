import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import UserSettingsView from '@cornflow-ui/core/views/UserSettingsView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

const mockChangeLanguage = vi.hoisted(() => vi.fn())

vi.mock('@cornflow-ui/core/plugins/i18n', () => ({
  default: {
    global: {
      locale: { value: 'en' },
    },
  },
  changeLanguage: mockChangeLanguage,
  locale: { value: 'en' },
}))

// Mock config
const mockConfig = vi.hoisted(() => ({
  auth: {
    type: 'cornflow'
  },
  initConfig: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@cornflow-ui/core/config', () => ({
  default: mockConfig
}))

// Mock the app config (used for the personal API key feature flag). The
// component reads `appConfig.getCore().parameters.enablePersonalTokens`.
// The real config has no such flag, so we override only getCore's parameters
// while delegating every other method (getDashboardRoutes, etc., used by the
// general store) to the real singleton.
const mockAppConfig = vi.hoisted(() => ({
  enablePersonalTokens: true as boolean | undefined
}))
vi.mock('@/app/config', async () => {
  const actual = (await vi.importActual('@/app/config')) as any
  const realDefault = actual.default
  return {
    ...actual,
    default: new Proxy(realDefault, {
      get(target, prop, receiver) {
        if (prop === 'getCore') {
          return () => {
            const core = target.getCore()
            return {
              ...core,
              parameters: {
                ...core.parameters,
                enablePersonalTokens: mockAppConfig.enablePersonalTokens
              }
            }
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      }
    })
  }
})

// Mock the qrcode library used to render the MFA enrollment QR
const mockQRCodeToDataURL = vi.hoisted(() =>
  vi.fn().mockResolvedValue('data:image/png;base64,mock-qr'),
)
vi.mock('qrcode', () => ({
  default: { toDataURL: mockQRCodeToDataURL },
}))

// Mock the cornflow auth service used for MFA enrollment (setup / verify)
const mockCornflowAuth = vi.hoisted(() => ({
  mfaSetup: vi.fn(),
  mfaVerify: vi.fn(),
  createApiKey: vi.fn(),
}))
vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(mockCornflowAuth),
  getAllAuthServices: vi.fn().mockResolvedValue({ cornflow: mockCornflowAuth }),
  getSpecificAuthService: vi.fn().mockResolvedValue(mockCornflowAuth),
  isAuthServiceAvailable: vi.fn().mockReturnValue(true),
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
          currentPassword: 'Current Password',
          newPassword: 'New Password',
          confirmPassword: 'Confirm Password',
          submit: 'Submit',
          userSettings: 'User Settings',
          userProfile: 'User Profile',
          passwordRuleLength: 'Password must be at least {length} characters',
          passwordRuleCharacters: 'Password must contain uppercase, lowercase, number and special character',
          passWordRuleNoSpace: 'Password cannot contain spaces',
          passwordRuleDigitSequence: 'Password cannot contain 6 or more consecutive digits',
          passwordRuleStrength: 'Password is too weak',
          passwordRuleNotMatch: 'Passwords do not match',
          passwordChangeForced: 'Your password must be changed before continuing',
          snackbarMessageSuccess: 'Password changed successfully',
          snackbarMessageSuccessRelogin:
            'Password changed successfully. Please log in again.',
          snackbarMessageError: 'Error changing password',
          mfaTitle: 'Two-factor authentication',
          mfaResetDescription: 'Reset your two-factor authentication',
          mfaResetButton: 'Reset MFA',
          mfaResetConfirm: 'Are you sure you want to reset your MFA?',
          mfaResetSuccess: 'MFA reset successfully',
          mfaResetError: 'Error resetting MFA',
          mfaEnableButton: 'Enable 2FA',
          mfaEnableDescription: 'Add an extra layer of security',
          mfaEnrollHint: 'Scan the QR code with your authenticator app',
          mfaEnrollSecret: 'Or enter this secret manually:',
          mfaCodeLabel: 'Verification code',
          mfaVerifyButton: 'Verify',
          mfaInvalidCode: 'Invalid code',
          mfaEnrollError: 'Could not start the enrollment',
          mfaBackupHint: 'Store these backup codes safely',
          mfaBackupContinue: 'Continue',
          mfaEnableSuccess: 'Two-factor authentication enabled',
          apiKeyTitle: 'Personal API key',
          apiKeyDescription: 'Generate a personal API key for programmatic access',
          apiKeyGenerateButton: 'Generate API key',
          apiKeyOnceWarning: 'Copy this key now, it will not be shown again',
          apiKeyCopy: 'Copy',
          apiKeyCopied: 'API key copied to clipboard',
          apiKeySuccess: 'API key generated successfully',
          apiKeyError: 'Error generating the API key',
          apiKeyDisabled: 'Personal API keys are disabled for this deployment',
          cancel: 'Cancel'
        }
      }
    }
  })

  mockChangeLanguage.mockClear()

  // Mock the store
  const generalStore = useGeneralStore()
  generalStore.user = { id: 1, name: 'Test User' }
  generalStore.changeUserPassword = vi.fn()
  generalStore.resetUserMfa = vi.fn()
  
  const mockShowSnackbar = vi.fn()
  const mockRouter = { push: vi.fn() }

  // Mock config
  mockConfig.auth.type = authType

  const wrapper = mount(UserSettingsView, {
    global: {
      plugins: [vuetify, pinia, i18n],
      provide: {
        showSnackbar: mockShowSnackbar
      },
      mocks: {
        $router: mockRouter,
        $route: { query: {} }
      },
      stubs: {
        'MTitleView': { 
          name: 'MTitleView',
          template: '<div data-testid="m-title-view"></div>',
          props: ['icon', 'title', 'description']
        },
        'MTabTable': {
          name: 'MTabTable',
          template: '<div data-testid="m-tab-table" class="mt-5"><slot name="table" :tabSelected="selectedTable" /></div>',
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
        'v-icon': { template: '<i></i>' },
        'v-alert': { template: '<div class="v-alert"><slot /></div>' }
      }
    }
  })

  return { wrapper, generalStore, mockShowSnackbar, mockRouter, i18n }
}

describe('UserSettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the personal-token feature flag to its default (enabled)
    mockAppConfig.enablePersonalTokens = true
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
      expect(wrapper.vm.currentPassword).toBe('')
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
      
      expect(wrapper.vm.passwordRules).toHaveLength(9)
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

    test('passwordChangeForced is false by default', () => {
      const { wrapper } = createWrapper()

      expect(wrapper.vm.passwordChangeForced).toBe(false)
    })

    test('passwordChangeForced is true when pwdChangeRequired is set and opens the profile tab', () => {
      sessionStorage.setItem('pwdChangeRequired', 'true')
      try {
        const { wrapper } = createWrapper()

        expect(wrapper.vm.passwordChangeForced).toBe(true)
        expect(wrapper.vm.selectedTab).toBe('user-profile')
      } finally {
        sessionStorage.removeItem('pwdChangeRequired')
      }
    })

    test('validPassword computed property works correctly', () => {
      const { wrapper } = createWrapper()

      // Initially should be false
      expect(wrapper.vm.validPassword).toBe(false)

      // Set the current password and valid new passwords (12+ chars, strong)
      wrapper.vm.currentPassword = 'OldPassword123!'
      wrapper.vm.newPassword = 'Kx9#tR2m!Qw7Zp'
      wrapper.vm.confirmPassword = 'Kx9#tR2m!Qw7Zp'

      // Should be true with valid matching passwords
      expect(wrapper.vm.validPassword).toBe(true)
    })

    test('validPassword requires the current password to be filled', () => {
      const { wrapper } = createWrapper()

      wrapper.vm.currentPassword = ''
      wrapper.vm.newPassword = 'Kx9#tR2m!Qw7Zp'
      wrapper.vm.confirmPassword = 'Kx9#tR2m!Qw7Zp'

      expect(wrapper.vm.validPassword).toBe(false)
    })

    test('validPassword rejects passwords shorter than 12 characters', () => {
      const { wrapper } = createWrapper()

      wrapper.vm.currentPassword = 'OldPassword123!'
      wrapper.vm.newPassword = 'Val1dPas!'
      wrapper.vm.confirmPassword = 'Val1dPas!'

      expect(wrapper.vm.validPassword).toBe(false)
    })

    test('validPassword rejects weak passwords', () => {
      const { wrapper } = createWrapper()

      wrapper.vm.currentPassword = 'OldPassword123!'
      // Meets the character-class rules but is a weak, guessable pattern
      wrapper.vm.newPassword = 'Password123!'
      wrapper.vm.confirmPassword = 'Password123!'

      expect(wrapper.vm.validPassword).toBe(false)
    })

    test('validPassword computed property handles mismatched passwords', () => {
      const { wrapper } = createWrapper()

      wrapper.vm.currentPassword = 'OldPassword123!'
      wrapper.vm.newPassword = 'Kx9#tR2m!Qw7Zp'
      wrapper.vm.confirmPassword = 'Kx9#tR2m!Qw7Zq'

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

      wrapper.vm.currentPassword = 'OldPassword'
      wrapper.vm.newPassword = 'SomePassword'
      wrapper.vm.confirmPassword = 'SomePassword'

      wrapper.vm.resetPasswordFields()

      expect(wrapper.vm.currentPassword).toBeUndefined()
      expect(wrapper.vm.newPassword).toBeUndefined()
      expect(wrapper.vm.confirmPassword).toBeUndefined()
    })

    test('changePassword calls store method with correct parameters', async () => {
      const { wrapper, generalStore } = createWrapper()
      generalStore.changeUserPassword.mockResolvedValue({ success: true })

      wrapper.vm.currentPassword = 'OldPassword123!'
      wrapper.vm.newPassword = 'Kx9#tR2m!Qw7Zp'

      await wrapper.vm.changePassword()

      expect(generalStore.changeUserPassword).toHaveBeenCalledWith(
        1,
        'Kx9#tR2m!Qw7Zp',
        'OldPassword123!',
      )
    })

    test('changePassword logs the user out to sign in again on success', async () => {
      const { wrapper, generalStore, mockShowSnackbar, mockRouter } =
        createWrapper()
      generalStore.changeUserPassword.mockResolvedValue({ success: true })

      wrapper.vm.currentPassword = 'OldPassword123!'
      wrapper.vm.newPassword = 'Kx9#tR2m!Qw7Zp'

      await wrapper.vm.changePassword()

      // The password change revokes the session server-side, so the view
      // logs out and sends the user to the sign-in page
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Password changed successfully. Please log in again.',
      )
      expect(mockRouter.push).toHaveBeenCalledWith({
        path: '/sign-in',
        query: { changed: 'true' },
      })
      expect(sessionStorage.getItem('isAuthenticated')).toBe('false')
    })

    test('changePassword shows error message on failure', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      generalStore.changeUserPassword.mockResolvedValue({ success: false })

      wrapper.vm.currentPassword = 'OldPassword123!'
      wrapper.vm.newPassword = 'Kx9#tR2m!Qw7Zp'

      await wrapper.vm.changePassword()

      expect(mockShowSnackbar).toHaveBeenCalledWith('Error changing password', 'error')
    })

    test('changePassword shows the backend message on failure when present', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      generalStore.changeUserPassword.mockResolvedValue({
        success: false,
        message: 'Invalid current password',
      })

      wrapper.vm.currentPassword = 'WrongPassword!'
      wrapper.vm.newPassword = 'Kx9#tR2m!Qw7Zp'

      await wrapper.vm.changePassword()

      expect(mockShowSnackbar).toHaveBeenCalledWith('Invalid current password', 'error')
    })

    test('changePassword shows error message on exception', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      generalStore.changeUserPassword.mockRejectedValue(new Error('Network error'))

      wrapper.vm.currentPassword = 'OldPassword123!'
      wrapper.vm.newPassword = 'Kx9#tR2m!Qw7Zp'

      await wrapper.vm.changePassword()

      expect(mockShowSnackbar).toHaveBeenCalledWith('Error changing password', 'error')
    })

    test('resetMfa asks for confirmation and shows success message', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      generalStore.resetUserMfa.mockResolvedValue(true)
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      await wrapper.vm.resetMfa()

      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to reset your MFA?')
      expect(generalStore.resetUserMfa).toHaveBeenCalledWith(1)
      expect(mockShowSnackbar).toHaveBeenCalledWith('MFA reset successfully')
      confirmSpy.mockRestore()
    })

    test('resetMfa does nothing when the confirmation is cancelled', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      await wrapper.vm.resetMfa()

      expect(generalStore.resetUserMfa).not.toHaveBeenCalled()
      expect(mockShowSnackbar).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })

    test('resetMfa shows error message on failure', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      generalStore.resetUserMfa.mockResolvedValue(false)
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      await wrapper.vm.resetMfa()

      expect(mockShowSnackbar).toHaveBeenCalledWith('Error resetting MFA', 'error')
      confirmSpy.mockRestore()
    })

    test('resetMfa clears the local mfaEnabled flag on success', async () => {
      const { wrapper, generalStore } = createWrapper()
      generalStore.user = { id: 1, name: 'Test User', mfaEnabled: true }
      generalStore.resetUserMfa.mockResolvedValue(true)
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      await wrapper.vm.resetMfa()

      expect(generalStore.getUser.mfaEnabled).toBe(false)
      confirmSpy.mockRestore()
    })
  })

  describe('MFA enrollment (opt-in)', () => {
    test('mfaEnabled computed reflects the store user flag', () => {
      const { wrapper, generalStore } = createWrapper()
      expect(wrapper.vm.mfaEnabled).toBe(false)
      generalStore.user = { id: 1, name: 'Test User', mfaEnabled: true }
      expect(wrapper.vm.mfaEnabled).toBe(true)
    })

    test('shows the enable button when MFA is not enabled', async () => {
      const { wrapper } = createWrapper()
      await wrapper.setData({ selectedTab: 'user-profile' })
      expect(wrapper.find('[data-test="mfa-enable-button"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="mfa-reset-button"]').exists()).toBe(false)
    })

    test('shows the reset button when the user already has MFA enabled', async () => {
      const { wrapper, generalStore } = createWrapper()
      generalStore.user = { id: 1, name: 'Test User', mfaEnabled: true }
      await wrapper.setData({ selectedTab: 'user-profile' })
      expect(wrapper.find('[data-test="mfa-reset-button"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="mfa-enable-button"]').exists()).toBe(false)
    })

    test('startMfaEnroll fetches the setup data and renders the QR step', async () => {
      const { wrapper } = createWrapper()
      mockCornflowAuth.mfaSetup.mockResolvedValueOnce({
        secret: 'BASE32SECRET',
        provisioningUri: 'otpauth://totp/app:user?secret=BASE32SECRET',
      })

      await wrapper.vm.startMfaEnroll()

      expect(mockCornflowAuth.mfaSetup).toHaveBeenCalled()
      expect(wrapper.vm.mfaSecret).toBe('BASE32SECRET')
      expect(mockQRCodeToDataURL).toHaveBeenCalledWith(
        'otpauth://totp/app:user?secret=BASE32SECRET',
        expect.any(Object),
      )
      expect(wrapper.vm.mfaQrDataUrl).toBe('data:image/png;base64,mock-qr')
      expect(wrapper.vm.mfaStep).toBe('qr')
    })

    test('startMfaEnroll shows an error when the setup data is missing', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper()
      mockCornflowAuth.mfaSetup.mockResolvedValueOnce(null)

      await wrapper.vm.startMfaEnroll()

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Could not start the enrollment',
        'error',
      )
      expect(wrapper.vm.mfaStep).toBe('idle')
    })

    test('completes the enable flow: start -> verify -> finish sets mfaEnabled true', async () => {
      const { wrapper, generalStore, mockShowSnackbar } = createWrapper()
      mockCornflowAuth.mfaSetup.mockResolvedValueOnce({
        secret: 'S',
        provisioningUri: 'otpauth://totp/x',
      })
      mockCornflowAuth.mfaVerify.mockResolvedValueOnce({
        backupCodes: ['aaaa-bbbb', 'cccc-dddd'],
      })

      await wrapper.vm.startMfaEnroll()
      expect(wrapper.vm.mfaStep).toBe('qr')

      wrapper.vm.mfaCode = '123456'
      await wrapper.vm.verifyMfaEnroll()

      expect(mockCornflowAuth.mfaVerify).toHaveBeenCalledWith('123456')
      expect(wrapper.vm.mfaBackupCodes).toEqual(['aaaa-bbbb', 'cccc-dddd'])
      expect(wrapper.vm.mfaStep).toBe('backup')

      wrapper.vm.finishMfaEnroll()

      expect(generalStore.getUser.mfaEnabled).toBe(true)
      expect(wrapper.vm.mfaStep).toBe('idle')
      expect(wrapper.vm.mfaSecret).toBe('')
      expect(wrapper.vm.mfaBackupCodes).toEqual([])
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Two-factor authentication enabled',
      )
    })

    test('verifyMfaEnroll does nothing without a code', async () => {
      const { wrapper } = createWrapper()
      wrapper.vm.mfaStep = 'qr'
      wrapper.vm.mfaCode = ''

      await wrapper.vm.verifyMfaEnroll()

      expect(mockCornflowAuth.mfaVerify).not.toHaveBeenCalled()
      expect(wrapper.vm.mfaStep).toBe('qr')
    })

    test('verifyMfaEnroll shows an error when the code is rejected', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper()
      mockCornflowAuth.mfaVerify.mockResolvedValueOnce(null)
      wrapper.vm.mfaStep = 'qr'
      wrapper.vm.mfaCode = '000000'

      await wrapper.vm.verifyMfaEnroll()

      expect(mockShowSnackbar).toHaveBeenCalledWith('Invalid code', 'error')
      expect(wrapper.vm.mfaStep).toBe('qr')
    })

    test('cancelMfaEnroll resets the enrollment state', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.mfaStep = 'qr'
      wrapper.vm.mfaSecret = 'S'
      wrapper.vm.mfaQrDataUrl = 'data:image/png;base64,mock-qr'
      wrapper.vm.mfaCode = '123'

      wrapper.vm.cancelMfaEnroll()

      expect(wrapper.vm.mfaStep).toBe('idle')
      expect(wrapper.vm.mfaSecret).toBe('')
      expect(wrapper.vm.mfaQrDataUrl).toBe('')
      expect(wrapper.vm.mfaCode).toBe('')
    })
  })

  describe('Personal API key', () => {
    test('personalTokenEnabled is true for cornflow auth with the flag enabled', () => {
      const { wrapper } = createWrapper('cornflow')
      expect(wrapper.vm.personalTokenEnabled).toBe(true)
    })

    test('personalTokenEnabled is false for non-cornflow auth', () => {
      const { wrapper } = createWrapper('azure')
      expect(wrapper.vm.personalTokenEnabled).toBe(false)
    })

    test('personalTokenEnabled is false when the deployment disables the flag', () => {
      mockAppConfig.enablePersonalTokens = false
      const { wrapper } = createWrapper('cornflow')
      expect(wrapper.vm.personalTokenEnabled).toBe(false)
    })

    test('shows the generate button when the feature is enabled', async () => {
      const { wrapper } = createWrapper('cornflow')
      await wrapper.setData({ selectedTab: 'user-profile' })
      expect(
        wrapper.find('[data-test="api-key-generate-button"]').exists(),
      ).toBe(true)
    })

    test('hides the section when the feature is disabled', async () => {
      mockAppConfig.enablePersonalTokens = false
      const { wrapper } = createWrapper('cornflow')
      await wrapper.setData({ selectedTab: 'user-profile' })
      expect(
        wrapper.find('[data-test="api-key-generate-button"]').exists(),
      ).toBe(false)
    })

    test('shows the TOTP input only when MFA is enabled', async () => {
      const { wrapper, generalStore } = createWrapper('cornflow')
      generalStore.user = { id: 1, name: 'Test User', mfaEnabled: true }
      await wrapper.setData({ selectedTab: 'user-profile' })
      expect(wrapper.find('[data-test="api-key-totp"]').exists()).toBe(true)
    })

    test('generateApiKey stores the key and shows the success snackbar', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper('cornflow')
      mockCornflowAuth.createApiKey.mockResolvedValueOnce({
        success: true,
        apiKey: 'the-generated-key',
      })

      await wrapper.vm.generateApiKey()

      expect(mockCornflowAuth.createApiKey).toHaveBeenCalledWith(undefined)
      expect(wrapper.vm.apiKey).toBe('the-generated-key')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'API key generated successfully',
      )
    })

    test('generateApiKey passes the TOTP code through when provided', async () => {
      const { wrapper } = createWrapper('cornflow')
      mockCornflowAuth.createApiKey.mockResolvedValueOnce({
        success: true,
        apiKey: 'the-generated-key',
      })

      wrapper.vm.apiKeyTotp = '123456'
      await wrapper.vm.generateApiKey()

      expect(mockCornflowAuth.createApiKey).toHaveBeenCalledWith('123456')
      // The TOTP field is cleared after a successful generation
      expect(wrapper.vm.apiKeyTotp).toBe('')
    })

    test('generateApiKey shows the disabled error when the feature is off server-side', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper('cornflow')
      mockCornflowAuth.createApiKey.mockResolvedValueOnce({
        success: false,
        disabled: true,
        message: 'Personal tokens are disabled',
      })

      await wrapper.vm.generateApiKey()

      expect(wrapper.vm.apiKey).toBe('')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Personal API keys are disabled for this deployment',
        'error',
      )
    })

    test('generateApiKey shows the backend message on failure', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper('cornflow')
      mockCornflowAuth.createApiKey.mockResolvedValueOnce({
        success: false,
        disabled: false,
        message: 'A valid TOTP code is required',
      })

      await wrapper.vm.generateApiKey()

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'A valid TOTP code is required',
        'error',
      )
    })

    test('generateApiKey falls back to the generic error message', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper('cornflow')
      mockCornflowAuth.createApiKey.mockResolvedValueOnce({
        success: false,
        disabled: false,
      })

      await wrapper.vm.generateApiKey()

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Error generating the API key',
        'error',
      )
    })

    test('generateApiKey shows the generic error on exception', async () => {
      const { wrapper, mockShowSnackbar } = createWrapper('cornflow')
      mockCornflowAuth.createApiKey.mockRejectedValueOnce(
        new Error('Network error'),
      )

      await wrapper.vm.generateApiKey()

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Error generating the API key',
        'error',
      )
    })

    test('copyApiKey writes the key to the clipboard and confirms', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { clipboard: { writeText } })

      const { wrapper, mockShowSnackbar } = createWrapper('cornflow')
      wrapper.vm.apiKey = 'the-generated-key'

      await wrapper.vm.copyApiKey()

      expect(writeText).toHaveBeenCalledWith('the-generated-key')
      expect(mockShowSnackbar).toHaveBeenCalledWith('API key copied to clipboard')
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
      const { wrapper, i18n } = createWrapper()
      const languageWatcher = wrapper.vm.$options.watch?.language
      const handler =
        typeof languageWatcher === 'function'
          ? languageWatcher
          : languageWatcher?.handler

      handler.call(wrapper.vm, 'es', 'en')
      await wrapper.vm.$nextTick()

      expect(mockChangeLanguage).toHaveBeenCalledWith('es')
      expect(i18n.global.locale.value).toBe('es')
    })
  })

  describe('Password Validation Rules', () => {
    test('password rules validate length correctly', () => {
      const { wrapper } = createWrapper()
      const lengthRule = wrapper.vm.passwordRules[0]

      expect(lengthRule('abc')).toContain('12')
      expect(lengthRule('abcdefghijk')).toContain('12')
      expect(lengthRule('abcdefghijkl')).toBe(true)
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

    test('password rules validate no long digit sequences', () => {
      const { wrapper } = createWrapper()
      const digitSequenceRule = wrapper.vm.passwordRules[6]

      expect(digitSequenceRule('Abc123456!xx')).toContain('consecutive digits')
      expect(digitSequenceRule('Abc12345!xxx')).toBe(true)
    })

    test('password rules validate zxcvbn strength', () => {
      const { wrapper } = createWrapper()
      const strengthRule = wrapper.vm.passwordRules[7]

      expect(strengthRule('Password123!')).toContain('weak')
      expect(strengthRule('Kx9#tR2m!Qw7Zp')).toBe(true)
      // Empty values are left to the length/required rules
      expect(strengthRule('')).toBe(true)
      expect(strengthRule(undefined)).toBe(true)
    })

    test('password rules validate matching passwords', () => {
      const { wrapper } = createWrapper()
      wrapper.vm.newPassword = 'TestPassword'
      const matchRule = wrapper.vm.passwordRules[8]

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
