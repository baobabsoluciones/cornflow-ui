import { describe, test, expect, afterEach } from 'vitest'
import { effectScope, nextTick } from 'vue'
import {
  onTourReveal,
  provideTourTerms,
  tourTermsOf,
  useTour,
} from '@cornflow-ui/core/composables/onboarding/useTour'
import type { Tour } from '@cornflow-ui/core/composables/onboarding/tours'

const place = (target: string) => {
  const element = document.createElement('div')
  element.dataset.tour = target
  document.body.appendChild(element)
  return element
}

const tour = (overrides: Partial<Tour> = {}): Tour => ({
  key: 'sample',
  steps: [{ key: 'welcome' }, { key: 'menu', target: 'menu' }, { key: 'tabs', target: 'tabs' }],
  ...overrides,
})

afterEach(() => {
  useTour().stop()
  document.body.innerHTML = ''
})

describe('useTour', () => {
  test('a tour shows its steps one by one and ends after the last', async () => {
    place('menu')
    place('tabs')
    const tours = useTour()
    await tours.start(tour())
    expect(tours.step.value?.key).toBe('welcome')

    tours.next()
    expect(tours.step.value?.key).toBe('menu')
    tours.back()
    tours.back()
    expect(tours.index.value).toBe(0)

    tours.next()
    tours.next()
    tours.next()
    expect(tours.tour.value).toBeNull()
  })

  test('the steps whose element is not on the screen are left out', async () => {
    place('tabs')
    const tours = useTour()
    await tours.start(tour())
    expect(tours.steps.value.map((step) => step.key)).toEqual(['welcome', 'tabs'])
  })

  test('what the tour sets up is undone once it ends, however it ends', async () => {
    const log: string[] = []
    const tours = useTour()
    const setup = () => {
      log.push('setup')
      place('menu')
      return () => log.push('undo')
    }
    await tours.start(tour({ setup }))
    expect(tours.steps.value.map((step) => step.key)).toEqual(['welcome', 'menu'])
    tours.stop()
    expect(log).toEqual(['setup', 'undo'])

    await tours.start(tour({ setup }))
    tours.next()
    tours.next()
    expect(log).toEqual(['setup', 'undo', 'setup', 'undo'])
  })

  test('a tour with no step on the screen does not start', async () => {
    const tours = useTour()
    await tours.start(tour({ steps: [{ key: 'menu', target: 'menu' }] }))
    expect(tours.tour.value).toBeNull()
  })

  test('a step that opens its part is shown when what it needs is on the screen', async () => {
    place('trigger')
    const tours = useTour()
    await tours.start(
      tour({
        steps: [
          { key: 'menu', target: 'menu-panel', shownWith: 'trigger', reveal: 'menu' },
          { key: 'other', target: 'other-panel', shownWith: 'elsewhere', reveal: 'other' },
        ],
      }),
    )
    expect(tours.steps.value.map((step) => step.key)).toEqual(['menu'])
  })

  test('a part opens while the steps that show it last, and closes after', async () => {
    place('menu')
    const log: string[] = []
    const scope = effectScope()
    scope.run(() =>
      onTourReveal('panel', () => {
        log.push('open')
        return () => log.push('close')
      }),
    )
    const tours = useTour()
    await tours.start(
      tour({
        steps: [
          { key: 'welcome' },
          { key: 'first', target: 'menu', reveal: 'panel' },
          { key: 'second', target: 'menu', reveal: 'panel' },
          { key: 'last', target: 'menu' },
        ],
      }),
    )
    await nextTick()
    expect(log).toEqual([])

    tours.next()
    await nextTick()
    tours.next()
    await nextTick()
    expect(log).toEqual(['open'])

    tours.next()
    await nextTick()
    expect(log).toEqual(['open', 'close'])

    tours.back()
    await nextTick()
    tours.stop()
    await nextTick()
    expect(log).toEqual(['open', 'close', 'open', 'close'])
    scope.stop()
  })

  test('a part is closed when its component goes, even mid-step', async () => {
    place('menu')
    const log: string[] = []
    const scope = effectScope()
    scope.run(() => onTourReveal('panel', () => () => log.push('close')))
    const tours = useTour()
    await tours.start(tour({ steps: [{ key: 'first', target: 'menu', reveal: 'panel' }] }))
    await nextTick()
    scope.stop()
    expect(log).toEqual(['close'])
  })

  test('a skipped step makes way for the one the user was heading to', async () => {
    place('menu')
    place('tabs')
    const tours = useTour()
    await tours.start(tour())
    tours.next()
    tours.skip()
    expect(tours.step.value?.key).toBe('tabs')
    expect(tours.steps.value.map((step) => step.key)).toEqual(['welcome', 'tabs'])

    await tours.start(tour())
    tours.next()
    tours.next()
    tours.back()
    tours.skip()
    expect(tours.step.value?.key).toBe('welcome')

    await tours.start(tour())
    tours.next()
    tours.next()
    tours.skip()
    expect(tours.tour.value).toBeNull()
  })

  test('a page gives the terms of the step pointing at its part while it lives', () => {
    const scope = effectScope()
    scope.run(() => provideTourTerms('upload', () => [{ title: 'Append', text: 'Adds the rows.' }]))
    expect(tourTermsOf('upload')).toEqual([{ title: 'Append', text: 'Adds the rows.' }])
    expect(tourTermsOf('other')).toEqual([])

    scope.stop()
    expect(tourTermsOf('upload')).toEqual([])
  })
})
