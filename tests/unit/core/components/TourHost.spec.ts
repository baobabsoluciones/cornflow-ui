import { describe, test, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import TourHost from '@cornflow-ui/core/components/TourHost.vue'
import config from '@cornflow-ui/core/config'
import { useTour } from '@cornflow-ui/core/composables/onboarding/useTour'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      onboarding: {
        back: 'Back',
        next: 'Next',
        done: 'Done',
        close: 'Close the tour',
        progress: 'Step {current} of {total}',
        sample: {
          welcome: { title: 'Welcome to {app}', text: 'In a minute, the parts of the app.' },
          help: { title: 'Help', text: 'The manual and this tour.' },
        },
      },
    },
  },
})

const card = () => document.querySelector('[data-testid="core-tour-card"]')

let wrapper: any

afterEach(() => {
  useTour().stop()
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('TourHost', () => {
  test('shows the tour started, its texts in the language of the app, and gives the focus back after', async () => {
    const help = document.createElement('button')
    help.dataset.tour = 'help-menu'
    config.name = 'Planner'
    document.body.appendChild(help)
    wrapper = mount(TourHost, { attachTo: document.body, global: { plugins: [i18n] } })
    expect(card()).toBeNull()

    await useTour().start({ key: 'sample', steps: [{ key: 'welcome' }, { key: 'help', target: 'help-menu' }] })
    await nextTick()
    expect(card()!.textContent).toContain('Welcome to Planner')
    expect(card()!.textContent).toContain('Step 1 of 2')

    document.querySelector<HTMLElement>('[data-testid="core-tour-next"]')!.click()
    await nextTick()
    expect(card()!.textContent).toContain('The manual and this tour.')

    document.querySelector<HTMLElement>('[data-testid="core-tour-next"]')!.click()
    await nextTick()
    await nextTick()
    expect(card()).toBeNull()
    expect(document.activeElement).toBe(help)
  })
})
