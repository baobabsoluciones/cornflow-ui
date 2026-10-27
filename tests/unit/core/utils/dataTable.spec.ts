import { describe, expect, test } from 'vitest'
import type { DataColumn, DataFilter } from '@cornflow-ui/core/components/core/data-table/types'
import {
  checkFilter,
  columnsFromHeaders,
  emptyFilter,
  filterChipValue,
  filterKindOf,
  formatCellValue,
  parseCellInput,
  sortRows,
  toEditText,
  valuePassesFilter,
} from '@cornflow-ui/core/utils/dataTable'

const t = (key: string, named?: Record<string, unknown>) => {
  const texts: Record<string, string> = {
    'table.yes': 'Yes',
    'table.no': 'No',
    'dataTable.filters.since': 'from {value}',
    'dataTable.filters.until': 'until {value}',
    'dataTable.filters.operators.contains': 'contains',
    'dataTable.filters.operators.is_empty': 'is empty',
  }
  return (texts[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(named?.[name] ?? ''))
}

const column = (type: DataColumn['type'], extra: Partial<DataColumn> = {}): DataColumn => ({
  key: 'value',
  title: 'Value',
  type,
  ...extra,
})

const filter = (extra: Partial<DataFilter>): DataFilter => ({
  id: 'f',
  field: 'value',
  operator: 'is',
  value: '',
  ...extra,
})

describe('formatCellValue', () => {
  test('numbers get thousands separators and the column decimals, in the language', () => {
    expect(formatCellValue(1200, column('number'), 'en', t)).toBe('1,200')
    expect(formatCellValue(1200, column('number'), 'es', t)).toBe('1.200')
    expect(formatCellValue(18.5, column('number', { decimals: 2 }), 'es', t)).toBe('18,50')
    expect(formatCellValue(0.125, column('number'), 'en', t)).toBe('0.125')
  })

  test('booleans and switches read Yes/No; lists show the label of the value', () => {
    expect(formatCellValue(true, column('boolean'), 'en', t)).toBe('Yes')
    expect(formatCellValue('false', column('switch'), 'en', t)).toBe('No')
    const list = column('list', { options: [{ value: 'a', label: 'Packing' }] })
    expect(formatCellValue('a', list, 'en', t)).toBe('Packing')
    expect(formatCellValue('b', list, 'en', t)).toBe('b')
  })

  test('dates, date-times and times in the local format', () => {
    expect(formatCellValue('2026-10-27', column('date'), 'es', t)).toBe('27/10/2026')
    expect(formatCellValue('2026-10-27T14:30', column('datetime'), 'es', t)).toContain('14:30')
    expect(formatCellValue('06:00:00', column('time'), 'en', t)).toBe('06:00')
  })

  test('an empty value is null, so the table draws a dash', () => {
    expect(formatCellValue(null, column('text'), 'en', t)).toBeNull()
    expect(formatCellValue('', column('number'), 'en', t)).toBeNull()
  })
})

describe('parseCellInput and toEditText', () => {
  test('a number accepts the separators of the language', () => {
    expect(parseCellInput('1.650,5', column('number'), 'es')).toEqual({ value: 1650.5 })
    expect(parseCellInput('1,650.5', column('number'), 'en')).toEqual({ value: 1650.5 })
  })

  test('an invalid number or an emptied required field is an error', () => {
    expect(parseCellInput('abc', column('number'), 'en')).toEqual({ error: 'dataTable.errors.number' })
    expect(parseCellInput('', column('text', { required: true }), 'en')).toEqual({
      error: 'dataTable.errors.required',
    })
    expect(parseCellInput('  ', column('text'), 'en')).toEqual({ value: null })
  })

  test('booleans parse to true or false', () => {
    expect(parseCellInput(true, column('boolean'), 'en')).toEqual({ value: true })
    expect(parseCellInput('false', column('switch'), 'en')).toEqual({ value: false })
  })

  test('the edit text of a number uses the decimal separator of the language', () => {
    expect(toEditText(18.5, column('number'), 'es')).toBe('18,5')
    expect(toEditText('2026-10-27T14:30:00', column('datetime'), 'en')).toBe('2026-10-27T14:30')
    expect(toEditText(null, column('text'), 'en')).toBe('')
  })
})

describe('columnsFromHeaders', () => {
  test('drops the selection, hidden and foreign-key headers', () => {
    const columns = columnsFromHeaders([
      { key: 'selection' },
      { key: 'id_hidden', hidden: true },
      { key: 'plant_id', isForeignKey: true },
      { key: 'plant_fk', columnsToJoin: ['plant'] },
      { key: 'name', title: 'Name', type: 'string' },
    ])
    expect(columns.map((c) => c.key)).toEqual(['name'])
  })

  test('picks the type of each column from its header', () => {
    const columns = columnsFromHeaders([
      { key: 'fijar', type: 'boolean' },
      { key: 'origin', renderAsSwitch: true },
      { key: 'plant', joinFrom: 'plants.name', isDependentField: true, isMainSelector: true },
      { key: 'plant_code', joinFrom: 'plants.code', isDependentField: true },
      { key: 'kind', choices: ['a', 'b'] },
      { key: 'capacity', type: 'integer', required: true },
      { key: 'start', type: 'date-time' },
      { key: 'start_date', type: 'string' },
    ])
    expect(columns.map((c) => c.type)).toEqual([
      'switch',
      'switch',
      'reference',
      'reference',
      'list',
      'number',
      'datetime',
      'text',
    ])
    expect(columns[2].readOnly).toBe(false)
    expect(columns[3].readOnly).toBe(true)
    expect(columns[4].options).toEqual([
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ])
    expect(columns[5].required).toBe(true)
    expect(columns[7].title).toBe('Start date')
  })
})

describe('sortRows', () => {
  const rows = [{ v: 3 }, { v: null }, { v: 10 }, { v: 1 }]
  const valueOf = (row: { v: number | null }) => row.v

  test('sorts ascending and descending, with empty values last', () => {
    const asc = sortRows(rows, { key: 'v', direction: 'asc' }, column('number'), valueOf)
    expect(asc.map((r) => r.v)).toEqual([1, 3, 10, null])
    const desc = sortRows(rows, { key: 'v', direction: 'desc' }, column('number'), valueOf)
    expect(desc.map((r) => r.v)).toEqual([10, 3, 1, null])
  })

  test('without a sort returns the same rows', () => {
    expect(sortRows(rows, null, column('number'), valueOf)).toBe(rows)
  })

  test('text sorts naturally', () => {
    const lines = [{ v: 'L10' }, { v: 'L2' }, { v: 'l1' }]
    const sorted = sortRows(lines, { key: 'v', direction: 'asc' }, column('text'), (r) => r.v)
    expect(sorted.map((r) => r.v)).toEqual(['l1', 'L2', 'L10'])
  })
})

describe('filters', () => {
  test('each column type has its editor', () => {
    expect(filterKindOf('number')).toBe('range')
    expect(filterKindOf('switch')).toBe('boolean')
    expect(filterKindOf('reference')).toBe('list')
    expect(filterKindOf('datetime')).toBe('dates')
    expect(filterKindOf('time')).toBe('text')
  })

  test('an empty filter starts with the operator of its editor', () => {
    expect(emptyFilter('1', 'a', 'text').operator).toBe('contains')
    expect(emptyFilter('1', 'a', 'list')).toMatchObject({ operator: 'is_any_of', values: [] })
    expect(emptyFilter('1', 'a', 'range').operator).toBe('is_between')
  })

  test('text operators', () => {
    expect(valuePassesFilter('North', filter({ operator: 'is', value: 'North' }))).toBe(true)
    expect(valuePassesFilter('North', filter({ operator: 'is_not', value: 'North' }))).toBe(false)
    expect(valuePassesFilter('North plant', filter({ operator: 'contains', value: 'PLANT' }))).toBe(true)
    expect(valuePassesFilter('North plant', filter({ operator: 'starts_with', value: 'north' }))).toBe(true)
    expect(valuePassesFilter('', filter({ operator: 'is_empty' }))).toBe(true)
    expect(valuePassesFilter(null, filter({ operator: 'has_any_value' }))).toBe(false)
  })

  test('a range with one bound or both', () => {
    expect(valuePassesFilter(15, filter({ operator: 'is_between', value: '10', value2: '' }))).toBe(true)
    expect(valuePassesFilter(5, filter({ operator: 'is_between', value: '10', value2: '' }))).toBe(false)
    expect(valuePassesFilter(5, filter({ operator: 'is_between', value: '', value2: '10' }))).toBe(true)
    expect(valuePassesFilter(null, filter({ operator: 'is_between', value: '1', value2: '' }))).toBe(false)
    expect(
      valuePassesFilter('2026-10-15T08:00', filter({ operator: 'is_between', value: '2026-10-01', value2: '2026-10-15' })),
    ).toBe(true)
    expect(
      valuePassesFilter('2026-10-16', filter({ operator: 'is_between', value: '2026-10-01', value2: '2026-10-15' })),
    ).toBe(false)
  })

  test('one of a list of values', () => {
    const anyOf = filter({ operator: 'is_any_of', values: ['Packing', 2] })
    expect(valuePassesFilter('Packing', anyOf)).toBe(true)
    expect(valuePassesFilter('2', anyOf)).toBe(true)
    expect(valuePassesFilter('Mixing', anyOf)).toBe(false)
  })

  test('checkFilter says when a filter is complete and what is wrong', () => {
    expect(checkFilter(filter({ operator: 'contains', value: ' ' }), 'text').ok).toBe(false)
    expect(checkFilter(filter({ operator: 'is_empty' }), 'text').ok).toBe(true)
    expect(checkFilter(filter({ value: 'x', value2: '' }), 'range')).toEqual({
      ok: false,
      error: 'dataTable.filters.errors.number',
    })
    expect(checkFilter(filter({ value: '50', value2: '10' }), 'range')).toEqual({
      ok: false,
      error: 'dataTable.filters.errors.range',
    })
    expect(checkFilter(filter({ value: '', value2: '10' }), 'range').ok).toBe(true)
    expect(checkFilter(filter({ value: '2026-10-15', value2: '2026-10-01' }), 'dates')).toEqual({
      ok: false,
      error: 'dataTable.filters.errors.dates',
    })
    expect(checkFilter(filter({ values: [] }), 'list').ok).toBe(false)
    expect(checkFilter(filter({ value: 'true' }), 'boolean').ok).toBe(true)
  })

  test('the chip reads the value of the filter', () => {
    expect(filterChipValue(filter({ operator: 'is_between', value: '10', value2: '50' }), column('number'), 'en', t)).toBe(
      '10 – 50',
    )
    expect(filterChipValue(filter({ operator: 'is_between', value: '10', value2: '' }), column('number'), 'en', t)).toBe(
      '≥ 10',
    )
    expect(filterChipValue(filter({ operator: 'is_between', value: '', value2: '2026-10-15' }), column('date'), 'es', t)).toBe(
      'until 15/10/2026',
    )
    expect(filterChipValue(filter({ operator: 'is_any_of', values: ['a', 'b', 'c'] }), column('list'), 'en', t)).toBe('a +2')
    expect(filterChipValue(filter({ value: 'true' }), column('boolean'), 'en', t)).toBe('Yes')
    expect(filterChipValue(filter({ operator: 'contains', value: 'north' }), column('text'), 'en', t)).toBe(
      'contains «north»',
    )
    expect(filterChipValue(filter({ operator: 'is_empty' }), column('text'), 'en', t)).toBe('is empty')
  })
})
