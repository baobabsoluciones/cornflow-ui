import { describe, test, expect, vi, afterEach } from 'vitest'
import {
  buildLanguageRegistry,
  resolveAppLocalesConfig,
  getDateLocaleMap,
  isRegisteredLanguage,
  languages,
  type LanguageDefinition,
} from '@cornflow-ui/core/plugins/languages'

const core = (): LanguageDefinition[] => [
  { code: 'en', labelKey: 'settings.english', dateLocale: 'es-ES', messages: { a: 'A', nested: { x: 'X', y: 'Y' } } },
  { code: 'es', labelKey: 'settings.spanish', dateLocale: 'es-ES', messages: { a: 'A-es' } },
  { code: 'fr', labelKey: 'settings.french', dateLocale: 'fr-FR', messages: { a: 'A-fr' } },
]

const codes = (langs: LanguageDefinition[]) => langs.map((l) => l.code)

describe('buildLanguageRegistry', () => {
  afterEach(() => vi.restoreAllMocks())

  test('without project config returns the core languages', () => {
    expect(codes(buildLanguageRegistry(core()))).toEqual(['en', 'es', 'fr'])
  })

  test('adds a new language', () => {
    const result = buildLanguageRegistry(core(), {
      languages: [{ code: 'pt', label: 'Português', dateLocale: 'pt-PT', messages: { a: 'A-pt' } }],
    })

    expect(codes(result)).toEqual(['en', 'es', 'fr', 'pt'])
    expect(result.find((l) => l.code === 'pt')).toEqual({
      code: 'pt',
      label: 'Português',
      labelKey: undefined,
      dateLocale: 'pt-PT',
      messages: { a: 'A-pt' },
    })
  })

  test('uses the code as dateLocale and warns when a new language has none', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = buildLanguageRegistry(core(), { languages: [{ code: 'de' }] })

    expect(result.find((l) => l.code === 'de')?.dateLocale).toBe('de')
    expect(warn).toHaveBeenCalled()
  })

  test('hides core languages', () => {
    expect(codes(buildLanguageRegistry(core(), { hidden: ['fr'] }))).toEqual(['en', 'es'])
  })

  test('does not hide en (fallback) and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(codes(buildLanguageRegistry(core(), { hidden: ['en', 'es'] }))).toEqual(['en', 'fr'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cannot be hidden'))
  })

  test('merges project messages over core messages', () => {
    const result = buildLanguageRegistry(core(), {
      languages: [{ code: 'en', messages: { nested: { y: 'Y-app' }, b: 'B' } }],
    })

    expect(result[0].messages).toEqual({ a: 'A', nested: { x: 'X', y: 'Y-app' }, b: 'B' })
  })

  test('overrides label and dateLocale of a core language', () => {
    const result = buildLanguageRegistry(core(), {
      languages: [{ code: 'en', label: 'English (UK)', dateLocale: 'en-GB' }],
    })

    expect(result[0]).toMatchObject({ label: 'English (UK)', dateLocale: 'en-GB', labelKey: 'settings.english' })
  })

  test('does not mutate the core definitions', () => {
    const base = core()
    buildLanguageRegistry(base, { languages: [{ code: 'en', dateLocale: 'en-GB', messages: { a: 'Z' } }] })

    expect(base[0]).toMatchObject({ dateLocale: 'es-ES', messages: { a: 'A' } })
  })
})

describe('resolveAppLocalesConfig', () => {
  test('uses index.ts when present', () => {
    const config = { languages: [{ code: 'pt', dateLocale: 'pt-PT', messages: {} }], hidden: ['fr'] }

    expect(
      resolveAppLocalesConfig(
        { '/src/app/plugins/locales/index.ts': { default: config } },
        { '/src/app/plugins/locales/en.ts': { default: { a: 'ignored' } } },
      ),
    ).toBe(config)
  })

  test('falls back to the legacy en/es/fr files', () => {
    expect(
      resolveAppLocalesConfig({}, {
        '/src/app/plugins/locales/en.ts': { default: { a: 'A' } },
        '/src/app/plugins/locales/es.ts': { default: {} },
      }),
    ).toEqual({
      languages: [
        { code: 'en', messages: { a: 'A' } },
        { code: 'es', messages: {} },
      ],
    })
  })

  test('with no files at all returns an empty config', () => {
    expect(resolveAppLocalesConfig({}, {})).toEqual({ languages: [] })
  })
})

describe('module registry (core standalone)', () => {
  test('registers en, es and fr', () => {
    expect(codes(languages)).toEqual(['en', 'es', 'fr'])
    expect(isRegisteredLanguage('es')).toBe(true)
    expect(isRegisteredLanguage('pt')).toBe(false)
  })

  test('getDateLocaleMap keeps en on es-ES', () => {
    expect(getDateLocaleMap()).toEqual({ en: 'es-ES', es: 'es-ES', fr: 'fr-FR' })
  })
})
