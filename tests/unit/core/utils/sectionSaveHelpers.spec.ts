import { describe, test, expect, vi } from 'vitest'

vi.mock('@cornflow-ui/core/utils/i18nUtils', () => ({
  getMessageFromResponseContent: (content: any, fb: string) =>
    typeof content?.message === 'string' ? content.message : fb,
  getLocalizedMessage: (obj: any) => obj?.en ?? 'localized',
}))

import { getErrorMessage, getConfigByStorageKey } from '@cornflow-ui/core/utils/sectionSaveHelpers'

describe('getErrorMessage', () => {
  test('prefers a plain error message', () => {
    expect(getErrorMessage({ message: 'boom' }, 'fb')).toBe('boom')
  })

  test('uses the response content message when there is no error message', () => {
    expect(
      getErrorMessage({ response: { content: { message: 'from content' } } }, 'fb'),
    ).toBe('from content')
  })

  test('localizes an object message', () => {
    expect(getErrorMessage({ message: { en: 'Localized' } }, 'fb')).toBe('Localized')
  })

  test('falls back when nothing is resolvable', () => {
    expect(getErrorMessage({}, 'FALLBACK')).toBe('FALLBACK')
    expect(getErrorMessage(null, 'FALLBACK')).toBe('FALLBACK')
  })
})

describe('getConfigByStorageKey', () => {
  const config = { 'My-Table': { id: 1 }, Other: { id: 2 } }

  test('finds the config entry by normalized storage key', () => {
    expect(getConfigByStorageKey(config, 'my_table')).toEqual({ id: 1 })
    expect(getConfigByStorageKey(config, 'other')).toEqual({ id: 2 })
  })

  test('returns null when not found or config is not an object', () => {
    expect(getConfigByStorageKey(config, 'missing')).toBeNull()
    expect(getConfigByStorageKey(null, 'my_table')).toBeNull()
    expect(getConfigByStorageKey('nope' as any, 'my_table')).toBeNull()
  })
})
