import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'

const mockT = vi.fn((key: string) => key)
const localeRef = { value: 'en' }
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: mockT, locale: localeRef }),
}))

// validation rules — return identifiable rule list reflecting input config
const mockGetRules = vi.fn((cfg: any) => [`rules:${cfg.type}:${cfg.required ?? false}`])
vi.mock('@/utils/validationRules', () => ({
  getFieldValidationRules: (...a: any[]) => mockGetRules(...a),
}))

// parseJoinFrom: "table.field" -> { table, field }; "" or bad -> null
vi.mock('@/utils/schemaUtils', () => ({
  parseJoinFrom: (s: string) => {
    if (!s || !s.includes('.')) return null
    const [table, field] = s.split('.')
    return { table, field }
  },
}))

vi.mock('@/utils/i18nUtils', () => ({
  resolveTitleWithLocale: (title: any, locale: string, fallback: string) =>
    (title && title[locale]) || fallback,
}))

import { useFormFields } from '@/composables/core-table/useFormFields'

beforeEach(() => {
  vi.clearAllMocks()
  localeRef.value = 'en'
})

describe('useFormFields - visibleFields', () => {
  test('filters id, hidden, visible:false and foreign keys (array input)', () => {
    const fields = [
      { key: 'id', type: 'integer' },
      { key: 'name', type: 'string' },
      { key: 'hid', type: 'string', hidden: true },
      { key: 'inv', type: 'string', visible: false },
      { key: 'fk', type: 'string', isForeignKey: true },
      { key: '', type: 'string' },
    ]
    const f = useFormFields({ fields: computed(() => fields as any) })
    expect(Object.keys(f.visibleFields.value)).toEqual(['name'])
  })

  test('handles object input and injects key', () => {
    const fields = { name: { type: 'string' }, age: { type: 'integer' } }
    const f = useFormFields({ fields: ref(fields as any) })
    expect(Object.keys(f.visibleFields.value)).toEqual(['name', 'age'])
    expect(f.visibleFields.value.name.key).toBe('name')
  })

  test('empty when no fields provided', () => {
    const f = useFormFields({})
    expect(f.visibleFields.value).toEqual({})
  })
})

describe('useFormFields - type checks', () => {
  const f = useFormFields({})

  test('isTextType', () => {
    expect(f.isTextType('string')).toBe(true)
    expect(f.isTextType('email')).toBe(true)
    expect(f.isTextType('date')).toBe(false)
    expect(f.isTextType(undefined)).toBe(false)
    expect(f.isTextType('string', { type: 'string', choices: [1] } as any)).toBe(false)
  })

  test('isNumberType', () => {
    expect(f.isNumberType('number')).toBe(true)
    expect(f.isNumberType('integer')).toBe(true)
    expect(f.isNumberType('string')).toBe(false)
    expect(f.isNumberType(undefined)).toBe(false)
    expect(f.isNumberType('number', { type: 'selector' } as any)).toBe(false)
  })

  test('isSelectorType', () => {
    expect(f.isSelectorType(undefined)).toBe(false)
    expect(f.isSelectorType({ type: 'selector' } as any)).toBe(true)
    expect(f.isSelectorType({ type: 'boolean' } as any)).toBe(true)
    expect(f.isSelectorType({ isDependentField: true, isMainSelector: true } as any)).toBe(true)
    expect(f.isSelectorType({ type: 'string', choices: ['a'] } as any)).toBe(true)
    expect(f.isSelectorType({ type: 'string' } as any)).toBe(false)
  })

  test('getInputType', () => {
    expect(f.getInputType('email')).toBe('email')
    expect(f.getInputType('datetime')).toBe('datetime-local')
    expect(f.getInputType('time')).toBe('time')
    expect(f.getInputType('string')).toBe('text')
    expect(f.getInputType(undefined)).toBe('text')
  })

  test('getFieldType infers from field or items', () => {
    const fields = [{ key: 'a', type: 'integer' }, { key: 'b', type: 'string' }] as any
    expect(f.getFieldType('a', fields)).toBe('number')
    expect(f.getFieldType('b', fields)).toBe('string')
    expect(f.getFieldType('unknown', fields, [{ unknown: true }])).toBe('boolean')
    expect(f.getFieldType('unknown', fields, [{ unknown: 5 }])).toBe('number')
    expect(f.getFieldType('unknown', {})).toBe('string')
  })
})

describe('useFormFields - validation & formatting', () => {
  const f = useFormFields({})

  test('getFieldRules delegates and empty for undefined', () => {
    expect(f.getFieldRules(undefined)).toEqual([])
    expect(f.getFieldRules({ type: 'string', required: true } as any)).toEqual(['rules:string:true'])
    expect(mockGetRules).toHaveBeenCalled()
  })

  test('formatFieldName camel to words', () => {
    expect(f.formatFieldName('firstName')).toBe('First Name')
    expect(f.formatFieldName('id')).toBe('Id')
  })

  test('formatCellValue for each type', () => {
    expect(f.formatCellValue(null, 'string')).toBe('')
    expect(f.formatCellValue(true, 'boolean')).toBe('True')
    expect(f.formatCellValue(false, 'boolean')).toBe('False')
    expect(f.formatCellValue(5, 'integer')).toBe('5')
    expect(f.formatCellValue('7', 'number')).toBe('7')
    expect(f.formatCellValue('2020-01-02', 'date')).toBe(new Date('2020-01-02').toLocaleDateString())
    expect(f.formatCellValue('plain', 'string')).toBe('plain')
  })

  test('formatCellValue datetime & time', () => {
    expect(f.formatCellValue('', 'datetime')).toBe('')
    expect(f.formatCellValue('not-a-date', 'datetime')).toBe('not-a-date')
    expect(f.formatCellValue('12:30', 'time')).toBe('12:30')
    expect(f.formatCellValue('not-a-time', 'time')).toBe('not-a-time')
  })

  test('formatDate handles empty and invalid', () => {
    expect(f.formatDate('')).toBe('')
  })

  test('getFieldCols and getFieldMd', () => {
    expect(f.getFieldCols()).toBe(12)
    expect(f.getFieldMd(undefined)).toBe(6)
    expect(f.getFieldMd({ type: 'textarea' } as any)).toBe(12)
    expect(f.getFieldMd({ type: 'string' } as any)).toBe(6)
  })
})

describe('useFormFields - selector options', () => {
  test('getChoicesOptions for boolean and choices', () => {
    const f = useFormFields({})
    expect(f.getChoicesOptions({ type: 'boolean' } as any)).toEqual([
      { value: true, text: 'table.yes' },
      { value: false, text: 'table.no' },
    ])
    expect(f.getChoicesOptions({ type: 'string', choices: ['x', 'y'] } as any)).toEqual([
      { value: 'x', text: 'x' },
      { value: 'y', text: 'y' },
    ])
    expect(f.getChoicesOptions({ type: 'string' } as any)).toEqual([])
  })

  test('loadSelectorOptions uses local options for boolean', async () => {
    const f = useFormFields({})
    await f.loadSelectorOptions('flag', { type: 'boolean' } as any)
    expect(f.selectorOptions.value.flag).toHaveLength(2)
  })

  test('loadSelectorOptions returns early without joinFrom/loadTableData', async () => {
    const f = useFormFields({})
    await f.loadSelectorOptions('fk', { type: 'string' } as any)
    expect(f.selectorOptions.value.fk).toBeUndefined()
  })

  test('loadSelectorOptions loads remote rows via loadTableData', async () => {
    const loadTableData = vi.fn(async () => [{ code: 'A' }, { code: 'B' }])
    const f = useFormFields({ loadTableData })
    await f.loadSelectorOptions('city', { joinFrom: 'cities.code' } as any)
    expect(loadTableData).toHaveBeenCalledWith('cities')
    expect(f.selectorOptions.value.city).toEqual([
      { value: 'A', text: 'A' },
      { value: 'B', text: 'B' },
    ])
    expect(f.loadingSelectorOptions.value.city).toBe(false)
  })

  test('loadSelectorOptions prefers existing tableData and prepends valueNone', async () => {
    const loadTableData = vi.fn()
    const f = useFormFields({
      loadTableData,
      tableData: ref({ cities: [{ code: 'A' }] }),
    })
    await f.loadSelectorOptions('city', {
      joinFrom: 'cities.code',
      valueNone: { title: { en: 'None' } },
    } as any)
    expect(loadTableData).not.toHaveBeenCalled()
    expect(f.selectorOptions.value.city[0]).toEqual({ value: null, text: 'None' })
  })

  test('loadSelectorOptions valueNone with string title', async () => {
    const f = useFormFields({
      loadTableData: vi.fn(async () => [{ code: 'A' }]),
    })
    await f.loadSelectorOptions('city', {
      joinFrom: 'cities.code',
      valueNone: { title: 'Pick one' },
    } as any)
    expect(f.selectorOptions.value.city[0]).toEqual({ value: null, text: 'Pick one' })
  })

  test('loadSelectorOptions handles loadTableData error', async () => {
    const f = useFormFields({ loadTableData: vi.fn(async () => { throw new Error('x') }) })
    await f.loadSelectorOptions('city', { joinFrom: 'cities.code' } as any)
    expect(f.selectorOptions.value.city).toEqual([])
    expect(f.loadingSelectorOptions.value.city).toBe(false)
  })

  test('loadSelectorOptions returns early when joinFrom unparseable', async () => {
    const f = useFormFields({ loadTableData: vi.fn() })
    await f.loadSelectorOptions('bad', { joinFrom: 'nodot' } as any)
    expect(f.selectorOptions.value.bad).toBeUndefined()
  })
})

describe('useFormFields - dependent field updates', () => {
  test('updateDependentFields returns early for unknown / no joinFrom', () => {
    const f = useFormFields({ fields: [{ key: 'a', type: 'string' }] as any })
    expect(f.updateDependentFields('unknown', 1, { a: 1 })).toEqual({ a: 1 })
    expect(f.updateDependentFields('a', 1, { a: 1 })).toEqual({ a: 1 })
  })

  test('main selector update populates foreign key and dependent columns', () => {
    const fields = [
      { key: 'cityName', type: 'selector', isDependentField: true, isMainSelector: true, joinFrom: 'cities.name', foreignKeyField: 'cityId' },
      { key: 'cityId', type: 'integer', isForeignKey: true, columnsToJoin: ['zip'] },
      { key: 'zip', type: 'string', isDependentField: true, joinFrom: 'cities.zip' },
    ] as any
    const f = useFormFields({
      fields,
      tableData: ref({ cities: [{ name: 'Madrid', cityId: 10, zip: '28001' }] }),
    })
    const out = f.updateDependentFields('cityName', 'Madrid', {})
    expect(out.cityId).toBe(10)
    expect(out.zip).toBe('28001')
  })

  test('main selector update with valueNone null clears FK', () => {
    const fields = [
      { key: 'cityName', type: 'selector', isDependentField: true, isMainSelector: true, joinFrom: 'cities.name', foreignKeyField: 'cityId', valueNone: { title: 'None' } },
    ] as any
    const f = useFormFields({ fields, tableData: ref({ cities: [] }) })
    const out = f.updateDependentFields('cityName', null, {})
    expect(out.cityId).toBeNull()
    expect(out.cityName).toBe('None')
  })

  test('main selector update without foreignKeyField returns unchanged', () => {
    const fields = [
      { key: 'sel', isDependentField: true, isMainSelector: true, joinFrom: 'cities.name' },
    ] as any
    const f = useFormFields({ fields, tableData: ref({ cities: [{ name: 'X' }] }) })
    expect(f.updateDependentFields('sel', 'X', { keep: 1 })).toEqual({ keep: 1 })
  })

  test('main selector update no matching item returns unchanged', () => {
    const fields = [
      { key: 'sel', isDependentField: true, isMainSelector: true, joinFrom: 'cities.name', foreignKeyField: 'fk' },
    ] as any
    const f = useFormFields({ fields, tableData: ref({ cities: [{ name: 'Other' }] }) })
    expect(f.updateDependentFields('sel', 'X', {})).toEqual({})
  })

  test('foreign key update populates joined columns by id', () => {
    const fields = [
      { key: 'fk', type: 'integer', isForeignKey: true, columnsToJoin: ['label'], joinFrom: 'things.id' },
      { key: 'label', type: 'string', isDependentField: true, joinFrom: 'things.label' },
    ] as any
    const f = useFormFields({ fields, tableData: ref({ things: [{ id: 3, label: 'hello' }] }) })
    const out = f.updateDependentFields('fk', 3, {})
    expect(out.label).toBe('hello')
  })
})

describe('useFormFields - submission helpers', () => {
  test('filterDependentFields removes dependent fields', () => {
    const fields = [
      { key: 'a', type: 'string' },
      { key: 'b', type: 'string', isDependentField: true },
    ] as any
    const f = useFormFields({ fields })
    expect(f.filterDependentFields({ a: 1, b: 2 })).toEqual({ a: 1 })
  })

  test('prepareFormDataForSubmit converts types and strips id', () => {
    const fields = [
      { key: 'count', type: 'integer' },
      { key: 'ratio', type: 'number' },
      { key: 'flag', type: 'boolean' },
      { key: 'dep', type: 'string', isDependentField: true },
    ] as any
    const f = useFormFields({ fields })
    const out = f.prepareFormDataForSubmit({
      id: 99,
      count: '5.9',
      ratio: '2.5',
      flag: 'true',
      dep: 'x',
      keep: null,
    })
    expect(out).toEqual({ count: 5, ratio: 2.5, flag: true, keep: null })
    expect(out).not.toHaveProperty('id')
    expect(out).not.toHaveProperty('dep')
  })

  test('prepareFormDataForSubmit keeps dependent fields when requested', () => {
    const fields = [{ key: 'dep', type: 'string', isDependentField: true }] as any
    const f = useFormFields({ fields })
    const out = f.prepareFormDataForSubmit({ dep: 'x' }, 'edit', { keepDependentFields: true })
    expect(out).toEqual({ dep: 'x' })
  })

  test('prepareFormDataForSubmit preserves temp create- ids and bad numbers', () => {
    const fields = [
      { key: 'count', type: 'integer' },
      { key: 'fk', type: 'integer' },
    ] as any
    const f = useFormFields({ fields })
    const out = f.prepareFormDataForSubmit({ count: 'abc', fk: 'create-123' })
    expect(out.count).toBe(0)
    expect(out.fk).toBe('create-123')
  })

  test('prepareFormDataForSubmit passes through null/undefined and unmapped fields', () => {
    const f = useFormFields({ fields: [] as any })
    const out = f.prepareFormDataForSubmit({ a: null, b: undefined, c: 'x' })
    expect(out).toEqual({ a: null, b: undefined, c: 'x' })
  })
})
