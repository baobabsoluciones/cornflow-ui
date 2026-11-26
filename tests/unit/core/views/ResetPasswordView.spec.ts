import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

const { cornflowAuth, snackbar } = vi.hoisted(() => ({
  cornflowAuth: { resetPassword: vi.fn() },
  snackbar: vi.fn(),
}))

vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({
  getSpecificAuthService: vi.fn(async () => cornflowAuth),
}))
vi.mock('@cornflow-ui/core/services/SnackbarService', () => ({ showSnackbar: snackbar }))
vi.mock('@cornflow-ui/core/utils/passwordPolicy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cornflow-ui/core/utils/passwordPolicy')>()
  // Any password of 12 characters or more counts as unguessable here.
  return { ...actual, loadStrengthScorer: async () => (password: string) => (password.length >= 12 ? 4 : 0) }
})

import ResetPasswordView from '@cornflow-ui/core/views/ResetPasswordView.vue'

const STRONG = 'Granite-Orbit-47x'

async function mountView(path = '/reset-password?token=link-token') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reset-password', component: ResetPasswordView },
      { path: '/sign-in', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false })
  const wrapper = mount(ResetPasswordView, {
    global: { plugins: [i18n, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

const field = (wrapper: any, id: string) => wrapper.find(`[data-testid="${id}"]`)

async function typePasswords(wrapper: any, password: string, repeated = password) {
  await field(wrapper, 'reset-password-new').setValue(password)
  await field(wrapper, 'reset-password-confirm').setValue(repeated)
}

describe('ResetPasswordView', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => wrapper?.unmount())

  test('takes the token out of the address at once', async () => {
    let router: any
    ;({ wrapper, router } = await mountView())

    expect(router.currentRoute.value.fullPath).toBe('/reset-password')
  })

  test('without a token, says the page needs the e-mailed link', async () => {
    ;({ wrapper } = await mountView('/reset-password'))

    expect(field(wrapper, 'reset-password-missing-token').exists()).toBe(true)
    expect(field(wrapper, 'reset-password-form').exists()).toBe(false)
  })

  test('is sent only once the new password meets the policy twice', async () => {
    ;({ wrapper } = await mountView())
    const submit = () => field(wrapper, 'reset-password-submit')

    await typePasswords(wrapper, 'short')
    expect(submit().attributes('disabled')).toBeDefined()

    await typePasswords(wrapper, STRONG, `${STRONG}?`)
    expect(submit().attributes('disabled')).toBeDefined()

    await typePasswords(wrapper, STRONG)
    expect(submit().attributes('disabled')).toBeUndefined()
  })

  test('saves it with the link token and goes to sign in', async () => {
    cornflowAuth.resetPassword.mockResolvedValue({ success: true })
    let router: any
    ;({ wrapper, router } = await mountView())

    await typePasswords(wrapper, STRONG)
    await field(wrapper, 'reset-password-form').trigger('submit')
    await flushPromises()

    expect(cornflowAuth.resetPassword).toHaveBeenCalledWith('link-token', STRONG)
    expect(snackbar).toHaveBeenCalledWith('resetPassword.success', 'success')
    expect(router.currentRoute.value.path).toBe('/sign-in')
  })

  test('an expired or used link says so and offers no form', async () => {
    cornflowAuth.resetPassword.mockResolvedValue({ success: false, linkInvalid: true })
    ;({ wrapper } = await mountView())

    await typePasswords(wrapper, STRONG)
    await field(wrapper, 'reset-password-form').trigger('submit')
    await flushPromises()

    expect(field(wrapper, 'reset-password-link-expired').exists()).toBe(true)
    expect(field(wrapper, 'reset-password-form').exists()).toBe(false)
  })

  test('a password cornflow refuses says why', async () => {
    cornflowAuth.resetPassword.mockResolvedValue({
      success: false,
      message: 'The password has been used recently',
    })
    ;({ wrapper } = await mountView())

    await typePasswords(wrapper, STRONG)
    await field(wrapper, 'reset-password-form').trigger('submit')
    await flushPromises()

    expect(snackbar).toHaveBeenCalledWith('The password has been used recently', 'error')
  })
})
