import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

const { auth, config, parameters, languages, i18nPlugin } = vi.hoisted(() => ({
  auth: {
    cornflow: {
      login: vi.fn(),
      mfaSetup: vi.fn(),
      mfaVerify: vi.fn(),
      clearPendingEnrollment: vi.fn(),
      requestPasswordReset: vi.fn(),
    },
    azure: { login: vi.fn(), loginWith: vi.fn() },
    cognito: { login: vi.fn(), loginWith: vi.fn() },
  },
  config: {
    name: 'Planner Pro',
    auth: { type: 'azure' },
    isMicrosoftConfigured: vi.fn(),
    isGoogleConfigured: vi.fn(),
  },
  parameters: { current: {} as Record<string, any> },
  languages: { list: [] as string[] },
  i18nPlugin: { changeLanguage: vi.fn(), locale: null as any },
}))

vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({
  getSpecificAuthService: vi.fn(async (type: keyof typeof auth) => auth[type] ?? null),
}))
vi.mock('@cornflow-ui/core/config', () => ({ default: config }))
vi.mock('@cornflow-ui/core/utils/appParameters', () => ({ getAppParameters: () => parameters.current }))
vi.mock('@cornflow-ui/core/utils/assets', () => ({
  companyLogo: '/company.png',
  fullLogo: '/full.png',
  loginBackground: '/background.png',
  googleLogo: '/google.png',
  microsoftLogo: '/microsoft.png',
}))
vi.mock('@/app/config', () => ({ default: { getLanguages: () => languages.list } }))
vi.mock('@cornflow-ui/core/plugins/i18n', () => i18nPlugin)
vi.mock('qrcode', () => ({ toDataURL: vi.fn(async () => 'data:image/png;base64,QR') }))

import SignInLanding from '@cornflow-ui/core/components/SignInLanding.vue'

const snackbar = vi.fn()

async function mountPage(login?: Record<string, unknown>) {
  parameters.current = login ? { login } : {}
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/sign-in', component: { template: '<div />' } },
      { path: '/user-settings', component: { template: '<div />' } },
    ],
  })
  await router.push('/sign-in')
  await router.isReady()
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { app: { description: 'Plans the week.' } } },
    missingWarn: false,
    fallbackWarn: false,
  })
  const wrapper = mount(SignInLanding, {
    global: { plugins: [i18n, router], provide: { showSnackbar: snackbar } },
    attachTo: document.body,
  })
  return { wrapper, router }
}

async function fill(wrapper: any, username: string, password: string) {
  await wrapper.find('[data-testid="sign-in-username"]').setValue(username)
  await wrapper.find('[data-testid="sign-in-password"]').setValue(password)
}

describe('SignInLanding', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    config.auth.type = 'azure'
    config.isMicrosoftConfigured.mockReturnValue(true)
    config.isGoogleConfigured.mockReturnValue(false)
    auth.cornflow.login.mockResolvedValue(true)
    languages.list = ['en', 'es']
    i18nPlugin.locale = ref('en')
  })

  afterEach(() => wrapper?.unmount())

  describe('layout', () => {
    test('by default, the form on a card over the login background, under the app name', async () => {
      ;({ wrapper } = await mountPage())
      const page = wrapper.find('[data-testid="sign-in-photo"]')
      expect(page.exists()).toBe(true)
      expect(page.attributes('style')).toContain('/background.png')
      expect(wrapper.find('.sign-in__marks-company').attributes('src')).toBe('/full.png')
      expect(wrapper.find('.sign-in__marks-product svg.sign-in__marks-mark').exists()).toBe(true)
      expect(wrapper.find('.sign-in__app-title .is-bold').text()).toBe('Planner')
      expect(wrapper.find('.sign-in__app-title').text()).toBe('Planner Pro')
      expect(wrapper.find('.sign-in__subtitle').text()).toBe('logIn.default_subtitle')
      expect(wrapper.find('.sign-in__footer').text()).toContain('logIn.powered_by')
    })

    test('brand: a panel with the company logo, the app name and its description, beside the form', async () => {
      ;({ wrapper } = await mountPage({ layout: 'brand', description: 'app.description' }))
      expect(wrapper.find('[data-testid="sign-in-photo"]').exists()).toBe(false)
      const panel = wrapper.find('.sign-in__brand-panel')
      expect(panel.find('.sign-in__brand-logo').attributes('src')).toBe('/company.png')
      expect(panel.find('.sign-in__brand-product svg.sign-in__brand-mark').exists()).toBe(true)
      expect(panel.find('.sign-in__brand-title').text()).toBe('PlannerPro')
      expect(panel.find('.sign-in__brand-description').text()).toBe('Plans the week.')
      expect(wrapper.find('.sign-in__title').text()).toBe('logIn.button_label')
    })

    test('brand without a description shows none', async () => {
      ;({ wrapper } = await mountPage({ layout: 'brand' }))
      expect(wrapper.find('.sign-in__brand-description').exists()).toBe(false)
    })

    test("the subtitle is the app's when it gives one", async () => {
      ;({ wrapper } = await mountPage({ subtitle: 'Sign in to plan.' }))
      expect(wrapper.find('.sign-in__subtitle').text()).toBe('Sign in to plan.')
    })
  })

  describe('form', () => {
    test('signs in against Cornflow and goes to the app', async () => {
      let router: any
      ;({ wrapper, router } = await mountPage())
      await fill(wrapper, 'planner', 'secret')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(auth.cornflow.login).toHaveBeenCalledWith('planner', 'secret', undefined)
      expect(router.currentRoute.value.path).toBe('/')
      expect(snackbar).toHaveBeenCalledWith('logIn.snackbar_message_success', 'success')
    })

    test('says when the previous sign-in was', async () => {
      auth.cornflow.login.mockResolvedValue({ success: true, lastLogin: '2026-11-20T08:00:00Z' })
      ;({ wrapper } = await mountPage())
      await fill(wrapper, 'planner', 'secret')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(snackbar).toHaveBeenCalledWith('logIn.last_login_info', 'info')
    })

    test('a password that must be changed leads to the settings page', async () => {
      auth.cornflow.login.mockResolvedValue({ success: true, changePassword: true })
      let router: any
      ;({ wrapper, router } = await mountPage())
      await fill(wrapper, 'planner', 'secret')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe('/user-settings?changePassword=true')
      expect(snackbar).toHaveBeenCalledWith('logIn.password_change_required', 'warning')
    })

    test('too many attempts say so, not that the credentials are wrong', async () => {
      auth.cornflow.login.mockResolvedValue({ success: false, rateLimited: true })
      ;({ wrapper } = await mountPage())
      await fill(wrapper, 'planner', 'secret')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(snackbar).toHaveBeenCalledWith('logIn.snackbar_message_error_rate_limited', 'error')
    })

    test('a locked account says so', async () => {
      auth.cornflow.login.mockResolvedValue({ success: false, accountLocked: true })
      ;({ wrapper } = await mountPage())
      await fill(wrapper, 'planner', 'secret')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(snackbar).toHaveBeenCalledWith('logIn.account_locked', 'error')
    })

    test('shows the legal notice under the form', async () => {
      ;({ wrapper } = await mountPage())
      expect(wrapper.find('[data-testid="sign-in-legal-notice"]').text()).toBe('logIn.legal_notice')
    })

    test('with a field empty, says so and does not try', async () => {
      ;({ wrapper } = await mountPage())
      await fill(wrapper, 'planner', '')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(auth.cornflow.login).not.toHaveBeenCalled()
      expect(wrapper.findAll('.sign-in-form__error').map((e: any) => e.text())).toEqual(['rules.required'])
      expect(wrapper.find('[data-testid="sign-in-password"]').attributes('aria-invalid')).toBe('true')
    })

    test('wrong credentials say so', async () => {
      auth.cornflow.login.mockResolvedValue(false)
      ;({ wrapper } = await mountPage())
      await fill(wrapper, 'planner', 'wrong')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(snackbar).toHaveBeenCalledWith('logIn.snackbar_message_error_auth', 'error')
    })

    test('a server that fails says so', async () => {
      auth.cornflow.login.mockRejectedValue(new Error('down'))
      vi.spyOn(console, 'error').mockImplementation(() => {})
      ;({ wrapper } = await mountPage())
      await fill(wrapper, 'planner', 'secret')
      await wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(snackbar).toHaveBeenCalledWith('logIn.snackbar_message_error_server', 'error')
    })

    test('the eye shows and hides the password', async () => {
      ;({ wrapper } = await mountPage())
      const input = () => wrapper.find('[data-testid="sign-in-password"]')
      expect(input().attributes('type')).toBe('password')
      await wrapper.find('[data-testid="sign-in-show-password"]').trigger('click')
      expect(input().attributes('type')).toBe('text')
    })
  })

  describe('two-factor authentication', () => {
    async function signIn() {
      const mounted = await mountPage()
      await fill(mounted.wrapper, 'planner', 'secret')
      await mounted.wrapper.find('form').trigger('submit')
      await flushPromises()
      return mounted
    }

    test('asks for the code and signs in with it', async () => {
      auth.cornflow.login
        .mockResolvedValueOnce({ success: false, mfaRequired: true })
        .mockResolvedValueOnce({ success: true })
      let router: any
      ;({ wrapper, router } = await signIn())

      expect(wrapper.find('[data-step="mfa-code"]').exists()).toBe(true)
      await wrapper.find('[data-testid="sign-in-mfa-code"]').setValue('123456')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(auth.cornflow.login).toHaveBeenLastCalledWith('planner', 'secret', '123456')
      expect(router.currentRoute.value.path).toBe('/')
    })

    test('a wrong code says so and asks again', async () => {
      auth.cornflow.login
        .mockResolvedValueOnce({ success: false, mfaRequired: true })
        .mockResolvedValueOnce({ success: false, errorMessage: 'Invalid code' })
      ;({ wrapper } = await signIn())

      await wrapper.find('[data-testid="sign-in-mfa-code"]').setValue('000000')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(snackbar).toHaveBeenCalledWith('logIn.mfa_invalid_code', 'error')
      expect(wrapper.find('[data-step="mfa-code"]').exists()).toBe(true)
      expect((wrapper.find('[data-testid="sign-in-mfa-code"]').element as HTMLInputElement).value).toBe('')
    })

    test('a server that fails on the code says so, not that the code is wrong', async () => {
      auth.cornflow.login
        .mockResolvedValueOnce({ success: false, mfaRequired: true })
        .mockResolvedValueOnce({ success: false, serverError: true })
      ;({ wrapper } = await signIn())

      await wrapper.find('[data-testid="sign-in-mfa-code"]').setValue('123456')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(snackbar).toHaveBeenCalledWith('logIn.snackbar_message_error_server', 'error')
      expect(snackbar).not.toHaveBeenCalledWith('logIn.mfa_invalid_code', 'error')
    })

    test('without a code, says so and does not try', async () => {
      auth.cornflow.login.mockResolvedValueOnce({ success: false, mfaRequired: true })
      ;({ wrapper } = await signIn())

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(auth.cornflow.login).toHaveBeenCalledTimes(1)
      expect(wrapper.find('.sign-in-form__error').text()).toBe('rules.required')
    })

    test('a required enrollment shows the QR code and its secret, then the backup codes', async () => {
      auth.cornflow.login.mockResolvedValue({ success: false, mfaSetupRequired: true })
      auth.cornflow.mfaSetup.mockResolvedValue({ success: true, secret: 'ABC', provisioningUri: 'otpauth://totp/x' })
      auth.cornflow.mfaVerify.mockResolvedValue({ backupCodes: ['a1', 'b2'] })
      let router: any
      ;({ wrapper, router } = await signIn())

      expect(wrapper.find('[data-testid="sign-in-mfa-qr"]').attributes('src')).toBe('data:image/png;base64,QR')
      expect(wrapper.find('[data-testid="sign-in-mfa-secret"]').text()).toBe('ABC')

      await wrapper.find('[data-testid="sign-in-mfa-enroll-code"]').setValue('123456')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(auth.cornflow.mfaVerify).toHaveBeenCalledWith('123456')
      expect(wrapper.findAll('[data-testid="sign-in-backup-codes"] code').map((c: any) => c.text())).toEqual([
        'a1',
        'b2',
      ])

      await wrapper.find('[data-testid="sign-in-backup-continue"]').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/')
    })

    test('an enrollment that cannot start says so', async () => {
      auth.cornflow.login.mockResolvedValue({ success: false, mfaSetupRequired: true })
      auth.cornflow.mfaSetup.mockResolvedValue({ success: false })
      ;({ wrapper } = await signIn())

      expect(snackbar).toHaveBeenCalledWith('logIn.mfa_setup_error', 'error')
      expect(wrapper.find('[data-step="credentials"]').exists()).toBe(true)
    })

    test('a wrong first code keeps the enrollment open', async () => {
      auth.cornflow.login.mockResolvedValue({ success: false, mfaSetupRequired: true })
      auth.cornflow.mfaSetup.mockResolvedValue({ success: true, secret: 'ABC', provisioningUri: 'otpauth://totp/x' })
      auth.cornflow.mfaVerify.mockResolvedValue(null)
      ;({ wrapper } = await signIn())

      await wrapper.find('[data-testid="sign-in-mfa-enroll-code"]').setValue('000000')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(snackbar).toHaveBeenCalledWith('logIn.mfa_invalid_code', 'error')
      expect(wrapper.find('[data-step="mfa-enroll"]').exists()).toBe(true)
    })

    test('going back from the enrollment drops its temporary token', async () => {
      auth.cornflow.login.mockResolvedValue({ success: false, mfaSetupRequired: true })
      auth.cornflow.mfaSetup.mockResolvedValue({ success: true, secret: 'ABC', provisioningUri: 'otpauth://totp/x' })
      ;({ wrapper } = await signIn())

      await wrapper.find('[data-testid="sign-in-back"]').trigger('click')
      await flushPromises()

      expect(auth.cornflow.clearPendingEnrollment).toHaveBeenCalled()
      expect(wrapper.find('[data-step="credentials"]').exists()).toBe(true)
    })
  })

  describe('password recovery', () => {
    async function openForgot() {
      const mounted = await mountPage()
      await mounted.wrapper.find('[data-testid="sign-in-forgot"]').trigger('click')
      return mounted
    }

    test('sends the link and goes back to the sign-in form', async () => {
      auth.cornflow.requestPasswordReset.mockResolvedValue({ sent: true, rateLimited: false })
      ;({ wrapper } = await openForgot())

      await wrapper.find('[data-testid="sign-in-forgot-email"]').setValue('planner@example.com')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(auth.cornflow.requestPasswordReset).toHaveBeenCalledWith('planner@example.com')
      expect(snackbar).toHaveBeenCalledWith('logIn.forgot_sent', 'success')
      expect(wrapper.find('[data-step="credentials"]').exists()).toBe(true)
    })

    test('a throttled request says so, not that the e-mail is on its way', async () => {
      auth.cornflow.requestPasswordReset.mockResolvedValue({ sent: false, rateLimited: true })
      ;({ wrapper } = await openForgot())

      await wrapper.find('[data-testid="sign-in-forgot-email"]').setValue('planner@example.com')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(snackbar).toHaveBeenCalledWith('logIn.snackbar_message_error_rate_limited', 'error')
      expect(snackbar).not.toHaveBeenCalledWith('logIn.forgot_sent', 'success')
    })

    test('without an e-mail, says so and does not send', async () => {
      ;({ wrapper } = await openForgot())

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(auth.cornflow.requestPasswordReset).not.toHaveBeenCalled()
      expect(wrapper.find('.sign-in-form__error').text()).toBe('rules.required')
    })
  })

  describe('single sign-on', () => {
    test('always offers Microsoft and Google', async () => {
      ;({ wrapper } = await mountPage())
      expect(wrapper.find('.sign-in-form__divider').exists()).toBe(true)
      expect(wrapper.find('[data-testid="sign-in-microsoft"]').text()).toBe('logIn.microsoft_button')
      expect(wrapper.find('[data-testid="sign-in-google"]').text()).toBe('logIn.google_button')
    })

    test('one the deployment has not configured says so, and goes nowhere', async () => {
      ;({ wrapper } = await mountPage())
      await wrapper.find('[data-testid="sign-in-google"]').trigger('click')
      await flushPromises()
      expect(snackbar).toHaveBeenCalledWith('logIn.google_not_configured', 'error')
      expect(auth.azure.loginWith).not.toHaveBeenCalled()
      expect(auth.cognito.loginWith).not.toHaveBeenCalled()
    })

    test('signs in through the external auth of the deployment, with the provider picked', async () => {
      ;({ wrapper } = await mountPage())
      await wrapper.find('[data-testid="sign-in-microsoft"]').trigger('click')
      await flushPromises()
      expect(auth.azure.loginWith).toHaveBeenCalledWith('microsoft')

      config.auth.type = 'cognito'
      config.isGoogleConfigured.mockReturnValue(true)
      wrapper.unmount()
      ;({ wrapper } = await mountPage())
      await wrapper.find('[data-testid="sign-in-google"]').trigger('click')
      await flushPromises()
      expect(auth.cognito.loginWith).toHaveBeenCalledWith('google')
    })

    test('in the brand layout, side by side with their name only', async () => {
      ;({ wrapper } = await mountPage({ layout: 'brand' }))
      expect(wrapper.find('.sign-in-form__providers').classes()).toContain('is-compact')
      expect(wrapper.findAll('.sign-in-form__provider').map((b: any) => b.text())).toEqual(['Microsoft', 'Google'])
    })
  })

  describe('languages', () => {
    test("offers the app's languages, the current one marked, and switches", async () => {
      ;({ wrapper } = await mountPage())
      const options = wrapper.findAll('.sign-in-languages__option')
      expect(options.map((o: any) => [o.text(), o.attributes('aria-pressed')])).toEqual([
        ['EN', 'true'],
        ['ES', 'false'],
      ])
      await wrapper.find('[data-testid="sign-in-language-es"]').trigger('click')
      expect(i18nPlugin.changeLanguage).toHaveBeenCalledWith('es')
    })

    test('with a single language, nothing to pick', async () => {
      languages.list = ['es']
      ;({ wrapper } = await mountPage())
      expect(wrapper.find('.sign-in-languages').exists()).toBe(false)
    })
  })
})
