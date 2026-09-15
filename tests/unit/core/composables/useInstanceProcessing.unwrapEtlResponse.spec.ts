import { describe, test, expect } from 'vitest'
import { unwrapEtlResponse } from '@cornflow-ui/core/composables/useInstanceProcessing'

describe('unwrapEtlResponse', () => {
  test('unwraps { data, warning: string } envelope', () => {
    const out = unwrapEtlResponse(
      { data: { table_a: [] }, warning: 'heads up' },
      'en',
    )
    expect(out.data).toEqual({ table_a: [] })
    expect(out.warning).toBe('heads up')
  })

  test('resolves warning from per-locale dictionary using current locale', () => {
    const out = unwrapEtlResponse(
      { data: {}, warning: { en: 'EN msg', es: 'Mensaje ES' } },
      'es',
    )
    expect(out.warning).toBe('Mensaje ES')
  })

  test('strips region from locale (es-ES → es)', () => {
    const out = unwrapEtlResponse(
      { data: {}, warning: { en: 'EN', es: 'ES' } },
      'es-ES',
    )
    expect(out.warning).toBe('ES')
  })

  test('falls back to first available locale when current is missing', () => {
    const out = unwrapEtlResponse(
      { data: {}, warning: { fr: 'Avis', it: 'Avviso' } },
      'en',
    )
    expect(['Avis', 'Avviso']).toContain(out.warning)
  })

  test('returns null warning when warning is empty/whitespace/missing', () => {
    expect(unwrapEtlResponse({ data: {}, warning: '   ' }, 'en').warning).toBe(
      null,
    )
    expect(unwrapEtlResponse({ data: {}, warning: null }, 'en').warning).toBe(
      null,
    )
    expect(unwrapEtlResponse({ data: {} }, 'en').warning).toBe(null)
  })

  test('back-compat: response without `data` key is treated as instance data', () => {
    const raw = { table_a: [{ id: 1 }], parameters: { foo: 'bar' } }
    const out = unwrapEtlResponse(raw, 'en')
    expect(out.data).toBe(raw)
    expect(out.warning).toBeNull()
  })

  test('back-compat: array responses are not unwrapped', () => {
    const arr = [1, 2, 3] as any
    const out = unwrapEtlResponse(arr, 'en')
    expect(out.data).toBe(arr)
    expect(out.warning).toBeNull()
  })

  test('back-compat: response with __metadata__ but no `data` key passes through unchanged', () => {
    const raw = { __metadata__: { foo: 1 }, t1: [] }
    const out = unwrapEtlResponse(raw, 'en')
    expect(out.data).toBe(raw)
    expect(out.warning).toBeNull()
  })
})
