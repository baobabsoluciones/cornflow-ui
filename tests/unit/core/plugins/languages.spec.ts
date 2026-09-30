import { describe, test, expect, vi, afterEach } from 'vitest'
import {
  CORE_LANGUAGES,
  FALLBACK_LANGUAGE,
  getCoreLanguageCodes,
  isCoreLanguage,
  resolveDefaultLanguage,
  resolveVisibleLanguages,
} from '@cornflow-ui/core/plugins/languages'

const codes = (langs: { code: string }[]) => langs.map((l) => l.code)

describe('languages registry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('defines en, es and fr with label, date locale and messages', () => {
    expect(getCoreLanguageCodes()).toEqual(['en', 'es', 'fr'])
    expect(FALLBACK_LANGUAGE).toBe('en')
    for (const lang of CORE_LANGUAGES) {
      expect(lang.labelKey).toMatch(/^settings\./)
      expect(lang.dateLocale).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
      expect(lang.messages).toHaveProperty('settings')
    }
  })

  test('isCoreLanguage', () => {
    expect(isCoreLanguage('es')).toBe(true)
    expect(isCoreLanguage('pt')).toBe(false)
    expect(isCoreLanguage(undefined)).toBe(false)
  })

  describe('resolveVisibleLanguages', () => {
    test('returns all core languages when the list is empty or undefined', () => {
      expect(codes(resolveVisibleLanguages())).toEqual(['en', 'es', 'fr'])
      expect(codes(resolveVisibleLanguages([]))).toEqual(['en', 'es', 'fr'])
    })

    test('keeps the configured order and removes duplicates', () => {
      expect(codes(resolveVisibleLanguages(['es', 'en', 'es']))).toEqual([
        'es',
        'en',
      ])
    })

    test('ignores unknown codes with a warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(codes(resolveVisibleLanguages(['en', 'pt']))).toEqual(['en'])
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"pt"'))
    })

    test('does not warn when warn is false', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(codes(resolveVisibleLanguages(['en', 'pt'], { warn: false }))).toEqual(['en'])
      expect(codes(resolveVisibleLanguages(['pt'], { warn: false }))).toEqual(['en', 'es', 'fr'])
      expect(warn).not.toHaveBeenCalled()
    })

    test('returns all core languages when no configured code is valid', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(codes(resolveVisibleLanguages(['pt', 'de']))).toEqual([
        'en',
        'es',
        'fr',
      ])
      expect(warn).toHaveBeenCalledTimes(3)
    })
  })

  describe('resolveDefaultLanguage', () => {
    const visible = resolveVisibleLanguages(['es', 'fr'])

    test('returns the requested language when it is visible', () => {
      expect(resolveDefaultLanguage('fr', visible)).toBe('fr')
    })

    test('falls back to the first visible language with a warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(resolveDefaultLanguage('en', visible)).toBe('es')
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"en"'))
    })

    test('uses the first visible language without warning when not set', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(resolveDefaultLanguage('', visible)).toBe('es')
      expect(resolveDefaultLanguage(undefined, visible)).toBe('es')
      expect(warn).not.toHaveBeenCalled()
    })

    test('uses the fallback language when nothing is visible', () => {
      expect(resolveDefaultLanguage(undefined, [])).toBe(FALLBACK_LANGUAGE)
    })
  })
})
