import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import CoreSnackbar from '@cornflow-ui/core/components/core/CoreSnackbar.vue'
import type { SnackbarState } from '@cornflow-ui/core/services/SnackbarService'

// Stub v-snackbar (a VOverlay) so it renders inline without jsdom visualViewport errors
const snackbarStub = {
  name: 'v-snackbar',
  props: ['modelValue', 'color', 'timeout'],
  emits: ['update:modelValue'],
  template: '<div class="v-snackbar-stub"><slot /><slot name="actions" /></div>',
}

describe('CoreSnackbar', () => {
  let vuetify: any
  let wrapper: any
  let snackbar: SnackbarState

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
    snackbar = reactive<SnackbarState>({
      show: false,
      message: '',
      fullMessage: null,
      color: 'var(--success)',
      timeout: 3000,
    })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    vi.restoreAllMocks()
  })

  const createWrapper = (props = {}) => {
    const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
    return mount(CoreSnackbar, {
      props,
      global: {
        plugins: [vuetify, i18n],
        provide: { snackbar },
        stubs: { 'v-snackbar': snackbarStub, 'v-btn': true, 'v-icon': true },
      },
    })
  }

  test('does not render snackbar when show is false', () => {
    wrapper = createWrapper()
    expect(wrapper.find('.v-snackbar-stub').exists()).toBe(false)
  })

  test('renders snackbar with message when show is true', async () => {
    wrapper = createWrapper()
    snackbar.show = true
    snackbar.message = 'Hello world'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.v-snackbar-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('Hello world')
  })

  test('effectiveTimeout uses service timeout when set', () => {
    snackbar.timeout = 5000
    wrapper = createWrapper({ timeout: 1000 })
    expect((wrapper.vm as any).effectiveTimeout).toBe(5000)
  })

  test('effectiveTimeout falls back to prop when service timeout falsy', () => {
    snackbar.timeout = 0 as any
    wrapper = createWrapper({ timeout: 7777 })
    expect((wrapper.vm as any).effectiveTimeout).toBe(7777)
  })

  test('handleClose sets show false and clears fullMessage', async () => {
    wrapper = createWrapper()
    snackbar.show = true
    snackbar.fullMessage = 'big message'
    ;(wrapper.vm as any).handleClose()
    expect(snackbar.show).toBe(false)
    expect(snackbar.fullMessage).toBe(null)
  })

  test('onSnackbarModelUpdate(false) closes; (true) does nothing', () => {
    wrapper = createWrapper()
    snackbar.show = true
    ;(wrapper.vm as any).onSnackbarModelUpdate(true)
    expect(snackbar.show).toBe(true)
    ;(wrapper.vm as any).onSnackbarModelUpdate(false)
    expect(snackbar.show).toBe(false)
  })

  test('renders download button only when fullMessage present', async () => {
    wrapper = createWrapper()
    snackbar.show = true
    snackbar.message = 'short'
    await wrapper.vm.$nextTick()
    let btns = wrapper.findAll('v-btn-stub')
    // only the close button
    expect(btns.length).toBe(1)

    snackbar.fullMessage = 'the full long message'
    await wrapper.vm.$nextTick()
    btns = wrapper.findAll('v-btn-stub')
    expect(btns.length).toBe(2)
  })

  test('downloadFullMessage no-ops when fullMessage null', () => {
    wrapper = createWrapper()
    const createSpy = vi.spyOn(document, 'createElement')
    ;(wrapper.vm as any).downloadFullMessage()
    expect(createSpy).not.toHaveBeenCalled()
  })

  test('downloadFullMessage creates and clicks an anchor when fullMessage set', () => {
    wrapper = createWrapper()
    snackbar.fullMessage = 'A long message to download'
    const clickSpy = vi.fn()
    const anchor = { href: '', download: '', click: clickSpy } as any
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(anchor)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    ;(wrapper.vm as any).downloadFullMessage()

    expect(createSpy).toHaveBeenCalledWith('a')
    expect(anchor.download).toMatch(/^message-.*\.txt$/)
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeSpy).toHaveBeenCalledWith('blob:url')
  })
})
