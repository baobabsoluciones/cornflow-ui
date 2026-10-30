import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@cornflow-ui/core/plugins/locales/en'
import ExitCreateExecutionDialog from '@cornflow-ui/core/components/create-execution/ExitCreateExecutionDialog.vue'

const CoreDialogStub = {
  name: 'CoreDialog',
  props: ['modelValue', 'title', 'persistent'],
  emits: ['update:modelValue'],
  template: `
    <div v-if="modelValue" class="dialog-stub" :data-persistent="String(persistent)">
      <h2>{{ title }}</h2>
      <slot />
      <slot name="actions" />
    </div>`,
}

const mountDialog = (props: { modelValue: boolean; saving?: boolean }) =>
  mount(ExitCreateExecutionDialog, {
    props,
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: { CoreDialog: CoreDialogStub },
    },
  })

const button = (wrapper: ReturnType<typeof mountDialog>, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)!

describe('ExitCreateExecutionDialog', () => {
  test('is closed until the view asks', () => {
    expect(mountDialog({ modelValue: false }).find('.dialog-stub').exists()).toBe(false)
  })

  test('warns that leaving loses the work, and offers to save it as a draft', () => {
    const wrapper = mountDialog({ modelValue: true })

    expect(wrapper.text()).toContain('Leave the new execution')
    expect(wrapper.text()).toContain('You can save it as a draft')
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual([
      'Leave without saving',
      'Cancel',
      'Save draft and leave',
    ])
  })

  test('each button says what the user chose', async () => {
    const wrapper = mountDialog({ modelValue: true })

    await wrapper.find('[data-testid="exit-save"]').trigger('click')
    await wrapper.find('[data-testid="exit-leave"]').trigger('click')
    await button(wrapper, 'Cancel').trigger('click')

    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('leave')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  test('closing it is staying', async () => {
    const wrapper = mountDialog({ modelValue: true })

    wrapper.findComponent(CoreDialogStub).vm.$emit('update:modelValue', false)

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  test('while the draft is saved it cannot be closed, and only the save shows progress', () => {
    const wrapper = mountDialog({ modelValue: true, saving: true })

    expect(wrapper.find('.dialog-stub').attributes('data-persistent')).toBe('true')
    expect(wrapper.find('[data-testid="exit-leave"]').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'Cancel').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="exit-save"]').attributes('aria-busy')).toBe('true')
  })
})
