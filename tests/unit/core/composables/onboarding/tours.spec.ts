import { describe, test, expect } from 'vitest'
import en from '@cornflow-ui/core/plugins/locales/en'
import es from '@cornflow-ui/core/plugins/locales/es'
import fr from '@cornflow-ui/core/plugins/locales/fr'
import pt from '@cornflow-ui/core/plugins/locales/pt'
import {
  GENERAL_TOUR,
  PAGE_TOURS,
  pageTourOf,
  stepTextKeys,
} from '@cornflow-ui/core/composables/onboarding/tours'

const LOCALES = { en, es, fr, pt } as Record<string, Record<string, any>>

const read = (messages: Record<string, any>, key: string) =>
  key.split('.').reduce<any>((node, part) => node?.[part], messages)

const steps = [GENERAL_TOUR, ...PAGE_TOURS].flatMap((tour) =>
  tour.steps.map((step) => ({ tour, step, name: `${tour.key}.${step.key}` })),
)

describe('tours', () => {
  test.each(Object.keys(LOCALES))('every step reads in %s', (lang) => {
    for (const { tour, step, name } of steps) {
      const { title, text } = stepTextKeys(tour, step)
      expect(read(LOCALES[lang], title), `${name} title`).toEqual(expect.any(String))
      expect(read(LOCALES[lang], text), `${name} text`).toEqual(expect.any(String))
    }
  })

  test('the help menu finds the tour of the page by its path', () => {
    expect(pageTourOf('/history-execution')?.key).toBe('history')
    expect(pageTourOf('/not-found')).toBeNull()
  })

  test('each tour step has its own key', () => {
    for (const tour of [GENERAL_TOUR, ...PAGE_TOURS]) {
      const keys = tour.steps.map((step) => step.key)
      expect(new Set(keys).size, tour.key).toBe(keys.length)
    }
  })
})
