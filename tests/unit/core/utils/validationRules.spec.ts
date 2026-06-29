import { describe, expect, it } from 'vitest'
import {
  createValidationRules,
  getFieldValidationRules,
  validateField,
  validateForm,
  isFormValid,
} from '@/utils/validationRules'

// Simple i18n stub: echoes the key plus serialized params so we can assert branches.
const t = (key: string, params?: any): string =>
  params ? `${key}:${JSON.stringify(params)}` : key

describe('createValidationRules', () => {
  const rules = createValidationRules(t)

  describe('required', () => {
    it('fails on null/undefined/empty string', () => {
      expect(rules.required()(null)).toBe('validation.required')
      expect(rules.required()(undefined)).toBe('validation.required')
      expect(rules.required()('')).toBe('validation.required')
    })
    it('fails on empty array', () => {
      expect(rules.required()([])).toBe('validation.required')
    })
    it('passes on a value', () => {
      expect(rules.required()('x')).toBe(true)
      expect(rules.required()([1])).toBe(true)
      expect(rules.required()(0)).toBe(true)
    })
    it('uses custom message', () => {
      expect(rules.required('custom')(null)).toBe('custom')
    })
  })

  describe('email', () => {
    it('passes on empty (optional)', () => {
      expect(rules.email()('')).toBe(true)
    })
    it('passes valid email', () => {
      expect(rules.email()('a@b.com')).toBe(true)
    })
    it('fails invalid email', () => {
      expect(rules.email()('not-an-email')).toBe('validation.email')
    })
    it('fails on overly long string (ReDoS guard)', () => {
      const long = 'a'.repeat(255) + '@b.com'
      expect(rules.email()(long)).toBe('validation.email')
    })
    it('uses custom message', () => {
      expect(rules.email('bad')('nope')).toBe('bad')
    })
  })

  describe('min', () => {
    it('passes when empty (optional)', () => {
      expect(rules.min(5)('')).toBe(true)
      expect(rules.min(5)(null)).toBe(true)
    })
    it('fails on non-number', () => {
      expect(rules.min(5)('abc')).toBe('validation.invalidNumber')
    })
    it('passes when >= min', () => {
      expect(rules.min(5)(5)).toBe(true)
    })
    it('fails when < min with i18n params', () => {
      expect(rules.min(5)(4)).toBe('validation.min:{"min":5}')
    })
    it('uses custom message', () => {
      expect(rules.min(5, 'too low')(4)).toBe('too low')
    })
  })

  describe('max', () => {
    it('passes when empty', () => {
      expect(rules.max(10)('')).toBe(true)
    })
    it('fails on non-number', () => {
      expect(rules.max(10)('x')).toBe('validation.invalidNumber')
    })
    it('passes when <= max', () => {
      expect(rules.max(10)(10)).toBe(true)
    })
    it('fails when > max', () => {
      expect(rules.max(10)(11)).toBe('validation.max:{"max":10}')
    })
    it('uses custom message', () => {
      expect(rules.max(10, 'too high')(11)).toBe('too high')
    })
  })

  describe('minLength', () => {
    it('passes when falsy', () => {
      expect(rules.minLength(3)('')).toBe(true)
    })
    it('passes when long enough', () => {
      expect(rules.minLength(3)('abc')).toBe(true)
    })
    it('fails when too short', () => {
      expect(rules.minLength(3)('ab')).toBe('validation.minLength:{"length":3}')
    })
    it('uses custom message', () => {
      expect(rules.minLength(3, 'short')('a')).toBe('short')
    })
  })

  describe('maxLength', () => {
    it('passes when falsy', () => {
      expect(rules.maxLength(3)('')).toBe(true)
    })
    it('passes when short enough', () => {
      expect(rules.maxLength(3)('abc')).toBe(true)
    })
    it('fails when too long', () => {
      expect(rules.maxLength(3)('abcd')).toBe('validation.maxLength:{"length":3}')
    })
    it('uses custom message', () => {
      expect(rules.maxLength(3, 'long')('abcd')).toBe('long')
    })
  })

  describe('pattern', () => {
    it('passes when falsy', () => {
      expect(rules.pattern('\\d+')('')).toBe(true)
    })
    it('accepts string pattern', () => {
      expect(rules.pattern('^\\d+$')('123')).toBe(true)
      expect(rules.pattern('^\\d+$')('abc')).toBe('validation.pattern')
    })
    it('accepts RegExp pattern', () => {
      expect(rules.pattern(/^[a-z]+$/)('abc')).toBe(true)
      expect(rules.pattern(/^[a-z]+$/)('ABC')).toBe('validation.pattern')
    })
    it('uses custom message', () => {
      expect(rules.pattern(/^x$/, 'nope')('y')).toBe('nope')
    })
  })

  describe('number', () => {
    it('passes when empty', () => {
      expect(rules.number()('')).toBe(true)
    })
    it('passes on numeric', () => {
      expect(rules.number()('42')).toBe(true)
    })
    it('fails on non-number', () => {
      expect(rules.number()('abc')).toBe('validation.invalidNumber')
    })
    it('uses custom message', () => {
      expect(rules.number('nan')('abc')).toBe('nan')
    })
  })

  describe('integer', () => {
    it('passes when empty', () => {
      expect(rules.integer()('')).toBe(true)
    })
    it('fails on non-number', () => {
      expect(rules.integer()('abc')).toBe('validation.invalidNumber')
    })
    it('passes on integer', () => {
      expect(rules.integer()('10')).toBe(true)
    })
    it('fails on non-integer', () => {
      expect(rules.integer()('10.5')).toBe('validation.integer')
    })
    it('uses custom message for both branches', () => {
      expect(rules.integer('bad')('abc')).toBe('bad')
      expect(rules.integer('bad')('1.5')).toBe('bad')
    })
  })

  describe('url', () => {
    it('passes when falsy', () => {
      expect(rules.url()('')).toBe(true)
    })
    it('passes on valid url', () => {
      expect(rules.url()('https://example.com')).toBe(true)
    })
    it('fails on invalid url', () => {
      expect(rules.url()('not a url')).toBe('validation.url')
    })
    it('uses custom message', () => {
      expect(rules.url('badurl')('xxx')).toBe('badurl')
    })
  })

  describe('date', () => {
    it('passes when falsy', () => {
      expect(rules.date()('')).toBe(true)
    })
    it('passes on valid date', () => {
      expect(rules.date()('2026-01-01')).toBe(true)
    })
    it('fails on invalid date', () => {
      expect(rules.date()('not-a-date')).toBe('validation.date')
    })
    it('uses custom message', () => {
      expect(rules.date('baddate')('zzz')).toBe('baddate')
    })
  })

  describe('phone', () => {
    it('passes when falsy', () => {
      expect(rules.phone()('')).toBe(true)
    })
    it('passes valid phone', () => {
      expect(rules.phone()('+34 600-123 456')).toBe(true)
    })
    it('fails invalid phone', () => {
      expect(rules.phone()('abc')).toBe('validation.phone')
    })
    it('uses custom message', () => {
      expect(rules.phone('badphone')('abc')).toBe('badphone')
    })
  })

  describe('alphanumeric', () => {
    it('passes when falsy', () => {
      expect(rules.alphanumeric()('')).toBe(true)
    })
    it('passes valid alphanumeric', () => {
      expect(rules.alphanumeric()('abc123')).toBe(true)
    })
    it('fails on symbols', () => {
      expect(rules.alphanumeric()('abc!')).toBe('validation.alphanumeric')
    })
    it('uses custom message', () => {
      expect(rules.alphanumeric('bad')('!!')).toBe('bad')
    })
  })

  describe('custom', () => {
    it('passes when validator returns true', () => {
      expect(rules.custom((v) => v === 'ok', 'err')('ok')).toBe(true)
    })
    it('returns error message when validator returns false', () => {
      expect(rules.custom((v) => v === 'ok', 'err')('no')).toBe('err')
    })
  })
})

describe('getFieldValidationRules', () => {
  it('adds required rule', () => {
    const r = getFieldValidationRules({ required: true }, t)
    expect(r).toHaveLength(1)
    expect(r[0](null)).toBe('validation.required')
  })

  it('builds email rules', () => {
    const r = getFieldValidationRules({ type: 'email' }, t)
    expect(r[0]('a@b.com')).toBe(true)
  })

  it('builds number rules with min and max', () => {
    const r = getFieldValidationRules({ type: 'number', min: 1, max: 10 }, t)
    expect(r).toHaveLength(3)
    expect(validateField(0, r)).toContain('validation.min:{"min":1}')
    expect(validateField(11, r)).toContain('validation.max:{"max":10}')
    expect(validateField(5, r)).toEqual([])
  })

  it('builds integer rules with min/max', () => {
    const r = getFieldValidationRules({ type: 'integer', min: 0, max: 5 }, t)
    expect(r).toHaveLength(3)
    expect(validateField(2, r)).toEqual([])
  })

  it('builds date rules for date/datetime/time', () => {
    expect(getFieldValidationRules({ type: 'date' }, t)).toHaveLength(1)
    expect(getFieldValidationRules({ type: 'datetime' }, t)).toHaveLength(1)
    expect(getFieldValidationRules({ type: 'time' }, t)).toHaveLength(1)
  })

  it('builds string rules with minLength/maxLength', () => {
    const r = getFieldValidationRules(
      { type: 'string', minLength: 2, maxLength: 4 },
      t,
    )
    expect(r).toHaveLength(2)
    expect(validateField('a', r)).toContain('validation.minLength:{"length":2}')
    expect(validateField('abcde', r)).toContain(
      'validation.maxLength:{"length":4}',
    )
  })

  it('adds pattern rule for any type', () => {
    const r = getFieldValidationRules({ pattern: '^\\d+$' }, t)
    expect(r).toHaveLength(1)
    expect(r[0]('123')).toBe(true)
  })

  it('returns empty array for unknown type without constraints', () => {
    expect(getFieldValidationRules({ type: 'unknown-type' }, t)).toEqual([])
  })
})

describe('validateField', () => {
  it('collects all error messages', () => {
    const rules = createValidationRules(t)
    const errors = validateField('', [rules.required(), rules.email()])
    expect(errors).toEqual(['validation.required'])
  })

  it('returns empty when all rules pass', () => {
    const rules = createValidationRules(t)
    expect(validateField('a@b.com', [rules.email()])).toEqual([])
  })
})

describe('validateForm', () => {
  it('aggregates errors per field', () => {
    const errors = validateForm(
      { name: '', email: 'bad' },
      { name: { required: true }, email: { type: 'email' } },
      t,
    )
    expect(errors.name).toEqual(['validation.required'])
    expect(errors.email).toEqual(['validation.email'])
  })

  it('omits fields without errors', () => {
    const errors = validateForm(
      { name: 'John' },
      { name: { required: true } },
      t,
    )
    expect(errors).toEqual({})
  })
})

describe('isFormValid', () => {
  it('returns true when no errors', () => {
    expect(isFormValid({})).toBe(true)
  })
  it('returns false when errors present', () => {
    expect(isFormValid({ name: ['x'] })).toBe(false)
  })
})
