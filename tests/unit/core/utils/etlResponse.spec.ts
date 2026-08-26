import { describe, test, expect } from 'vitest'
import { unwrapEtlResponse, resolveWarning } from '@cornflow-ui/core/utils/etlResponse'

describe('resolveWarning', () => {
  test('returns null for null or undefined', () => {
    expect(resolveWarning(null, 'en')).toBeNull()
    expect(resolveWarning(undefined, 'en')).toBeNull()
  })

  test('returns the string when it has content', () => {
    expect(resolveWarning('Something went wrong', 'en')).toBe(
      'Something went wrong',
    )
  })

  test('returns null for empty or whitespace-only strings', () => {
    expect(resolveWarning('', 'en')).toBeNull()
    expect(resolveWarning('   ', 'en')).toBeNull()
    expect(resolveWarning('\t\n', 'en')).toBeNull()
  })

  test('resolves from a per-locale dictionary using the language prefix', () => {
    const dict = { en: 'English warning', es: 'Aviso en español' }
    expect(resolveWarning(dict, 'es')).toBe('Aviso en español')
    expect(resolveWarning(dict, 'en')).toBe('English warning')
  })

  test('resolves using short language code from a locale with region', () => {
    const dict = { en: 'English', fr: 'Français' }
    expect(resolveWarning(dict, 'en-US')).toBe('English')
    expect(resolveWarning(dict, 'fr-FR')).toBe('Français')
  })

  test('falls back to exact locale key when short code is missing', () => {
    const dict = { 'pt-BR': 'Aviso brasileiro' }
    expect(resolveWarning(dict, 'pt-BR')).toBe('Aviso brasileiro')
  })

  test('falls back to the first non-null value when locale is missing', () => {
    const dict = { de: 'Deutsche Warnung', fr: 'Avertissement' }
    expect(resolveWarning(dict, 'ja')).toBe('Deutsche Warnung')
  })

  test('returns null when all dictionary values are null or undefined', () => {
    expect(resolveWarning({ en: null, es: undefined }, 'en')).toBeNull()
  })

  test('returns null when dictionary value is empty/whitespace string', () => {
    expect(resolveWarning({ en: '   ' }, 'en')).toBeNull()
  })

  test('returns null for non-string, non-object, non-null types', () => {
    expect(resolveWarning(42, 'en')).toBeNull()
    expect(resolveWarning(true, 'en')).toBeNull()
  })

  test('returns null for an empty dictionary', () => {
    expect(resolveWarning({}, 'en')).toBeNull()
  })

  test('prefers short language code over exact locale key', () => {
    const dict = { en: 'Short code', 'en-US': 'Exact locale' }
    expect(resolveWarning(dict, 'en-US')).toBe('Short code')
  })
})

describe('unwrapEtlResponse', () => {
  test('unwraps envelope with data and warning', () => {
    const response = { data: { table: [1, 2] }, warning: 'Watch out' }
    const result = unwrapEtlResponse(response, 'en')

    expect(result.data).toEqual({ table: [1, 2] })
    expect(result.warning).toBe('Watch out')
  })

  test('unwraps envelope with data and locale-dict warning', () => {
    const response = {
      data: { items: [] },
      warning: { en: 'English msg', es: 'Mensaje español' },
    }
    const result = unwrapEtlResponse(response, 'es')

    expect(result.data).toEqual({ items: [] })
    expect(result.warning).toBe('Mensaje español')
  })

  test('unwraps envelope with data and no warning', () => {
    const response = { data: { x: 1 } }
    const result = unwrapEtlResponse(response, 'en')

    expect(result.data).toEqual({ x: 1 })
    expect(result.warning).toBeNull()
  })

  test('returns raw response when there is no data key', () => {
    const response = { table: [1, 2, 3] }
    const result = unwrapEtlResponse(response, 'en')

    expect(result.data).toEqual({ table: [1, 2, 3] })
    expect(result.warning).toBeNull()
  })

  test('returns raw response when data is a primitive', () => {
    const response = { data: 'just a string' }
    const result = unwrapEtlResponse(response, 'en')

    expect(result.data).toEqual({ data: 'just a string' })
    expect(result.warning).toBeNull()
  })

  test('returns raw response when data is null', () => {
    const response = { data: null }
    const result = unwrapEtlResponse(response, 'en')

    expect(result.data).toEqual({ data: null })
    expect(result.warning).toBeNull()
  })

  test('returns raw response when input is an array', () => {
    const response = [1, 2, 3]
    const result = unwrapEtlResponse(response, 'en')

    expect(result.data).toEqual([1, 2, 3])
    expect(result.warning).toBeNull()
  })

  test('returns raw response for null / undefined / primitives', () => {
    expect(unwrapEtlResponse(null, 'en')).toEqual({ data: null, warning: null })
    expect(unwrapEtlResponse(undefined, 'en')).toEqual({
      data: undefined,
      warning: null,
    })
    expect(unwrapEtlResponse(42, 'en')).toEqual({ data: 42, warning: null })
    expect(unwrapEtlResponse('text', 'en')).toEqual({
      data: 'text',
      warning: null,
    })
  })

  test('unwraps when data is an array (object check passes for response, data is object/array)', () => {
    const response = { data: [1, 2, 3], warning: 'heads up' }
    const result = unwrapEtlResponse(response, 'en')

    // Arrays are objects, so the envelope is recognized
    expect(result.data).toEqual([1, 2, 3])
    expect(result.warning).toBe('heads up')
  })

  test('discards whitespace-only warning from envelope', () => {
    const response = { data: { ok: true }, warning: '   ' }
    const result = unwrapEtlResponse(response, 'en')

    expect(result.data).toEqual({ ok: true })
    expect(result.warning).toBeNull()
  })
})
