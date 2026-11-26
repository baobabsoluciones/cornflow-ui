import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import UserSettingsView from '@cornflow-ui/core/views/UserSettingsView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import appConfig from '@/app/config'

const { changeLanguage, snackbar, authConfig, theme } = vi.hoisted(() => ({
  changeLanguage: vi.fn(),
  snackbar: vi.fn(),
  authConfig: { auth: { type: 'cornflow' }, initConfig: vi.fn(async () => undefined) },
  theme: { enabled: false, preference: { value: 'light' }, setPreference: vi.fn() },
}))

const cornflowAuth = vi.hoisted(() => ({ logout: vi.fn() }))

vi.mock('@cornflow-ui/core/plugins/i18n', () => ({ changeLanguage }))
vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({
  getSpecificAuthService: vi.fn(async () => cornflowAuth),
}))
vi.mock('@cornflow-ui/core/services/SnackbarService', () => ({ showSnackbar: snackbar }))
vi.mock('@cornflow-ui/core/config', () => ({ default: authConfig }))
vi.mock('@cornflow-ui/core/plugins/theme', async () => {
  const { ref } = await import('vue')
  const preference = ref('light')
  return {
    useTheme: () => {
      preference.value = theme.preference.value
      return { enabled: theme.enabled, preference, setPreference: theme.setPreference }
    },
  }
})

const messages = {
  settings: {
    user: 'User settings',
    userDescription: 'Your account, the language of the app and your password',
    username: 'User name',
    roles: 'Roles',
    theme: 'Appearance',
    selectTheme: 'Light, dark, or as your system is',
    light: 'Light',
    dark: 'Dark',
    system: 'As the system',
    language: 'Language',
    selectLanguage: 'The language the app shows',
    english: 'English',
    spanish: 'Spanish',
    french: 'French',
    portuguese: 'Portuguese',
    password: 'Password',
    changePassword: 'Choose a new password to sign in with',
    currentPassword: 'Current password',
    passwordChangeForced: 'Your password has expired or must be renewed. Set a new one to go on using the app.',
    snackbarMessageSuccessRelogin: 'Password updated. Sign in again with your new password.',
    newPassword: 'New password',
    confirmPassword: 'Repeat the new password',
    showPasswords: 'Show the passwords',
    hidePasswords: 'Hide the passwords',
    passwordNeeds: 'What the password needs',
    passwordRules: {
      length: 'At least {length} characters',
      characters: 'Upper and lower case letters, numbers and a special character',
      spaces: 'No spaces',
      digits: 'No runs of 6 or more digits (such as dates)',
      strength: 'Hard to guess: no common words or patterns',
      match: 'Both passwords match',
    },
    savePassword: 'Change password',
    snackbarMessageSuccess: 'Password updated successfully',
    snackbarMessageError: 'An error occurred while updating the password',
  },
}

let getLanguages: ReturnType<typeof vi.spyOn>

async function mountView({ authType = 'cornflow', path = '/user-settings' } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: messages, es: messages } })
  authConfig.auth.type = authType
  const store = useGeneralStore()
  store.user = {
    id: 7,
    username: 'aruiz',
    fullName: 'Ana Ruiz',
    email: 'ana@example.com',
    roles: [{ id: 1, name: 'planner' }, { id: 2, name: 'admin' }],
  } as any
  store.changeUserPassword = vi.fn(async () => ({ success: true })) as any
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/user-settings', component: { template: '<div />' } },
      { path: '/sign-in', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(UserSettingsView, {
    global: { plugins: [pinia, i18n, router] },
    attachTo: document.body,
  })
  return { wrapper, store, i18n, router }
}

const field = (wrapper: any, id: string) => wrapper.find(`[data-testid="${id}"]`)
const rule = (wrapper: any, key: string) => wrapper.find(`[data-testid="settings-rule-${key}"]`)

async function typePasswords(wrapper: any, password: string, repeated = password) {
  await field(wrapper, 'settings-new-password').setValue(password)
  await field(wrapper, 'settings-confirm-password').setValue(repeated)
}

describe('UserSettingsView', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    getLanguages = vi.spyOn(appConfig, 'getLanguages').mockReturnValue([])
    theme.enabled = false
    theme.preference.value = 'light'
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.restoreAllMocks()
  })

  test('marks the parts its tour points at', async () => {
    ;({ wrapper } = await mountView())
    for (const part of ['settings-account', 'settings-language', 'settings-password']) {
      expect(wrapper.find(`[data-tour="${part}"]`).exists(), part).toBe(true)
    }
  })

  test('shows who is signed in: name, e-mail, user name and roles', async () => {
    ;({ wrapper } = await mountView())
    const account = field(wrapper, 'settings-account')
    expect(account.find('.user-settings__name').text()).toBe('Ana Ruiz')
    expect(account.text()).toContain('ana@example.com')
    expect(account.text()).toContain('User name: aruiz')
    expect(account.findAll('.core-badge').map((badge: any) => badge.text())).toEqual(['planner', 'admin'])
    expect(account.find('.user-settings__avatar').text()).toBe('A')
  })

  describe('appearance', () => {
    test('shows only when the app offers dark mode', async () => {
      ;({ wrapper } = await mountView())
      expect(field(wrapper, 'settings-theme').exists()).toBe(false)
      wrapper.unmount()
      theme.enabled = true
      ;({ wrapper } = await mountView())
      expect(field(wrapper, 'settings-theme').exists()).toBe(true)
    })

    test('offers light, dark and the system, the chosen one picked; picking one changes it', async () => {
      theme.enabled = true
      theme.preference.value = 'system'
      ;({ wrapper } = await mountView())
      const options = wrapper.findAll('[data-testid="settings-theme"] [role="radio"]')
      expect(options.map((option: any) => [option.text(), option.attributes('aria-checked')])).toEqual([
        ['Light', 'false'],
        ['Dark', 'false'],
        ['As the system', 'true'],
      ])
      await options[1].trigger('click')
      expect(theme.setPreference).toHaveBeenCalledWith('dark')
    })
  })

  describe('language', () => {
    test('offers every core language when the app names none', async () => {
      ;({ wrapper } = await mountView())
      expect(wrapper.vm.languages).toEqual([
        { label: 'English', value: 'en' },
        { label: 'Spanish', value: 'es' },
        { label: 'French', value: 'fr' },
        { label: 'Portuguese', value: 'pt' },
      ])
    })

    test('offers only the languages the app names, in its order', async () => {
      getLanguages.mockReturnValue(['es', 'en'])
      ;({ wrapper } = await mountView())
      expect(wrapper.vm.languages.map((l: any) => l.value)).toEqual(['es', 'en'])
    })

    test('leaves out languages the core does not have, and warns each time the list is rebuilt', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const warnings = () => warn.mock.calls.filter(([msg]) => String(msg).includes('[i18n] Language "de"')).length
      getLanguages.mockReturnValue(['en', 'de'])
      let i18n: any
      ;({ wrapper, i18n } = await mountView())
      expect(wrapper.vm.languages.map((l: any) => l.value)).toEqual(['en'])
      expect(warnings()).toBe(1)

      i18n.global.locale.value = 'es'
      await flushPromises()
      expect(warnings()).toBe(2)
    })

    test('picking one switches the app to it', async () => {
      let i18n: any
      ;({ wrapper, i18n } = await mountView())
      // The select works with the position of the option: Spanish is the second one.
      await field(wrapper, 'settings-language').setValue('1')
      expect(i18n.global.locale.value).toBe('es')
      expect(changeLanguage).toHaveBeenCalledWith('es')
    })
  })

  describe('password', () => {
    const STRONG = 'Granite-Orbit-47x'

    async function typeAll(wrapper: any, current: string, password: string, repeated = password) {
      await field(wrapper, 'settings-current-password').setValue(current)
      await typePasswords(wrapper, password, repeated)
      // The strength check loads its dictionaries on demand.
      await vi.waitFor(() => expect(rule(wrapper, 'strength').exists()).toBe(true))
      await flushPromises()
    }

    test('shows only when the app signs in with Cornflow', async () => {
      ;({ wrapper } = await mountView({ authType: 'azure' }))
      expect(field(wrapper, 'settings-password').exists()).toBe(false)
      wrapper.unmount()
      ;({ wrapper } = await mountView())
      expect(field(wrapper, 'settings-password').exists()).toBe(true)
    })

    test("ticks what cornflow's password policy needs as it is typed", async () => {
      ;({ wrapper } = await mountView())

      await typeAll(wrapper, 'old', 'Plan 2026!')
      expect(rule(wrapper, 'length').classes()).not.toContain('is-met')
      expect(rule(wrapper, 'characters').classes()).toContain('is-met')
      expect(rule(wrapper, 'spaces').classes()).not.toContain('is-met')

      await typeAll(wrapper, 'old', 'Report-20261123x')
      expect(rule(wrapper, 'digits').classes()).not.toContain('is-met')

      await typeAll(wrapper, 'old', 'Password1234!')
      expect(rule(wrapper, 'length').classes()).toContain('is-met')
      expect(rule(wrapper, 'strength').classes()).not.toContain('is-met')

      await vi.waitFor(async () => {
        await typeAll(wrapper, 'old', STRONG)
        expect(rule(wrapper, 'strength').classes()).toContain('is-met')
      })

      await typeAll(wrapper, 'old', STRONG, `${STRONG}?`)
      expect(rule(wrapper, 'match').classes()).not.toContain('is-met')
      expect(wrapper.find('.core-text-field.is-invalid').exists()).toBe(true)
    })

    test('is sent only with the current password and a new one that meets it all', async () => {
      ;({ wrapper } = await mountView())
      const save = () => field(wrapper, 'settings-save-password')
      expect(save().attributes('disabled')).toBeDefined()

      await typeAll(wrapper, '', STRONG)
      await vi.waitFor(() => expect(rule(wrapper, 'strength').classes()).toContain('is-met'))
      expect(save().attributes('disabled')).toBeDefined()

      await field(wrapper, 'settings-current-password').setValue('Old-Passphrase!1')
      expect(save().attributes('disabled')).toBeUndefined()
    })

    test('the eye shows and hides the passwords', async () => {
      ;({ wrapper } = await mountView())
      const types = () =>
        ['settings-current-password', 'settings-new-password', 'settings-confirm-password'].map((id) =>
          field(wrapper, id).attributes('type'),
        )
      expect(types()).toEqual(['password', 'password', 'password'])
      await field(wrapper, 'settings-show-passwords').trigger('click')
      expect(types()).toEqual(['text', 'text', 'text'])
    })

    test('saving changes it and, since every session closes, signs in again', async () => {
      let store: any
      let router: any
      ;({ wrapper, store, router } = await mountView())
      await typeAll(wrapper, 'Old-Passphrase!1', STRONG)
      await vi.waitFor(() => expect(rule(wrapper, 'strength').classes()).toContain('is-met'))
      await field(wrapper, 'settings-password').trigger('submit')
      await flushPromises()

      expect(store.changeUserPassword).toHaveBeenCalledWith(7, STRONG, 'Old-Passphrase!1')
      expect(snackbar).toHaveBeenCalledWith('Password updated. Sign in again with your new password.', 'success')
      expect(cornflowAuth.logout).toHaveBeenCalled()
      expect(router.currentRoute.value.path).toBe('/sign-in')
    })

    test("a change the server refuses says why and keeps what was typed", async () => {
      let store: any
      ;({ wrapper, store } = await mountView())
      store.changeUserPassword.mockResolvedValueOnce({ success: false, message: 'The password has been used recently' })
      await typeAll(wrapper, 'Old-Passphrase!1', STRONG)
      await vi.waitFor(() => expect(rule(wrapper, 'strength').classes()).toContain('is-met'))
      await field(wrapper, 'settings-password').trigger('submit')
      await flushPromises()

      expect(snackbar).toHaveBeenLastCalledWith('The password has been used recently', 'error')
      expect((field(wrapper, 'settings-new-password').element as HTMLInputElement).value).toBe(STRONG)
      expect(cornflowAuth.logout).not.toHaveBeenCalled()
    })

    test('a change that fails says so', async () => {
      let store: any
      ;({ wrapper, store } = await mountView())
      vi.spyOn(console, 'error').mockImplementation(() => {})
      store.changeUserPassword.mockRejectedValueOnce(new Error('offline'))
      await typeAll(wrapper, 'Old-Passphrase!1', STRONG)
      await vi.waitFor(() => expect(rule(wrapper, 'strength').classes()).toContain('is-met'))
      await field(wrapper, 'settings-password').trigger('submit')
      await flushPromises()

      expect(snackbar).toHaveBeenLastCalledWith('An error occurred while updating the password', 'error')
    })

    test('a password that must be changed says so', async () => {
      ;({ wrapper } = await mountView({ path: '/user-settings?changePassword=true' }))
      expect(field(wrapper, 'settings-password-forced').text()).toBe(
        'Your password has expired or must be renewed. Set a new one to go on using the app.',
      )
      wrapper.unmount()

      ;({ wrapper } = await mountView())
      expect(field(wrapper, 'settings-password-forced').exists()).toBe(false)
    })
  })
})