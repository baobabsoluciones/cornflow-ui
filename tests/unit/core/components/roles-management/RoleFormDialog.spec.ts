import { describe, test, expect, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import RoleFormDialog from '@cornflow-ui/core/components/roles-management/RoleFormDialog.vue'

// CoreDialog teleports to the body: the dialog is queried from the document.
describe('RoleFormDialog', () => {
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
    wrapper = mount(RoleFormDialog, {
      props: { modelValue: true, role: null, saving: false, ...props },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  const dialog = () => document.body.querySelector('.core-dialog')
  const input = () => document.body.querySelector<HTMLInputElement>('.core-dialog input')!
  const button = (text: string) =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('.core-dialog__actions button')).find(
      (b) => b.textContent?.includes(text),
    )!

  const type = async (value: string) => {
    input().value = value
    input().dispatchEvent(new Event('input'))
    await nextTick()
  }

  describe('create vs edit mode', () => {
    test('opens in create mode with an empty form', async () => {
      await createWrapper({ role: null })
      expect(dialog()?.textContent).toContain('rolesManagement.addRole')
      expect(dialog()?.querySelector('.mdi-plus-circle-outline')).not.toBeNull()
      expect(input().value).toBe('')
    })

    test('opens in edit mode pre-filled with the role values', async () => {
      await createWrapper({ role: { id: 7, name: 'admin' } })
      expect(dialog()?.textContent).toContain('rolesManagement.editRole')
      expect(dialog()?.querySelector('.mdi-pencil-outline')).not.toBeNull()
      expect(input().value).toBe('admin')
    })

    test('labels the field with the role name', async () => {
      await createWrapper()
      expect(input().closest('label')?.textContent).toContain('rolesManagement.roleName')
    })

    test('re-seeds the form each time the dialog reopens', async () => {
      await createWrapper({ modelValue: false, role: null })
      await wrapper.setProps({ modelValue: true, role: { id: 3, name: 'planner' } })
      await flushPromises()
      expect(wrapper.vm.isEdit).toBe(true)
      expect(input().value).toBe('planner')
    })

    test('keeps the form as it was when the dialog closes', async () => {
      await createWrapper({ modelValue: true, role: { id: 1, name: 'admin' } })
      await wrapper.setProps({ modelValue: false })
      await nextTick()
      expect(wrapper.vm.form.name).toBe('admin')
    })
  })

  describe('save behaviour', () => {
    test('emits save with the trimmed name', async () => {
      await createWrapper({ role: null })
      await type('  Planner  ')
      button('rolesManagement.save').click()
      expect(wrapper.emitted('save')![0][0]).toEqual({ name: 'Planner' })
    })

    test('emits save with the id when editing', async () => {
      await createWrapper({ role: { id: 4, name: 'viewer' } })
      await type('Reader')
      button('rolesManagement.save').click()
      expect(wrapper.emitted('save')![0][0]).toEqual({ id: 4, name: 'Reader' })
    })

    test('the save button is disabled while the name is blank', async () => {
      await createWrapper({ role: null })
      expect(button('rolesManagement.save').disabled).toBe(true)
      await type('   ')
      expect(button('rolesManagement.save').disabled).toBe(true)
      await type('Planner')
      expect(button('rolesManagement.save').disabled).toBe(false)
    })

    test('does not emit save when the name is blank', async () => {
      await createWrapper({ role: null })
      wrapper.vm.form.name = '   '
      wrapper.vm.onSave()
      expect(wrapper.emitted('save')).toBeFalsy()
    })

    test('the save button spins and is disabled while saving', async () => {
      await createWrapper({ role: { id: 1, name: 'admin' }, saving: true })
      const save = button('rolesManagement.save')
      expect(save.disabled).toBe(true)
      expect(save.querySelector('.core-spinner')).not.toBeNull()
    })

    test('Enter in the field saves', async () => {
      await createWrapper({ role: { id: 1, name: 'admin' } })
      input().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
      expect(wrapper.emitted('save')![0][0]).toEqual({ id: 1, name: 'admin' })
    })
  })

  describe('close behaviour', () => {
    test('the cancel button emits update:modelValue false', async () => {
      await createWrapper()
      button('rolesManagement.cancel').click()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    test('Escape does not close it', async () => {
      await createWrapper()
      document.body
        .querySelector('[role="dialog"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flushPromises()
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })
  })
})
