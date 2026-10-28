import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import UserSettingsView from '@cornflow-ui/core/views/UserSettingsView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import appConfig from '@/app/config'

const { changeLanguage, snackbar, authConfig } = vi.hoisted(() => ({
  changeLanguage: vi.fn(),
  snackbar: vi.fn(),
  authConfig: { auth: { type: 'cornflow' }, initConfig: vi.fn(async () => undefined) },
}))

vi.mock('@cornflow-ui/core/plugins/i18n', () => ({ changeLanguage }))
vi.mock('@cornflow-ui/core/services/SnackbarService', () => ({ showSnackbar: snackbar }))
vi.mock('@cornflow-ui/core/config', () => ({ default: authConfig }))

const messages = {
  settings: {
    user: 'User settings',
    userDescription: 'Your account, the language of the app and your password',
    username: 'User name',
    roles: 'Roles',
    language: 'Language',
    selectLanguage: 'The language the app shows',
    english: 'English',
    spanish: 'Spanish',
    french: 'French',
    portuguese: 'Portuguese',
    password: 'Password',
    changePassword: 'Choose a new password to sign in with',
    newPassword: 'New password',
    confirmPassword: 'Repeat the new password',
    showPasswords: 'Show the passwords',
    hidePasswords: 'Hide the passwords',
    passwordNeeds: 'What the password needs',
    passwordRules: {
      length: 'At least {length} characters',
      characters: 'Upper and lower case letters, numbers and a special character',
      spaces: 'No spaces',
      match: 'Both passwords match',
    },
    savePassword: 'Change password',
    snackbarMessageSuccess: 'Password updated successfully',
    snackbarMessageError: 'An error occurred while updating the password',
  },
}

let getLanguages: ReturnType<typeof vi.spyOn>

function mountView({ authType = 'cornflow' } = {}) {
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
  store.changeUserPassword = vi.fn(async () => true) as any
  const wrapper = mount(UserSettingsView, { global: { plugins: [pinia, i18n] }, attachTo: document.body })
  return { wrapper, store, i18n }
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
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.restoreAllMocks()
  })

  test('shows who is signed in: name, e-mail, user name and roles', () => {
    ;({ wrapper } = mountView())
    const account = field(wrapper, 'settings-account')
    expect(account.find('.user-settings__name').text()).toBe('Ana Ruiz')
    expect(account.text()).toContain('ana@example.com')
    expect(account.text()).toContain('User name: aruiz')
    expect(account.findAll('.core-badge').map((badge: any) => badge.text())).toEqual(['planner', 'admin'])
    expect(account.find('.user-settings__avatar').text()).toBe('A')
  })

  describe('language', () => {
    test('offers every core language when the app names none', () => {
      ;({ wrapper } = mountView())
      expect(wrapper.vm.languages).toEqual([
        { label: 'English', value: 'en' },
        { label: 'Spanish', value: 'es' },
        { label: 'French', value: 'fr' },
        { label: 'Portuguese', value: 'pt' },
      ])
    })

    test('offers only the languages the app names, in its order', () => {
      getLanguages.mockReturnValue(['es', 'en'])
      ;({ wrapper } = mountView())
      expect(wrapper.vm.languages.map((l: any) => l.value)).toEqual(['es', 'en'])
    })

    test('leaves out languages the core does not have, and warns each time the list is rebuilt', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const warnings = () => warn.mock.calls.filter(([msg]) => String(msg).includes('[i18n] Language "de"')).length
      getLanguages.mockReturnValue(['en', 'de'])
      let i18n: any
      ;({ wrapper, i18n } = mountView())
      expect(wrapper.vm.languages.map((l: any) => l.value)).toEqual(['en'])
      expect(warnings()).toBe(1)

      i18n.global.locale.value = 'es'
      await flushPromises()
      expect(warnings()).toBe(2)
    })

    test('picking one switches the app to it', async () => {
      let i18n: any
      ;({ wrapper, i18n } = mountView())
      // The select works with the position of the option: Spanish is the second one.
      await field(wrapper, 'settings-language').setValue('1')
      expect(i18n.global.locale.value).toBe('es')
      expect(changeLanguage).toHaveBeenCalledWith('es')
    })
  })

  describe('password', () => {
    test('shows only when the app signs in with Cornflow', () => {
      ;({ wrapper } = mountView({ authType: 'azure' }))
      expect(field(wrapper, 'settings-password').exists()).toBe(false)
      wrapper.unmount()
      ;({ wrapper } = mountView())
      expect(field(wrapper, 'settings-password').exists()).toBe(true)
    })

    test('ticks what the password needs as it is typed, and is sent only once it has it all', async () => {
      ;({ wrapper } = mountView())
      const save = () => field(wrapper, 'settings-save-password')
      expect(save().attributes('disabled')).toBeDefined()

      await typePasswords(wrapper, 'abc')
      expect(rule(wrapper, 'length').classes()).not.toContain('is-met')
      expect(rule(wrapper, 'match').classes()).toContain('is-met')

      await typePasswords(wrapper, 'Plan 2026!')
      expect(rule(wrapper, 'length').classes()).toContain('is-met')
      expect(rule(wrapper, 'characters').classes()).toContain('is-met')
      expect(rule(wrapper, 'spaces').classes()).not.toContain('is-met')
      expect(save().attributes('disabled')).toBeDefined()

      await typePasswords(wrapper, 'Plan2026!', 'Plan2026?')
      expect(rule(wrapper, 'match').classes()).not.toContain('is-met')
      expect(wrapper.find('.core-text-field.is-invalid').exists()).toBe(true)

      await typePasswords(wrapper, 'Plan2026!')
      expect(save().attributes('disabled')).toBeUndefined()
    })

    test('the eye shows and hides both passwords', async () => {
      ;({ wrapper } = mountView())
      const types = () =>
        ['settings-new-password', 'settings-confirm-password'].map((id) => field(wrapper, id).attributes('type'))
      expect(types()).toEqual(['password', 'password'])
      await field(wrapper, 'settings-show-passwords').trigger('click')
      expect(types()).toEqual(['text', 'text'])
    })

    test('saving changes it, empties the fields and says so', async () => {
      let store: any
      ;({ wrapper, store } = mountView())
      await typePasswords(wrapper, 'Plan2026!')
      await field(wrapper, 'settings-password').trigger('submit')
      await flushPromises()

      expect(store.changeUserPassword).toHaveBeenCalledWith(7, 'Plan2026!')
      expect(snackbar).toHaveBeenCalledWith('Password updated successfully', 'success')
      expect((field(wrapper, 'settings-new-password').element as HTMLInputElement).value).toBe('')
    })

    test('a change the server refuses, or that fails, says so and keeps what was typed', async () => {
      let store: any
      ;({ wrapper, store } = mountView())
      store.changeUserPassword.mockResolvedValueOnce(false)
      await typePasswords(wrapper, 'Plan2026!')
      await field(wrapper, 'settings-password').trigger('submit')
      await flushPromises()
      expect(snackbar).toHaveBeenLastCalledWith('An error occurred while updating the password', 'error')
      expect((field(wrapper, 'settings-new-password').element as HTMLInputElement).value).toBe('Plan2026!')

      vi.spyOn(console, 'error').mockImplementation(() => {})
      store.changeUserPassword.mockRejectedValueOnce(new Error('offline'))
      await field(wrapper, 'settings-password').trigger('submit')
      await flushPromises()
      expect(snackbar).toHaveBeenCalledTimes(2)
      expect(snackbar).toHaveBeenLastCalledWith('An error occurred while updating the password', 'error')
    })
  })
})
