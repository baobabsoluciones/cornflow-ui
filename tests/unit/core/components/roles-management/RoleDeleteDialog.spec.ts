import { describe, test, expect, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RoleDeleteDialog from '@cornflow-ui/core/components/roles-management/RoleDeleteDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      rolesManagement: {
        deleteRoleTitle: 'Delete role',
        deleteRoleMessage: 'Delete the role "{name}"?',
        delete: 'Delete',
        cancel: 'Cancel',
      },
    },
  },
})

// CoreDialog teleports to the body: the dialog is queried from the document.
describe('RoleDeleteDialog', () => {
  let wrapper: any

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  const mountDialog = async (props = {}) => {
    wrapper = mount(RoleDeleteDialog, {
      props: { modelValue: true, role: { id: 3, name: 'Planner' }, deleting: false, ...props },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await flushPromises()
    const buttons = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('.core-dialog__actions button'),
    )
    return { cancel: buttons[0], confirm: buttons[1] }
  }

  test('asks about the role by its name', async () => {
    const { cancel, confirm } = await mountDialog()
    const dialog = document.body.querySelector('.core-dialog')!
    expect(dialog.textContent).toContain('Delete role')
    expect(dialog.textContent).toContain('Delete the role "Planner"?')
    expect(cancel.textContent).toContain('Cancel')
    expect(confirm.textContent).toContain('Delete')
  })

  test('deleting is the destructive action', async () => {
    const { confirm } = await mountDialog()
    expect(confirm.classList).toContain('core-button--tone-danger')
  })

  test('confirming emits confirm and leaves closing to the view', async () => {
    const { confirm } = await mountDialog()
    confirm.click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('cancelling closes it', async () => {
    const { cancel } = await mountDialog()
    cancel.click()
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  test('while deleting the confirm button spins and nothing can be cancelled', async () => {
    const { cancel, confirm } = await mountDialog({ deleting: true })
    expect(confirm.querySelector('.core-spinner')).not.toBeNull()
    expect(cancel.disabled).toBe(true)
  })
})
