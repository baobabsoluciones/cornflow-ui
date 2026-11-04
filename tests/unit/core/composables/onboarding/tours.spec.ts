import { describe, test, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/** The `data-tour` marks of the components. */
const src = join(process.cwd(), 'src')
const vueFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
const marks = new Set(
  vueFiles(src).flatMap((file) =>
    [...readFileSync(file, 'utf-8').matchAll(/data-tour="([^"]+)"/g)].map(([, mark]) => mark),
  ),
)

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

  test('every step points at a part some component marks', () => {
    for (const { step, name } of steps) {
      if (step.target) expect(marks, name).toContain(step.target)
    }
  })

  test.each([
    ['/history-execution', 'history'],
    ['/project-execution', 'createExecution'],
    ['/input-data/orders', 'dataTable'],
    ['/input-data/group/plants/lines', 'dataTable'],
    ['/results/plan', 'dataTable'],
    ['/configuration/products', 'dataTable'],
    ['/configuration/group/master/products', 'dataTable'],
    ['/user-settings', 'userSettings'],
    ['/roles-management', 'roles'],
  ])('the page at %s has the %s tour', (path, key) => {
    expect(pageTourOf(path)?.key).toBe(key)
  })

  test.each(['/configuration/section/1/rules', '/dashboard', '/not-found'])('the page at %s has none', (path) => {
    expect(pageTourOf(path)).toBeNull()
  })

  test('each tour step has its own key', () => {
    for (const tour of [GENERAL_TOUR, ...PAGE_TOURS]) {
      const keys = tour.steps.map((step) => step.key)
      expect(new Set(keys).size, tour.key).toBe(keys.length)
    }
  })
})
