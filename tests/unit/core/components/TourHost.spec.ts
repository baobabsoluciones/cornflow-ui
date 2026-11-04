import { describe, test, expect, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, effectScope, h, markRaw, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import TourHost from '@cornflow-ui/core/components/TourHost.vue'
import config from '@cornflow-ui/core/config'
import {
  onTourReveal,
  provideTourTerms,
  useTour,
} from '@cornflow-ui/core/composables/onboarding/useTour'

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
          modes: {
            title: 'Upload modes',
            text: 'You choose how:',
            terms: { append: { title: 'Append', text: 'Adds the rows.' } },
          },
          example: { title: 'An example', text: 'This is how it looks.' },
          opened: { title: 'Opened', text: 'The panel it opens.' },
        },
      },
    },
  },
})

const card = () => document.querySelector('[data-testid="core-tour-card"]')

const terms = () =>
  [...document.querySelectorAll('[data-testid="tour-terms"] div')].map(
    (term) => `${term.querySelector('dt')!.textContent}: ${term.querySelector('dd')!.textContent}`,
  )

const place = (target: string) => {
  const element = document.createElement('div')
  element.dataset.tour = target
  document.body.appendChild(element)
  return element
}

/** Lets the host find the part of the step, a few frames on. */
const settle = async () => {
  for (let frame = 0; frame < 40; frame++) {
    await flushPromises()
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

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

  test('the card lists the terms of the step, and those a page gives it', async () => {
    place('upload')
    wrapper = mount(TourHost, { attachTo: document.body, global: { plugins: [i18n] } })
    await useTour().start({
      key: 'sample',
      steps: [
        { key: 'modes', target: 'upload', terms: ['append'] },
        { key: 'help', target: 'upload' },
      ],
    })
    await settle()
    expect(terms()).toEqual(['Append: Adds the rows.'])

    const scope = effectScope()
    scope.run(() => provideTourTerms('upload', () => [{ title: 'Replace', text: 'Keeps only the file.' }]))
    useTour().next()
    await settle()
    expect(terms()).toEqual(['Replace: Keeps only the file.'])
    scope.stop()
  })

  test('the card shows the example of the step, out of reach', async () => {
    wrapper = mount(TourHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const Example = defineComponent({ render: () => h('button', { type: 'button' }, 'Run checks') })
    await useTour().start({ key: 'sample', steps: [{ key: 'example', example: markRaw(Example) }] })
    await settle()
    const example = document.querySelector('[data-testid="tour-example"]')!
    expect(example.textContent).toContain('Run checks')
    expect(example.hasAttribute('inert')).toBe(true)
  })

  test('points at the part a step opens once it shows, and leaves the step out if it never does', async () => {
    place('trigger')
    wrapper = mount(TourHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const scope = effectScope()
    let opened: HTMLElement | null = null
    scope.run(() =>
      onTourReveal('panel', () => {
        opened = place('panel')
        return () => opened?.remove()
      }),
    )
    await useTour().start({
      key: 'sample',
      steps: [
        { key: 'opened', target: 'panel', shownWith: 'trigger', reveal: 'panel' },
        { key: 'help', target: 'never', shownWith: 'trigger' },
        { key: 'welcome' },
      ],
    })
    await settle()
    expect(card()!.textContent).toContain('The panel it opens.')
    expect(wrapper.findComponent({ name: 'CoreTour' }).props('target')).toBe(opened)

    useTour().next()
    await settle()
    expect(useTour().steps.value.map((step) => step.key)).toEqual(['opened', 'welcome'])
    expect(card()!.textContent).toContain('In a minute, the parts of the app.')
    scope.stop()
  })
})
