import { describe, test, expect, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import UserRolesDialog from '@cornflow-ui/core/components/roles-management/UserRolesDialog.vue'

const user = (overrides: any = {}) => ({
  id: 1,
  username: 'jdoe',
  full_name: 'John Doe',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  role_names: ['admin'],
  _role_ids: [1],
  ...overrides,
})

// CoreDialog teleports to the body: the dialog is queried from the document.
describe('UserRolesDialog', () => {
  let wrapper: any

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: {} },
  })

  const createWrapper = async (props = {}) => {
    wrapper = mount(UserRolesDialog, {
      props: {
        modelValue: true,
        user: user(),
        roles: [
          { id: 1, name: 'admin' },
          { id: 2, name: 'viewer' },
        ],
        saving: false,
        ...props,
      },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  const dialog = () => document.body.querySelector('.core-dialog')!
  const inputs = () => Array.from(dialog().querySelectorAll<HTMLInputElement>('input'))
  const checkboxes = () => Array.from(dialog().querySelectorAll<HTMLButtonElement>('[role="checkbox"]'))
  const button = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('.core-dialog__actions button')).find((b) =>
      b.textContent?.includes(text),
    )!

  const type = async (field: HTMLInputElement, value: string) => {
    field.value = value
    field.dispatchEvent(new Event('input'))
    await nextTick()
  }

  describe('rendering', () => {
    test('shows the username in the user pill', async () => {
      await createWrapper()
      expect(dialog().querySelector('.user-info-pill')?.textContent).toContain('jdoe')
    })

    test('seeds the profile fields from the user', async () => {
      await createWrapper()
      expect(inputs().map((i) => i.value)).toEqual(['John', 'Doe', 'john@example.com'])
      expect(inputs()[2].type).toBe('email')
    })

    test('seeds an empty email when the user has none', async () => {
      await createWrapper({ user: user({ email: '' }) })
      expect(inputs()[2].value).toBe('')
    })

    test('handles a null user', async () => {
      await createWrapper({ user: null })
      expect(dialog()).not.toBeNull()
    })
  })

  describe('roles', () => {
    test('shows a checkbox per role, ticked for the roles of the user', async () => {
      await createWrapper()
      expect(checkboxes().map((c) => c.textContent?.trim())).toEqual(['admin', 'viewer'])
      expect(checkboxes().map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    })

    test('says there are no roles when the app has none', async () => {
      await createWrapper({ roles: [] })
      expect(checkboxes()).toHaveLength(0)
      expect(dialog().querySelector('.user-roles__none')?.textContent).toContain(
        'rolesManagement.noRoles',
      )
    })

    test('ticking and unticking a role changes the selected names', async () => {
      await createWrapper()
      checkboxes()[1].click()
      await nextTick()
      expect(wrapper.vm.selectedNames).toEqual(['admin', 'viewer'])
      checkboxes()[0].click()
      await nextTick()
      expect(wrapper.vm.selectedNames).toEqual(['viewer'])
    })

    test('re-seeds the roles when reopened for a different user', async () => {
      await createWrapper({ modelValue: false, user: user({ id: 1, role_names: ['admin'] }) })
      await wrapper.setProps({
        modelValue: true,
        user: user({ id: 2, role_names: ['viewer'] }),
      })
      await flushPromises()
      expect(wrapper.vm.selectedNames).toEqual(['viewer'])
      expect(checkboxes().map((c) => c.getAttribute('aria-checked'))).toEqual(['false', 'true'])
    })
  })

  describe('email validation', () => {
    test('an invalid email marks the field, explains it and blocks saving', async () => {
      await createWrapper()
      await type(inputs()[2], 'not-an-email')
      expect(dialog().querySelector('.core-text-field.is-invalid')).not.toBeNull()
      const error = dialog().querySelector('.user-roles__error')!
      expect(error.textContent).toContain('rolesManagement.invalidEmail')
      expect(inputs()[2].getAttribute('aria-describedby')).toBe(error.id)
      expect(button('rolesManagement.save').disabled).toBe(true)
    })

    test('an empty email is allowed', async () => {
      await createWrapper()
      await type(inputs()[2], '')
      expect(dialog().querySelector('.user-roles__error')).toBeNull()
      expect(button('rolesManagement.save').disabled).toBe(false)
    })
  })

  describe('save behaviour', () => {
    test('emits save with the user, the trimmed profile and the selected role names', async () => {
      await createWrapper()
      await type(inputs()[0], '  Jane ')
      checkboxes()[1].click()
      await nextTick()
      button('rolesManagement.save').click()
      const payload = wrapper.emitted('save')![0][0] as any
      expect(payload.user.id).toBe(1)
      expect(payload.profile).toEqual({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'john@example.com',
      })
      expect(payload.roleNames).toEqual(['admin', 'viewer'])
    })

    test('does not emit save when the user is null', async () => {
      await createWrapper({ user: null })
      wrapper.vm.onSave()
      expect(wrapper.emitted('save')).toBeFalsy()
    })

    test('the save button spins and is disabled while saving', async () => {
      await createWrapper({ saving: true })
      const save = button('rolesManagement.save')
      expect(save.disabled).toBe(true)
      expect(save.querySelector('.core-spinner')).not.toBeNull()
    })
  })

  describe('close behaviour', () => {
    test('the cancel button emits update:modelValue false', async () => {
      await createWrapper()
      button('rolesManagement.cancel').click()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })
  })
})
