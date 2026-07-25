import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import ResetPasswordView from '@cornflow-ui/core/views/ResetPasswordView.vue'

// Mock vue-router: the view reads the reset token from the route query and
// navigates with the router after a successful reset
const mockRoute = vi.hoisted(() => ({
  query: {} as Record<string, string>,
}))
const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}))

// Mock the auth service factory used to reach the cornflow resetPassword
const mockCornflowAuth = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}))

vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(null),
  getSpecificAuthService: vi.fn().mockResolvedValue(mockCornflowAuth),
}))

// Passwords calibrated against the real zxcvbn-backed strength util
const STRONG_PASSWORD = 'Kx9#tR2m!Qw7Zp'
const WEAK_PASSWORD = 'Password123!'

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
  emits: ['update:modelValue'],
}

const createWrapper = (query: Record<string, string> = {}) => {
  const vuetify = createVuetify()

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        resetPassword: {
          title: 'Reset your password',
          missingToken: 'The reset link is missing its token',
          backToLogin: 'Back to login',
          hint: 'Choose a new password',
          newPassword: 'New Password',
          confirmPassword: 'Confirm Password',
          submit: 'Set new password',
          success: 'Password updated successfully',
          linkExpired: 'The reset link is invalid or has expired',
          error: 'Error resetting the password',
        },
        settings: {
          passwordRuleLength: 'Password must be at least {length} characters',
          passwordRuleCharacters:
            'Password must contain uppercase, lowercase, number and special character',
          passWordRuleNoSpace: 'Password cannot contain spaces',
          passwordRuleDigitSequence:
            'Password cannot contain 6 or more consecutive digits',
          passwordRuleStrength: 'Password is too weak',
          passwordRuleNotMatch: 'Passwords do not match',
        },
      },
    },
  })

  mockRoute.query = query

  const mockShowSnackbar = vi.fn()

  const wrapper = mount(ResetPasswordView, {
    global: {
      plugins: [vuetify, i18n],
      provide: {
        showSnackbar: mockShowSnackbar,
      },
      stubs: {
        MInputField: MInputFieldStub,
        'v-card': { template: '<div class="v-card"><slot /></div>' },
        'v-form': {
          template: '<form @submit="$emit(\'submit\', $event)"><slot /></form>',
          emits: ['submit'],
        },
        'v-btn': {
          template:
            '<button class="v-btn" :type="type" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          props: [
            'type',
            'color',
            'rounded',
            'block',
            'disabled',
            'loading',
            'variant',
            'size',
          ],
          emits: ['click'],
        },
      },
    },
  })

  return { wrapper, mockShowSnackbar }
}

describe('ResetPasswordView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCornflowAuth.resetPassword.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Missing token', () => {
    test('shows the missing-token message instead of the form', () => {
      const { wrapper } = createWrapper({})

      expect(wrapper.text()).toContain('The reset link is missing its token')
      expect(wrapper.find('form').exists()).toBe(false)
      expect(wrapper.find('[data-test="reset-submit"]').exists()).toBe(false)
    })

    test('the back button navigates to the sign-in page', async () => {
      const { wrapper } = createWrapper({})

      await wrapper.find('button.v-btn').trigger('click')

      expect(mockRouter.push).toHaveBeenCalledWith('/sign-in')
    })
  })

  describe('With a token', () => {
    test('renders the new password form', () => {
      const { wrapper } = createWrapper({ token: 'reset-token-123' })

      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.find('[data-test="reset-new-password"]').exists()).toBe(
        true,
      )
      expect(
        wrapper.find('[data-test="reset-confirm-password"]').exists(),
      ).toBe(true)
      expect(wrapper.find('[data-test="reset-submit"]').exists()).toBe(true)
    })

    test('the submit button is disabled until the passwords are valid', async () => {
      const { wrapper } = createWrapper({ token: 'reset-token-123' })

      expect(
        wrapper.find('[data-test="reset-submit"]').attributes('disabled'),
      ).toBeDefined()

      const vm = wrapper.vm as any
      vm.newPassword = STRONG_PASSWORD
      vm.confirmPassword = STRONG_PASSWORD
      await wrapper.vm.$nextTick()

      expect(
        wrapper.find('[data-test="reset-submit"]').attributes('disabled'),
      ).toBeUndefined()
    })

    test('submits the new password with the token and redirects on success', async () => {
      mockCornflowAuth.resetPassword.mockResolvedValueOnce({ success: true })
      const { wrapper, mockShowSnackbar } = createWrapper({
        token: 'reset-token-123',
      })

      const vm = wrapper.vm as any
      vm.newPassword = STRONG_PASSWORD
      vm.confirmPassword = STRONG_PASSWORD

      await vm.submit()

      const authServiceFactory = await import(
        '@cornflow-ui/core/services/AuthServiceFactory'
      )
      expect(authServiceFactory.getSpecificAuthService).toHaveBeenCalledWith(
        'cornflow',
      )
      expect(mockCornflowAuth.resetPassword).toHaveBeenCalledWith(
        'reset-token-123',
        STRONG_PASSWORD,
      )
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Password updated successfully',
        'success',
      )
      expect(mockRouter.push).toHaveBeenCalledWith({
        path: '/sign-in',
        query: { changed: 'true' },
      })
    })

    test('shows the link-expired error when the token is rejected', async () => {
      mockCornflowAuth.resetPassword.mockResolvedValueOnce({
        success: false,
        message: 'Invalid token',
        linkInvalid: true,
      })
      const { wrapper, mockShowSnackbar } = createWrapper({
        token: 'used-token',
      })

      const vm = wrapper.vm as any
      vm.newPassword = STRONG_PASSWORD
      vm.confirmPassword = STRONG_PASSWORD

      await vm.submit()

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'The reset link is invalid or has expired',
        'error',
      )
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    test('shows the backend message on other failures', async () => {
      mockCornflowAuth.resetPassword.mockResolvedValueOnce({
        success: false,
        message: 'Password recently used',
        linkInvalid: false,
      })
      const { wrapper, mockShowSnackbar } = createWrapper({
        token: 'reset-token-123',
      })

      const vm = wrapper.vm as any
      vm.newPassword = STRONG_PASSWORD
      vm.confirmPassword = STRONG_PASSWORD

      await vm.submit()

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Password recently used',
        'error',
      )
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    test('falls back to the generic error message when the backend gives none', async () => {
      mockCornflowAuth.resetPassword.mockResolvedValueOnce({
        success: false,
      })
      const { wrapper, mockShowSnackbar } = createWrapper({
        token: 'reset-token-123',
      })

      const vm = wrapper.vm as any
      vm.newPassword = STRONG_PASSWORD
      vm.confirmPassword = STRONG_PASSWORD

      await vm.submit()

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Error resetting the password',
        'error',
      )
    })

    test('shows the generic error when the request throws', async () => {
      mockCornflowAuth.resetPassword.mockRejectedValueOnce(
        new Error('Network error'),
      )
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { wrapper, mockShowSnackbar } = createWrapper({
        token: 'reset-token-123',
      })

      const vm = wrapper.vm as any
      vm.newPassword = STRONG_PASSWORD
      vm.confirmPassword = STRONG_PASSWORD

      await vm.submit()

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Error resetting the password',
        'error',
      )
      expect(vm.submitting).toBe(false)
      consoleSpy.mockRestore()
    })

    test('a weak password keeps the submit disabled and blocks the submission', async () => {
      const { wrapper } = createWrapper({ token: 'reset-token-123' })

      const vm = wrapper.vm as any
      // Meets the character-class rules but is a weak, guessable pattern
      vm.newPassword = WEAK_PASSWORD
      vm.confirmPassword = WEAK_PASSWORD
      await wrapper.vm.$nextTick()

      expect(vm.validPassword).toBe(false)
      expect(
        wrapper.find('[data-test="reset-submit"]').attributes('disabled'),
      ).toBeDefined()

      await vm.submit()

      expect(mockCornflowAuth.resetPassword).not.toHaveBeenCalled()
    })

    test('mismatched passwords are not valid', async () => {
      const { wrapper } = createWrapper({ token: 'reset-token-123' })

      const vm = wrapper.vm as any
      vm.newPassword = STRONG_PASSWORD
      vm.confirmPassword = `${STRONG_PASSWORD}x`
      await wrapper.vm.$nextTick()

      expect(vm.validPassword).toBe(false)

      await vm.submit()

      expect(mockCornflowAuth.resetPassword).not.toHaveBeenCalled()
    })
  })
})
