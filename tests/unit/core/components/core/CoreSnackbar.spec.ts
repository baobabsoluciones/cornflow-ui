import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import CoreSnackbar from '@cornflow-ui/core/components/core/CoreSnackbar.vue'
import {
  SNACKBAR_COLORS,
  type SnackbarState,
} from '@cornflow-ui/core/services/SnackbarService'

describe('CoreSnackbar', () => {
  let snackbar: SnackbarState

  beforeEach(() => {
    vi.useFakeTimers()
    snackbar = reactive<SnackbarState>({
      show: false,
      message: '',
      fullMessage: null,
      color: SNACKBAR_COLORS.success,
      timeout: 3000,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const createWrapper = (props = {}) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          common: { close: 'Close' },
          table: { downloadFullMessage: 'Download' },
        },
      },
    })
    return mount(CoreSnackbar, {
      props,
      global: {
        plugins: [i18n],
        provide: { snackbar },
        stubs: { teleport: true },
      },
    })
  }

  const show = async (
    wrapper: ReturnType<typeof createWrapper>,
    message: string,
  ) => {
    snackbar.show = true
    snackbar.message = message
    await wrapper.vm.$nextTick()
  }

  test('shows nothing while there is no message', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('[data-testid="core-snackbar"]').exists()).toBe(false)
  })

  test('shows the message, announced politely', async () => {
    const wrapper = createWrapper()
    await show(wrapper, 'Hello world')

    const toast = wrapper.find('[data-testid="core-snackbar"]')
    expect(toast.text()).toContain('Hello world')
    expect(toast.attributes('role')).toBe('status')
    expect(toast.find('.mdi-check-circle').exists()).toBe(true)
  })

  test('announces an error at once, with the error icon', async () => {
    snackbar.color = SNACKBAR_COLORS.error
    const wrapper = createWrapper()
    await show(wrapper, 'It failed')

    const toast = wrapper.find('[data-testid="core-snackbar"]')
    expect(toast.attributes('role')).toBe('alert')
    expect(toast.find('.mdi-alert-circle').exists()).toBe(true)
  })

  test('hides itself after the timeout of the message', async () => {
    const wrapper = createWrapper()
    await show(wrapper, 'Saved')

    vi.advanceTimersByTime(2999)
    expect(snackbar.show).toBe(true)
    vi.advanceTimersByTime(1)
    expect(snackbar.show).toBe(false)
  })

  test('a new message starts its own countdown', async () => {
    const wrapper = createWrapper()
    await show(wrapper, 'First')
    vi.advanceTimersByTime(2000)

    await show(wrapper, 'Second')
    vi.advanceTimersByTime(2000)
    expect(snackbar.show).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(snackbar.show).toBe(false)
  })

  test('uses the service timeout when set, and the prop otherwise', async () => {
    snackbar.timeout = 0
    const wrapper = createWrapper({ timeout: 500 })
    await show(wrapper, 'Quick')

    vi.advanceTimersByTime(500)
    expect(snackbar.show).toBe(false)
  })

  test('the close button hides it and drops the full message', async () => {
    const wrapper = createWrapper()
    snackbar.fullMessage = 'big message'
    await show(wrapper, 'big…')

    const close = wrapper.find('[data-testid="core-snackbar-close"]')
    expect(close.attributes('aria-label')).toBe('Close')
    await close.trigger('click')

    expect(snackbar.show).toBe(false)
    expect(snackbar.fullMessage).toBe(null)
  })

  test('offers the full message only when it was truncated', async () => {
    const wrapper = createWrapper()
    await show(wrapper, 'short')
    expect(
      wrapper.find('[data-testid="core-snackbar-download"]').exists(),
    ).toBe(false)

    snackbar.fullMessage = 'the full long message'
    await wrapper.vm.$nextTick()
    expect(
      wrapper.find('[data-testid="core-snackbar-download"]').exists(),
    ).toBe(true)
  })

  test('downloads the full message as a text file', async () => {
    const wrapper = createWrapper()
    snackbar.fullMessage = 'A long message to download'
    await show(wrapper, 'A long…')

    const clickSpy = vi.fn()
    const anchor = {
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(anchor)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})

    await wrapper
      .find('[data-testid="core-snackbar-download"]')
      .trigger('click')

    expect(createSpy).toHaveBeenCalledWith('a')
    expect(anchor.download).toMatch(/^message-.*\.txt$/)
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeSpy).toHaveBeenCalledWith('blob:url')
  })
})
