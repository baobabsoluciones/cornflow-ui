import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ParameterInput from '@cornflow-ui/core/components/create-execution/ParameterInput.vue'

const mountInput = (field: Record<string, any>, value?: unknown, extra: Record<string, any> = {}) =>
  mount(ParameterInput, {
    props: { field: { key: 'p', label: 'P', options: [], ...field }, value, inputId: 'param-p', ...extra },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false })],
    },
  })

const option = (n: number) => ({ value: `v${n}`, label: `Option ${n}` })

describe('ParameterInput', () => {
  test('three options or fewer are a row of buttons, the picked one on', async () => {
    const wrapper = mountInput({ type: 'options', options: [option(1), option(2), option(3)] }, 'v2', { invalid: true })
    const buttons = wrapper.findAll('[role="radio"]')

    expect(buttons.map((b) => b.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(buttons[0].classes()).toContain('is-invalid')
    await buttons[2].trigger('click')
    expect(wrapper.emitted('change')).toEqual([['v3']])
  })

  test('more options are a dropdown', async () => {
    const wrapper = mountInput({ type: 'options', options: [option(1), option(2), option(3), option(4)] })

    expect(wrapper.find('[role="radio"]').exists()).toBe(false)
    await wrapper.find('select').setValue('3')
    expect(wrapper.emitted('change')).toEqual([['v4']])
  })

  test('a yes/no is a switch that flips', async () => {
    const wrapper = mountInput({ type: 'boolean' }, true)
    const toggle = wrapper.find('[role="switch"]')

    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(toggle.text()).toBe('createExecution.parameters.yes')
    await toggle.trigger('click')
    expect(wrapper.emitted('change')).toEqual([[false]])
  })

  test.each([
    ['number', 'number', '42', 42],
    ['float', 'number', '0.5', 0.5],
    ['date', 'date', '2026-11-02', '2026-11-02'],
    ['text', 'text', 'north', 'north'],
  ])('a %s is a %s field that gives its value when it changes', async (type, inputType, typed, given) => {
    const wrapper = mountInput({ type, suffix: type === 'number' ? 'sec' : undefined })
    const input = wrapper.find('input')

    expect(input.attributes('type')).toBe(inputType)
    expect(input.attributes('id')).toBe('param-p')
    input.element.value = typed
    await input.trigger('input')
    expect(wrapper.emitted('change')).toBeUndefined()
    await input.trigger('change')
    expect(wrapper.emitted('change')).toEqual([[given]])
  })

  test('a number shows its suffix', () => {
    expect(mountInput({ type: 'number', suffix: 'sec' }).text()).toContain('sec')
  })
})
