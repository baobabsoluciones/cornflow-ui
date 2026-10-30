import { describe, test, expect, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ForceRetryConfirmDialog from '@cornflow-ui/core/components/core/table/ForceRetryConfirmDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      table: {
        forceRetry: {
          title: 'Force retry?',
          accept: 'Accept',
          reject: 'Reject',
        },
      },
    },
  },
})

// CoreDialog teleports to the body: the dialog is queried from the document.
describe('ForceRetryConfirmDialog', () => {
  let wrapper: any

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  const mountDialog = async (props = {}) => {
    wrapper = mount(ForceRetryConfirmDialog, {
      props: { modelValue: true, message: 'Other tables use these rows.', ...props },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await flushPromises()
    const buttons = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('.core-dialog__actions button'),
    )
    return { cancel: buttons[0], confirm: buttons[1] }
  }

  test('shows the server message with the force-retry texts', async () => {
    const { cancel, confirm } = await mountDialog()
    expect(document.body.querySelector('.core-dialog')?.textContent).toContain('Force retry?')
    expect(document.body.querySelector('.core-confirm-dialog__message')?.textContent).toBe(
      'Other tables use these rows.',
    )
    expect(confirm.textContent).toContain('Accept')
    expect(cancel.textContent).toContain('Reject')
  })

  test('going ahead is the destructive action', async () => {
    const { confirm } = await mountDialog()
    expect(confirm.classList).toContain('core-button--tone-danger')
  })

  test('confirming emits confirm', async () => {
    const { confirm } = await mountDialog()
    confirm.click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  test('rejecting emits cancel and closes', async () => {
    const { cancel } = await mountDialog()
    cancel.click()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  test('while retrying the confirm button spins and nothing can be rejected', async () => {
    const { cancel, confirm } = await mountDialog({ loading: true })
    expect(confirm.querySelector('.core-spinner')).not.toBeNull()
    expect(cancel.disabled).toBe(true)
  })

  test('is closed without an offer', async () => {
    await mountDialog({ modelValue: false })
    expect(document.body.querySelector('.core-confirm-dialog__message')).toBeNull()
  })
})
