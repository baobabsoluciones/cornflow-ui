import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import ForceRetryConfirmDialog from '@/components/core/table/ForceRetryConfirmDialog.vue'

// Stub v-dialog so the card content renders inline (no jsdom overlay errors)
const dialogStub = {
  name: 'v-dialog',
  props: ['modelValue'],
  template: '<div class="v-dialog-stub"><slot /></div>',
}

describe('ForceRetryConfirmDialog', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const createWrapper = (props = {}) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
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
    return mount(ForceRetryConfirmDialog, {
      props: { modelValue: true, message: 'Some error', ...props },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-dialog': dialogStub,
          'v-icon': true,
          CoreButton: {
            name: 'CoreButton',
            props: ['text', 'loading', 'disabled'],
            template:
              '<button class="core-button-stub" :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button>',
          },
        },
      },
    })
  }

  test('renders title and message', () => {
    wrapper = createWrapper({ message: 'Cannot overwrite' })
    expect(wrapper.text()).toContain('Force retry?')
    expect(wrapper.find('.force-retry-confirm-dialog__message').text()).toBe(
      'Cannot overwrite',
    )
  })

  test('renders accept and reject buttons via i18n', () => {
    wrapper = createWrapper()
    const btns = wrapper.findAll('.core-button-stub')
    expect(btns[0].text()).toBe('Reject')
    expect(btns[1].text()).toBe('Accept')
  })

  test('clicking accept emits confirm', async () => {
    wrapper = createWrapper()
    await wrapper.findAll('.core-button-stub')[1].trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  test('clicking reject emits cancel and update:modelValue false', async () => {
    wrapper = createWrapper()
    await wrapper.findAll('.core-button-stub')[0].trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  test('close icon button triggers cancel', async () => {
    wrapper = createWrapper()
    // the close v-btn is rendered as real vuetify button
    await wrapper.find('button.force-retry-confirm-dialog__close').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  test('buttons disabled while loading', () => {
    wrapper = createWrapper({ loading: true })
    const btns = wrapper.findAll('.core-button-stub')
    expect(btns[0].attributes('disabled')).toBeDefined()
    expect(btns[1].attributes('disabled')).toBeDefined()
  })

  test('loading defaults to false', () => {
    wrapper = createWrapper()
    expect((wrapper.vm as any).loading).toBe(false)
  })
})
