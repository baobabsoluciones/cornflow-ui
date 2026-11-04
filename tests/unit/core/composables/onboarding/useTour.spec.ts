import { describe, test, expect, afterEach } from 'vitest'
import { useTour } from '@cornflow-ui/core/composables/onboarding/useTour'
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
})
