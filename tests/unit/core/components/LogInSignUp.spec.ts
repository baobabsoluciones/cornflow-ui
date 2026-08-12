import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'

const mockConfig = vi.hoisted(() => ({ auth: { type: 'cornflow' } }))

const store = vi.hoisted(() => ({
  appConfig: { parameters: { enableSignup: true } },
}))

const auth = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}))

const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }))

vi.mock('@cornflow-ui/core/config', () => ({ default: mockConfig }))

vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => store,
}))

vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(auth),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.value }),
}))

import LogInSignUp from '@cornflow-ui/core/components/LogInSignUp.vue'

const vuetify = createVuetify({ components, directives })

const createWrapper = (snackbar = vi.fn(), router = { push: vi.fn() }) => {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
  return mount(LogInSignUp, {
    global: {
      plugins: [vuetify, i18n],
      provide: { showSnackbar: snackbar },
      mocks: { $router: router },
      stubs: {
        MButton: {
          name: 'MButton',
          props: ['label'],
          emits: ['click'],
          template:
            '<button class="m-button" :data-test="label" @click="$emit(\'click\')">{{ label }}</button>',
        },
        'v-img': true,
        divider: true,
      },
    },
  })
}

describe('LogInSignUp', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.auth.type = 'cornflow'
    store.appConfig = { parameters: { enableSignup: true } }
    routeQuery.value = {}
    auth.login = vi.fn()
    auth.signup = vi.fn()
    auth.logout = vi.fn()
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  describe('auth type computed flags', () => {
    test('isCornflowAuth true for cornflow', async () => {
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.isCornflowAuth).toBe(true)
      expect(wrapper.vm.isAzureAuth).toBe(false)
      expect(wrapper.vm.isCognitoAuth).toBe(false)
    })

    test('loginButtonLabel azure', async () => {
      mockConfig.auth.type = 'azure'
      routeQuery.value = { from: 'logout' }
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.loginButtonLabel).toBe('logIn.azure_button')
    })

    test('loginButtonLabel cognito', async () => {
      mockConfig.auth.type = 'cognito'
      routeQuery.value = { from: 'logout' }
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.loginButtonLabel).toBe('logIn.cognito_button')
    })

    test('loginButtonLabel cornflow default', async () => {
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.loginButtonLabel).toBe('logIn.button_label')
    })
  })

  describe('enableSignUp computed', () => {
    test('reflects store config', async () => {
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.enableSignUp).toBe(true)
    })
  })

  describe('rendering', () => {
    test('renders cornflow login form by default', async () => {
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('input[type="text"]').exists()).toBe(true)
      expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    })

    test('switches to signup mode showing extra password fields', async () => {
      wrapper = createWrapper()
      await flushPromises()
      await wrapper.find('a[data-test="signup-link"]').trigger('click')
      expect(wrapper.vm.signUpMode).toBe(true)
      const pwInputs = wrapper.findAll('input[type="password"]')
      expect(pwInputs.length).toBe(2)
    })
  })

  describe('created lifecycle', () => {
    test('initiates external auth for non-cornflow and not logout', async () => {
      mockConfig.auth.type = 'azure'
      routeQuery.value = {}
      wrapper = createWrapper()
      await flushPromises()
      expect(auth.login).toHaveBeenCalled()
    })

    test('expired token forces logout flow', async () => {
      mockConfig.auth.type = 'azure'
      routeQuery.value = { expired: 'true' }
      wrapper = createWrapper()
      await flushPromises()
      expect(auth.logout).toHaveBeenCalled()
      expect(wrapper.vm.isFromLogout).toBe(true)
    })

    test('from=logout sets isFromLogout', async () => {
      mockConfig.auth.type = 'azure'
      routeQuery.value = { from: 'logout' }
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.isFromLogout).toBe(true)
    })
  })

  describe('submitLogIn', () => {
    test('successful cornflow login navigates and shows success', async () => {
      auth.login.mockResolvedValue(true)
      const router = { push: vi.fn() }
      const snack = vi.fn()
      wrapper = createWrapper(snack, router)
      await flushPromises()
      wrapper.vm.username = 'u'
      wrapper.vm.password = 'p'
      await wrapper.vm.submitLogIn()
      expect(auth.login).toHaveBeenCalledWith('u', 'p')
      expect(router.push).toHaveBeenCalledWith('/')
      expect(snack).toHaveBeenCalledWith('logIn.snackbar_message_success', 'success')
    })

    test('successful cornflow login with LoginResult object navigates home', async () => {
      auth.login.mockResolvedValue({ success: true, changePassword: false })
      const router = { push: vi.fn() }
      const snack = vi.fn()
      wrapper = createWrapper(snack, router)
      await flushPromises()
      wrapper.vm.username = 'u'
      wrapper.vm.password = 'p'
      await wrapper.vm.submitLogIn()
      expect(router.push).toHaveBeenCalledWith('/')
      expect(snack).toHaveBeenCalledWith('logIn.snackbar_message_success', 'success')
    })

    test('mfaRequired result redirects to the sign-in landing', async () => {
      auth.login.mockResolvedValue({ success: false, mfaRequired: true })
      const router = { push: vi.fn() }
      const snack = vi.fn()
      wrapper = createWrapper(snack, router)
      await flushPromises()
      wrapper.vm.username = 'u'
      wrapper.vm.password = 'p'
      await wrapper.vm.submitLogIn()
      expect(router.push).toHaveBeenCalledWith('/sign-in')
      expect(snack).not.toHaveBeenCalledWith('logIn.snackbar_message_error', 'error')
    })

    test('mfaSetupRequired result redirects to the sign-in landing', async () => {
      auth.login.mockResolvedValue({ success: false, mfaSetupRequired: true })
      const router = { push: vi.fn() }
      wrapper = createWrapper(vi.fn(), router)
      await flushPromises()
      wrapper.vm.username = 'u'
      wrapper.vm.password = 'p'
      await wrapper.vm.submitLogIn()
      expect(router.push).toHaveBeenCalledWith('/sign-in')
    })

    test('failed LoginResult shows error snackbar', async () => {
      auth.login.mockResolvedValue({ success: false, errorMessage: 'bad' })
      const snack = vi.fn()
      wrapper = createWrapper(snack)
      await flushPromises()
      await wrapper.vm.submitLogIn()
      expect(snack).toHaveBeenCalledWith('logIn.snackbar_message_error', 'error')
    })

    test('failed login shows error snackbar', async () => {
      auth.login.mockResolvedValue(false)
      const snack = vi.fn()
      wrapper = createWrapper(snack)
      await flushPromises()
      await wrapper.vm.submitLogIn()
      expect(snack).toHaveBeenCalledWith('logIn.snackbar_message_error', 'error')
    })

    test('login throwing is caught and shows error', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      auth.login.mockRejectedValue(new Error('x'))
      const snack = vi.fn()
      wrapper = createWrapper(snack)
      await flushPromises()
      await wrapper.vm.submitLogIn()
      expect(snack).toHaveBeenCalledWith('logIn.snackbar_message_error', 'error')
      spy.mockRestore()
    })

    test('non-cornflow login calls auth.login with no args', async () => {
      mockConfig.auth.type = 'azure'
      routeQuery.value = { from: 'logout' }
      auth.login.mockResolvedValue(true)
      wrapper = createWrapper()
      await flushPromises()
      auth.login.mockClear()
      await wrapper.vm.submitLogIn()
      expect(auth.login).toHaveBeenCalledWith()
    })
  })

  describe('submitSignUp', () => {
    test('returns early when signup disabled', async () => {
      store.appConfig = { parameters: { enableSignup: false } }
      wrapper = createWrapper()
      await flushPromises()
      await wrapper.vm.submitSignUp()
      expect(auth.signup).not.toHaveBeenCalled()
    })

    test('successful signup resets to login mode', async () => {
      auth.signup.mockResolvedValue(true)
      const snack = vi.fn()
      wrapper = createWrapper(snack)
      await flushPromises()
      wrapper.vm.signUpMode = true
      wrapper.vm.newUser = {
        email: 'e@x.com',
        username: 'u',
        password: 'P',
        passwordConfirmation: 'P',
      }
      await wrapper.vm.submitSignUp()
      expect(auth.signup).toHaveBeenCalledWith('e@x.com', 'u', 'P')
      expect(wrapper.vm.signUpMode).toBe(false)
      expect(snack).toHaveBeenCalledWith('signUp.snackbar_message_success', 'success')
    })

    test('failed signup shows error', async () => {
      auth.signup.mockResolvedValue(false)
      const snack = vi.fn()
      wrapper = createWrapper(snack)
      await flushPromises()
      await wrapper.vm.submitSignUp()
      expect(snack).toHaveBeenCalledWith('signUp.snackbar_message_error', 'error')
    })
  })

  describe('initiateExternalAuth', () => {
    test('calls auth.login', async () => {
      auth.login.mockResolvedValue(true)
      mockConfig.auth.type = 'azure'
      routeQuery.value = { from: 'logout' }
      wrapper = createWrapper()
      await flushPromises()
      auth.login.mockClear()
      await wrapper.vm.initiateExternalAuth()
      expect(auth.login).toHaveBeenCalled()
    })

    test('handles login error', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConfig.auth.type = 'azure'
      routeQuery.value = { from: 'logout' }
      const snack = vi.fn()
      wrapper = createWrapper(snack)
      await flushPromises()
      auth.login.mockRejectedValueOnce(new Error('fail'))
      await wrapper.vm.initiateExternalAuth()
      expect(snack).toHaveBeenCalledWith('logIn.snackbar_message_error', 'error')
      spy.mockRestore()
    })
  })

  describe('clearLocalStorageAuthData', () => {
    test('removes only auth-related localStorage keys', async () => {
      // Functional localStorage mock: data keys are enumerable own properties
      // (like the real Storage) so the component's Object.keys() scan works
      const storageMock: Record<string, string> = {}
      Object.defineProperties(storageMock, {
        getItem: {
          value: (key: string) => (key in storageMock ? storageMock[key] : null),
        },
        setItem: {
          value: (key: string, value: string) => {
            storageMock[key] = String(value)
          },
        },
        removeItem: {
          value: (key: string) => {
            delete storageMock[key]
          },
        },
        clear: {
          value: () =>
            Object.keys(storageMock).forEach((key) => delete storageMock[key]),
        },
      })
      const originalLocalStorage = Object.getOwnPropertyDescriptor(
        window,
        'localStorage',
      )
      Object.defineProperty(window, 'localStorage', {
        value: storageMock,
        configurable: true,
      })
      try {
        wrapper = createWrapper()
        await flushPromises()
        window.localStorage.setItem('access_token', 'a')
        window.localStorage.setItem('msal.account', 'b')
        window.localStorage.setItem('keepMe', 'c')
        wrapper.vm.clearLocalStorageAuthData()
        expect(window.localStorage.getItem('access_token')).toBeNull()
        expect(window.localStorage.getItem('msal.account')).toBeNull()
        expect(window.localStorage.getItem('keepMe')).toBe('c')
      } finally {
        if (originalLocalStorage) {
          Object.defineProperty(window, 'localStorage', originalLocalStorage)
        }
      }
    })
  })

  describe('validation rules', () => {
    test('password rules enforce composition', async () => {
      wrapper = createWrapper()
      await flushPromises()
      const r = wrapper.vm.passwordRules
      expect(r.length('short')).toBe('rules.password_length')
      expect(r.length('longenoughpassword')).toBe(true)
      expect(r.capitalLetters('lowercase1!')).toBe('rules.password_capital_letters')
      expect(r.numbers('NoDigits!')).toBe('rules.password_numbers')
      expect(r.noSpace('has space')).toBe('rules.password_no_space')
      expect(r.specialCharacter('NoSpecial1')).toBe(
        'rules.password_special_characters',
      )
      expect(r.noDigitSequence('Aa!19911225bcd')).toBe(
        'settings.passwordRuleDigitSequence',
      )
      expect(r.noDigitSequence('Kx9#tR2m!Qw7Zp')).toBe(true)
      expect(r.strength('Aa1!aaaaaaaaaaaa')).toBe(
        'settings.passwordRuleStrength',
      )
      expect(r.strength('Kx9#tR2m!Qw7Zp')).toBe(true)
    })

    test('email format rule', async () => {
      wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.vm.emailRules.format('bad')).toBe('rules.valid_email')
      expect(wrapper.vm.emailRules.format('good@x.com')).toBe(true)
    })

    test('password confirmation match rule', async () => {
      wrapper = createWrapper()
      await flushPromises()
      wrapper.vm.newUser.password = 'abc'
      expect(wrapper.vm.passwordConfirmationRules.match('abc')).toBe(true)
      expect(wrapper.vm.passwordConfirmationRules.match('xyz')).toBe(
        'rules.password_match',
      )
    })
  })
})
