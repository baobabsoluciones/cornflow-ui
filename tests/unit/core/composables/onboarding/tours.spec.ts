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
  termTextKeys,
} from '@cornflow-ui/core/composables/onboarding/tours'

const LOCALES = { en, es, fr, pt } as Record<string, Record<string, any>>

const read = (messages: Record<string, any>, key: string) =>
  key.split('.').reduce<any>((node, part) => node?.[part], messages)

const src = join(process.cwd(), 'src')
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(vue|ts)$/.test(entry.name) ? [path] : []
  })
const sources = sourceFiles(src).map((file) => readFileSync(file, 'utf-8'))
const found = (pattern: RegExp) =>
  new Set(sources.flatMap((source) => [...source.matchAll(pattern)].map(([, value]) => value)))

/**
 * The `data-tour` marks of the components: `data-tour="mark"`, a bound one
 * (`:data-tour="cond ? 'mark' : undefined"`) and a menu row's `tourId: 'mark'`.
 */
const marks = new Set([
  ...found(/[^:]data-tour="([^"]+)"/g),
  ...found(/:data-tour="[^"]*?'([^']+)'/g),
  ...found(/tourId: '([^']+)'/g),
])
/** The parts the components open for a tour (`onTourReveal('part', …)`). */
const reveals = found(/onTourReveal\(\s*'([^']+)'/g)

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

  test.each(Object.keys(LOCALES))('every term of a step reads in %s', (lang) => {
    for (const { tour, step, name } of steps) {
      for (const term of step.terms ?? []) {
        const { title, text } = termTextKeys(tour, step, term)
        expect(read(LOCALES[lang], title), `${name} ${term} title`).toEqual(expect.any(String))
        expect(read(LOCALES[lang], text), `${name} ${term} text`).toEqual(expect.any(String))
      }
    }
  })

  test('every step points at a part some component marks', () => {
    for (const { step, name } of steps) {
      if (step.target) expect(marks, name).toContain(step.target)
      if (step.shownWith) expect(marks, name).toContain(step.shownWith)
    }
  })

  test('every part a step opens, some component opens', () => {
    for (const { step, name } of steps) {
      if (step.reveal) expect(reveals, name).toContain(step.reveal)
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
