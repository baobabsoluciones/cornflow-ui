import { describe, test, expect, vi } from 'vitest'

const { localeState } = vi.hoisted(() => ({ localeState: { value: 'en' } }))
vi.mock('@cornflow-ui/core/plugins/i18n', () => ({ currentLocale: localeState }))

import {
  resolveTitle,
  resolveTitleWithLocale,
  getLocalizedMessage,
  getMessageFromResponseContent,
  getApiErrorMessageFromContent,
  getMessageFromResponseContentOrNull,
  isMultilingualTitle,
} from '@cornflow-ui/core/utils/i18nUtils'

describe('i18nUtils - resolveTitle (no Vue instance -> defaults to en)', () => {
  test('returns plain strings as-is', () => {
    expect(resolveTitle('Hello')).toBe('Hello')
  })
  test('resolves the en key, then the first available key', () => {
    expect(resolveTitle({ en: 'E', es: 'S' })).toBe('E')
    expect(resolveTitle({ es: 'Solo' })).toBe('Solo')
  })
  test('returns the fallback for empty objects or nullish titles', () => {
    expect(resolveTitle({}, 'fb')).toBe('fb')
    expect(resolveTitle(null as any, 'fb')).toBe('fb')
  })
})

describe('i18nUtils - resolveTitleWithLocale', () => {
  test('string as-is', () => {
    expect(resolveTitleWithLocale('Hi')).toBe('Hi')
  })
  test('locale match, en fallback, first-key fallback, then fallback', () => {
    expect(resolveTitleWithLocale({ es: 'S', en: 'E' }, 'es')).toBe('S')
    expect(resolveTitleWithLocale({ en: 'E' }, 'fr')).toBe('E')
    expect(resolveTitleWithLocale({ de: 'D' }, 'fr')).toBe('D')
    expect(resolveTitleWithLocale({}, 'fr', 'fb')).toBe('fb')
    expect(resolveTitleWithLocale(null as any, 'en', 'fb')).toBe('fb')
  })
})

describe('i18nUtils - getLocalizedMessage (uses current locale)', () => {
  test('string as-is', () => {
    expect(getLocalizedMessage('plain')).toBe('plain')
  })
  test('picks current locale, then en, then first key, then fallback', () => {
    localeState.value = 'es'
    expect(getLocalizedMessage({ es: 'S', en: 'E' })).toBe('S')
    expect(getLocalizedMessage({ en: 'E' })).toBe('E')
    expect(getLocalizedMessage({ de: 'D' })).toBe('D')
    expect(getLocalizedMessage({})).toBe('An error occurred')
    expect(getLocalizedMessage(null as any, 'fb')).toBe('fb')
    localeState.value = 'en'
  })
})

describe('i18nUtils - getMessageFromResponseContent', () => {
  test('handles string, message field, translation object and arrays', () => {
    expect(getMessageFromResponseContent(null)).toBe('An error occurred')
    expect(getMessageFromResponseContent('boom')).toBe('boom')
    expect(getMessageFromResponseContent({ message: 'hi' })).toBe('hi')
    expect(getMessageFromResponseContent({ message: { en: 'E' } })).toBe('E')
    expect(getMessageFromResponseContent({ message: ['a', 'b'] })).toBe('a\nb')
    expect(getMessageFromResponseContent({ message: [{ en: 'E1' }, null, 'E2'] })).toBe('E1\nE2')
  })
  test('falls back for empty arrays and non-resolvable shapes', () => {
    expect(getMessageFromResponseContent({ message: [] }, 'fb')).toBe('fb')
    expect(getMessageFromResponseContent({ foo: 1 }, 'fb')).toBe('fb')
  })
})

describe('i18nUtils - getApiErrorMessageFromContent', () => {
  test('handles nullish, string and non-object inputs', () => {
    expect(getApiErrorMessageFromContent(null)).toBe('An error occurred')
    expect(getApiErrorMessageFromContent('literal')).toBe('literal')
    expect(getApiErrorMessageFromContent(42 as any, 'fb')).toBe('fb')
  })
  test('builds from jsonschema_errors with an error/message head', () => {
    expect(
      getApiErrorMessageFromContent({ jsonschema_errors: ['e1', 'e2'], error: 'Bad' }),
    ).toBe('Bad\ne1\ne2')
    expect(
      getApiErrorMessageFromContent({ jsonschema_errors: ['e1'], message: 'Msg' }),
    ).toBe('Msg\ne1')
    expect(getApiErrorMessageFromContent({ jsonschema_errors: ['only'] })).toBe('only')
  })
  test('prefers a plain error string, else delegates to message resolution', () => {
    expect(getApiErrorMessageFromContent({ error: 'oops' })).toBe('oops')
    expect(getApiErrorMessageFromContent({ message: 'delegated' })).toBe('delegated')
  })
})

describe('i18nUtils - getMessageFromResponseContentOrNull', () => {
  test('preserves null when nothing resolvable', () => {
    expect(getMessageFromResponseContentOrNull(null)).toBeNull()
    expect(getMessageFromResponseContentOrNull({ message: null })).toBeNull()
    expect(getMessageFromResponseContentOrNull({ message: [] })).toBeNull()
    expect(getMessageFromResponseContentOrNull({ foo: 1 })).toBeNull()
  })
  test('resolves strings, translation objects and arrays', () => {
    expect(getMessageFromResponseContentOrNull('s')).toBe('s')
    expect(getMessageFromResponseContentOrNull({ message: { en: 'E' } })).toBe('E')
    expect(getMessageFromResponseContentOrNull({ message: ['a', 'b'] })).toBe('a\nb')
  })
})

describe('i18nUtils - isMultilingualTitle', () => {
  test('true only for plain objects', () => {
    expect(isMultilingualTitle({ en: 'x' })).toBe(true)
    expect(isMultilingualTitle('str')).toBe(false)
    expect(isMultilingualTitle([1, 2])).toBe(false)
    expect(isMultilingualTitle(null)).toBeFalsy()
  })
})
