import { describe, expect, it } from 'vitest'
import {
  formatValidationErrors,
  formatValidationErrorsWithTitle,
  formatSingleErrorWithTitle,
  formatErrorDetails,
} from '@cornflow-ui/core/utils/errorFormatting'

// Translation stub: returns a recognizable string for known keys, otherwise echoes
// the key (so the "translation === key -> fallback" branches are exercised).
const tKnown = (key: string, params?: Record<string, any>): string => {
  const map: Record<string, string> = {
    'validation.keywords.type': 'Type',
    'validation.keywords.required': 'Required',
    'validation.types.string': 'string',
    'validation.errorFormats.typeError': `error - expected ${params?.type}`,
    'validation.errorFormats.typeErrorNoField': `error - expected ${params?.type}`,
    'validation.errorFormats.requiredError': `missing ${params?.property}`,
    'validation.errorFormats.requiredErrorNoPath': `missing ${params?.property}`,
    'validation.errorFormats.requiredErrorGeneric': 'missing property',
  }
  return map[key] ?? key
}

describe('formatValidationErrors', () => {
  it('returns empty string for null/empty', () => {
    expect(formatValidationErrors(null as any)).toBe('')
    expect(formatValidationErrors([])).toBe('')
  })

  it('formats a type error with field and translation', () => {
    const html = formatValidationErrors(
      [
        {
          keyword: 'type',
          instancePath: '/eCierresP/0/ID',
          params: { type: 'string' },
        },
      ],
      tKnown,
    )
    expect(html).toContain('<li>')
    expect(html).toContain('<strong>eCierresP[0].ID</strong>')
    expect(html).toContain('<code>string</code>')
  })

  it('formats a type error fallback without translation function', () => {
    const html = formatValidationErrors([
      { keyword: 'type', instancePath: '/field', params: { type: 'number' } },
    ])
    expect(html).toContain('<strong>field</strong>')
    expect(html).toContain('<code>number</code>')
    expect(html).toContain('expected')
  })

  it('formats a type error without field but with translation', () => {
    const html = formatValidationErrors(
      [{ keyword: 'type', instancePath: '', params: { type: 'string' } }],
      tKnown,
    )
    expect(html).toContain('<code>string</code>')
    expect(html).not.toContain('<strong>')
  })

  it('formats a type error without field and without translation', () => {
    const html = formatValidationErrors([
      { keyword: 'type', instancePath: '', params: { type: 'boolean' } },
    ])
    expect(html).toContain('<code>boolean</code>')
  })

  it('falls back to "unknown" type when params.type missing', () => {
    const html = formatValidationErrors([{ keyword: 'type', instancePath: '' }])
    expect(html).toContain('<code>unknown</code>')
  })

  it('formats required error with property, path and translation', () => {
    const html = formatValidationErrors(
      [
        {
          keyword: 'required',
          instancePath: '/obj',
          params: { missingProperty: 'name' },
        },
      ],
      tKnown,
    )
    expect(html).toContain('<strong>obj</strong>')
    expect(html).toContain('<code>name</code>')
  })

  it('formats required error with property, no path, with translation', () => {
    const html = formatValidationErrors(
      [
        {
          keyword: 'required',
          instancePath: '',
          params: { missingProperty: 'name' },
        },
      ],
      tKnown,
    )
    expect(html).toContain('<code>name</code>')
    expect(html).not.toContain('<strong>')
  })

  it('formats required error fallback without translation, with path', () => {
    const html = formatValidationErrors([
      {
        keyword: 'required',
        instancePath: '/obj',
        params: { missingProperty: 'age' },
      },
    ])
    expect(html).toContain('<strong>obj</strong>')
    expect(html).toContain('<code>age</code>')
  })

  it('formats required error fallback without translation, no path', () => {
    const html = formatValidationErrors([
      {
        keyword: 'required',
        instancePath: '',
        params: { missingProperty: 'age' },
      },
    ])
    expect(html).toContain('<code>age</code>')
    expect(html).toContain('missing')
  })

  it('formats required error generic with translation and no missingProperty', () => {
    const html = formatValidationErrors(
      [{ keyword: 'required', instancePath: '' }],
      tKnown,
    )
    expect(html).toContain('missing property')
  })

  it('formats required error generic without translation', () => {
    const html = formatValidationErrors([
      { keyword: 'required', instancePath: '' },
    ])
    expect(html).toContain('missing required property')
  })

  it('formats a generic error with params and message', () => {
    const html = formatValidationErrors([
      {
        keyword: 'maxLength',
        instancePath: '/desc',
        params: { limit: 10 },
        message: 'must be shorter',
      },
    ])
    expect(html).toContain('<strong>desc</strong>')
    expect(html).toContain('<code>10</code>')
    expect(html).toContain('must be shorter')
  })

  it('formats a generic error without path (keyword only)', () => {
    const html = formatValidationErrors([
      { keyword: 'enum', instancePath: '' },
    ])
    expect(html).toContain('<li>enum</li>')
  })

  it('groups identical errors and renders each individually', () => {
    const html = formatValidationErrors([
      {
        keyword: 'required',
        instancePath: '/a',
        params: { missingProperty: 'x' },
      },
      {
        keyword: 'required',
        instancePath: '/a',
        params: { missingProperty: 'x' },
      },
    ])
    const count = (html.match(/<li>/g) || []).length
    expect(count).toBe(2)
  })

  it('handles error with missing keyword (path only)', () => {
    const html = formatValidationErrors([{ instancePath: '/p' }])
    expect(html).toBe('<li><strong>p</strong>: </li>')
  })
})

describe('formatValidationErrorsWithTitle', () => {
  it('wraps errors in ul with title', () => {
    const html = formatValidationErrorsWithTitle('Errores', [
      { keyword: 'required', instancePath: '', params: { missingProperty: 'x' } },
    ])
    expect(html).toContain('<p><strong>Errores:</strong></p>')
    expect(html).toContain('<ul>')
    expect(html).toContain('</ul>')
  })

  it('omits ul when there are no errors', () => {
    const html = formatValidationErrorsWithTitle('Errores', [])
    expect(html).toBe('<p><strong>Errores:</strong></p>')
  })
})

describe('formatSingleErrorWithTitle', () => {
  it('renders title and single message', () => {
    expect(formatSingleErrorWithTitle('T', 'msg')).toBe(
      '<p><strong>T:</strong></p><li>msg</li>',
    )
  })
})

describe('formatErrorDetails', () => {
  it('returns fallback for empty/undefined details', () => {
    expect(formatErrorDetails('T', undefined, 'fallback')).toBe(
      '<p><strong>T:</strong></p><li>fallback</li>',
    )
    expect(formatErrorDetails('T', [], 'fallback')).toBe(
      '<p><strong>T:</strong></p><li>fallback</li>',
    )
  })

  it('formats array of ValidationError objects', () => {
    const html = formatErrorDetails(
      'T',
      [{ instancePath: '/x', message: 'bad', keyword: 'required', params: {} }],
      'fallback',
    )
    expect(html).toContain('<p><strong>T:</strong></p>')
    expect(html).toContain('<ul>')
  })

  it('formats array of plain strings', () => {
    const html = formatErrorDetails('T', ['err1', 'err2'], 'fallback')
    expect(html).toContain('<li>err1</li>')
    expect(html).toContain('<li>err2</li>')
  })

  it('formats array of objects with message (not ValidationError shape)', () => {
    const html = formatErrorDetails('T', [{ message: 'oops' }], 'fallback')
    expect(html).toContain('<li>oops</li>')
  })

  it('stringifies array of objects without message', () => {
    const html = formatErrorDetails('T', [{ foo: 'bar' }], 'fallback')
    expect(html).toContain('<li>[object Object]</li>')
  })

  it('treats non-array details as a single message', () => {
    const html = formatErrorDetails('T', 'plain string' as any, 'fallback')
    expect(html).toBe('<p><strong>T:</strong></p><li>plain string</li>')
  })
})
