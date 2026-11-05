import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@cornflow-ui/core/plugins/locales/en'
import ChecksExample from '@cornflow-ui/core/components/onboarding/ChecksExample.vue'

describe('ChecksExample', () => {
  test('shows a check with errors and one with warnings, in the language of the app', () => {
    const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
    const wrapper = mount(ChecksExample, { global: { plugins: [i18n] } })
    const results = wrapper.findAll('.checks-status__result')
    expect(results.map((result) => result.text())).toEqual([
      'Products without a price3',
      'Orders with a past date12',
    ])
    expect(results[0].find('.is-danger').exists()).toBe(true)
    expect(results[1].find('.is-warning').exists()).toBe(true)
  })
})
