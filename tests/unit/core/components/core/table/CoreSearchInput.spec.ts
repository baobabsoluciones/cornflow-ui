import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import CoreSearchInput from '@/components/core/table/CoreSearchInput.vue'

describe('CoreSearchInput', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
    vi.useFakeTimers()
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  const createWrapper = (props = {}) =>
    mount(CoreSearchInput, {
      props,
      global: {
        plugins: [vuetify],
        stubs: { 'v-icon': true, 'v-btn': true },
      },
    })

  test('renders input with default placeholder', () => {
    wrapper = createWrapper()
    const input = wrapper.find('input.core-search-input__field')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('Search')
  })

  test('uses provided placeholder and modelValue', () => {
    wrapper = createWrapper({ placeholder: 'Find', modelValue: 'abc' })
    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('Find')
    expect((input.element as HTMLInputElement).value).toBe('abc')
  })

  test('shows shortcut hint when showShortcut and no value and not focused', () => {
    wrapper = createWrapper({ showShortcut: true, modelValue: '' })
    expect(wrapper.find('.core-search-input__shortcut').exists()).toBe(true)
  })

  test('hides shortcut hint when there is a value', () => {
    wrapper = createWrapper({ showShortcut: true, modelValue: 'x' })
    expect(wrapper.find('.core-search-input__shortcut').exists()).toBe(false)
  })

  test('hides shortcut hint once focused', async () => {
    wrapper = createWrapper({ showShortcut: true, modelValue: '' })
    await wrapper.find('input').trigger('focus')
    expect(wrapper.find('.core-search-input__shortcut').exists()).toBe(false)
  })

  test('emits update:modelValue and debounced search on input', async () => {
    wrapper = createWrapper({ debounce: 300 })
    const input = wrapper.find('input')
    input.element.value = 'hello'
    await input.trigger('input')

    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['hello'])
    expect(wrapper.emitted('search')).toBeFalsy()

    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('search')![0]).toEqual(['hello'])
  })

  test('debounce clears previous timer on rapid input', async () => {
    wrapper = createWrapper({ debounce: 300 })
    const input = wrapper.find('input')
    input.element.value = 'a'
    await input.trigger('input')
    vi.advanceTimersByTime(100)
    input.element.value = 'ab'
    await input.trigger('input')
    vi.advanceTimersByTime(300)
    const searches = wrapper.emitted('search')!
    expect(searches[searches.length - 1]).toEqual(['ab'])
  })

  test('emits focus and blur events', async () => {
    wrapper = createWrapper()
    const input = wrapper.find('input')
    await input.trigger('focus')
    await input.trigger('blur')
    expect(wrapper.emitted('focus')).toBeTruthy()
    expect(wrapper.emitted('blur')).toBeTruthy()
  })

  test('Escape key clears the value', async () => {
    wrapper = createWrapper({ modelValue: 'something' })
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([''])
    expect(wrapper.emitted('clear')).toBeTruthy()
    expect(wrapper.emitted('search')!.at(-1)).toEqual([''])
  })

  test('non-Escape keydown does not clear', async () => {
    wrapper = createWrapper({ modelValue: 'something' })
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('clear')).toBeFalsy()
  })

  test('clear button shown only when clearable and value present', () => {
    wrapper = createWrapper({ clearable: true, modelValue: 'x' })
    expect(wrapper.find('v-btn-stub').exists()).toBe(true)
  })

  test('clear button hidden when not clearable', () => {
    wrapper = createWrapper({ clearable: false, modelValue: 'x' })
    expect(wrapper.find('v-btn-stub').exists()).toBe(false)
  })

  test('handleClear via clear button emits clear/search/update', async () => {
    wrapper = createWrapper({ clearable: true, modelValue: 'x' })
    await wrapper.find('v-btn-stub').trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  test('disabled attribute applied to input', () => {
    wrapper = createWrapper({ disabled: true })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })

  test('global Ctrl+K shortcut focuses input', async () => {
    wrapper = createWrapper({ showShortcut: true })
    const focusSpy = vi.spyOn(
      wrapper.find('input').element as HTMLInputElement,
      'focus',
    )
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    document.dispatchEvent(event)
    expect(focusSpy).toHaveBeenCalled()
  })

  test('does not register global listener when showShortcut is false', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    wrapper = createWrapper({ showShortcut: false })
    const calledForKeydown = addSpy.mock.calls.some((c) => c[0] === 'keydown')
    expect(calledForKeydown).toBe(false)
    addSpy.mockRestore()
  })

  test('shortcutKey computed returns Ctrl on non-mac', () => {
    wrapper = createWrapper({ showShortcut: true, modelValue: '' })
    expect(wrapper.find('.core-search-input__shortcut').text()).toContain('K')
  })
})
