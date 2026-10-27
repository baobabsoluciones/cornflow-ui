import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

const { auth, config, parameters, languages, i18nPlugin } = vi.hoisted(() => ({
  auth: {
    cornflow: { login: vi.fn() },
    azure: { login: vi.fn() },
    cognito: { login: vi.fn() },
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
  baobabLogoSmall: '/baobab.png',
  companyLogo: '/company.png',
  fullLogo: '/full.png',
  loginBackground: '/background.png',
  googleLogo: '/google.png',
  microsoftLogo: '/microsoft.png',
}))
vi.mock('@/app/config', () => ({ default: { getLanguages: () => languages.list } }))
vi.mock('@cornflow-ui/core/plugins/i18n', () => i18nPlugin)

import SignInLanding from '@cornflow-ui/core/components/SignInLanding.vue'

const snackbar = vi.fn()

async function mountPage(login?: Record<string, unknown>) {
  parameters.current = login ? { login } : {}
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/sign-in', component: { template: '<div />' } },
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
      expect(auth.cornflow.login).toHaveBeenCalledWith('planner', 'secret')
      expect(router.currentRoute.value.path).toBe('/')
      expect(snackbar).toHaveBeenCalledWith('logIn.snackbar_message_success', 'success')
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
      expect(auth.azure.login).not.toHaveBeenCalled()
      expect(auth.cognito.login).not.toHaveBeenCalled()
    })

    test('signs in through the external auth of the deployment', async () => {
      ;({ wrapper } = await mountPage())
      await wrapper.find('[data-testid="sign-in-microsoft"]').trigger('click')
      await flushPromises()
      expect(auth.azure.login).toHaveBeenCalled()

      config.auth.type = 'cognito'
      config.isGoogleConfigured.mockReturnValue(true)
      wrapper.unmount()
      ;({ wrapper } = await mountPage())
      await wrapper.find('[data-testid="sign-in-google"]').trigger('click')
      await flushPromises()
      expect(auth.cognito.login).toHaveBeenCalled()
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
