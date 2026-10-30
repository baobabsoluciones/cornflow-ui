import { describe, test, expect, vi } from 'vitest'
import {
  applySourceConfigFieldValues,
  convertValueByType,
  getValueFromSource,
  hasValidDataSource,
  isEmptyConfigValue,
  resolveAllConfigFieldValues,
  seedConfigFieldDefaults,
} from '@cornflow-ui/core/composables/create-execution/configFieldValues'
import {
  groupLoadErrors,
  singleLoadError,
  LOAD_ERRORS_PER_TABLE,
} from '@cornflow-ui/core/composables/create-execution/loadErrors'
import {
  humanizeFileName,
  proposeExecutionName,
} from '@cornflow-ui/core/composables/create-execution/executionName'

/** Echoes the key and its params, so the tests read what is asked for, not a translation. */
const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}${JSON.stringify(params)}` : key

describe('configFieldValues', () => {
  const data = {
    params: { horizon: '4', rate: '0.5' },
    settings: [
      { name: 'mode', value: 'fast' },
      { name: 'other', value: 'x' },
    ],
  }

  test('reads a key of an object table', () => {
    expect(getValueFromSource({ key: 'h', type: 'number', param: 'horizon' } as any, data.params)).toBe('4')
  })

  test('reads the row matched by value with arrayByValue', () => {
    const field = {
      key: 'm',
      type: 'text',
      lookupType: 'arrayByValue',
      param: 'mode',
      lookupParam: 'name',
      lookupValue: 'value',
    } as any
    expect(getValueFromSource(field, data.settings)).toBe('fast')
    expect(getValueFromSource({ ...field, param: 'missing' }, data.settings)).toBeUndefined()
  })

  test('converts numbers and floats and keeps the rest', () => {
    expect(convertValueByType('1.5', 'float')).toBe(1.5)
    expect(convertValueByType('3', 'number')).toBe(3)
    expect(convertValueByType('keep', 'text')).toBe('keep')
  })

  test('knows whether the field has its source table in the data', () => {
    expect(hasValidDataSource({ source: 'params' } as any, data)).toBe(true)
    expect(hasValidDataSource({ source: 'missing' } as any, data)).toBe(false)
  })

  test('settles every field from the data or its default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fields = [
      { key: 'horizon', type: 'number', source: 'params', param: 'horizon' },
      { key: 'limit', type: 'number', default: 300 },
      { key: 'absent', type: 'number', source: 'params', param: 'nope', default: 1 },
    ] as any[]
    expect(resolveAllConfigFieldValues(fields, { solver: 's' }, data)).toEqual({
      solver: 's',
      horizon: 4,
      limit: 300,
      absent: 1,
    })
    warn.mockRestore()
  })

  test('takes the data values of the fields with a source and says which', () => {
    const fields = [
      { key: 'rate', type: 'float', source: 'params', param: 'rate' },
      { key: 'limit', type: 'number', default: 300 },
    ] as any[]
    expect(applySourceConfigFieldValues(fields, { limit: 10 }, data)).toEqual({
      config: { limit: 10, rate: 0.5 },
      fromData: ['rate'],
    })
  })

  test('seeds defaults only where there is no value', () => {
    const fields = [
      { key: 'a', type: 'number', default: 1 },
      { key: 'b', type: 'number', default: 2 },
    ] as any[]
    expect(seedConfigFieldDefaults(fields, { a: 5 })).toEqual({ a: 5, b: 2 })
  })

  test('a boolean is empty until it is true or false', () => {
    expect(isEmptyConfigValue({ type: 'boolean' } as any, undefined)).toBe(true)
    expect(isEmptyConfigValue({ type: 'boolean' } as any, false)).toBe(false)
    expect(isEmptyConfigValue({ type: 'text' } as any, '')).toBe(true)
    expect(isEmptyConfigValue({ type: 'number' } as any, 0)).toBe(false)
  })
})

describe('loadErrors', () => {
  const schema = {
    properties: {
      lines: {
        title: 'Lines',
        items: { properties: { line: { title: 'Line' }, capacity: { title: 'Capacity' } } },
      },
    },
  }
  const data = { lines: [{ line: 'L1', capacity: 'high' }] }

  test('groups by table and words each error by row and column', () => {
    const result = groupLoadErrors(
      [{ instancePath: '/lines/0/capacity', keyword: 'type', params: { type: 'number' } }],
      schema,
      data,
      t,
    )
    expect(result.count).toBe(1)
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].title).toBe('Lines')
    expect(result.groups[0].items[0]).toContain('createExecution.loadErrors.rowWithLabel{"row":1,"label":"L1"}')
    expect(result.groups[0].items[0]).toContain('"column":"Capacity"')
  })

  test('a required error names the missing column', () => {
    const result = groupLoadErrors(
      [{ instancePath: '/lines/0', keyword: 'required', params: { missingProperty: 'capacity' } }],
      schema,
      null,
      t,
    )
    expect(result.groups[0].items[0]).toContain('createExecution.loadErrors.row{"row":1}')
    expect(result.groups[0].items[0]).toContain('"column":"Capacity"')
  })

  test('lists a few per table and counts the rest', () => {
    const errors = Array.from({ length: LOAD_ERRORS_PER_TABLE + 3 }, (_, i) => ({
      instancePath: `/lines/${i}/capacity`,
      keyword: 'type',
      params: { type: 'number' },
    }))
    const result = groupLoadErrors(errors, schema, null, t)
    expect(result.count).toBe(LOAD_ERRORS_PER_TABLE + 3)
    expect(result.groups[0].items).toHaveLength(LOAD_ERRORS_PER_TABLE + 1)
    expect(result.groups[0].items.at(-1)).toBe('createExecution.loadErrors.more{"count":3}')
  })

  test('an error that is not from the schema becomes plain lines', () => {
    const result = singleLoadError('<p><strong>ETL failed</strong></p><li>Bad sheet</li>', t)
    expect(result.groups[0].items).toEqual(['ETL failed', 'Bad sheet'])
  })
})

describe('executionName', () => {
  const date = new Date(2026, 9, 23)

  test('turns a file name into words', () => {
    expect(humanizeFileName('plan_week-43.xlsx')).toBe('Plan week 43')
  })

  test('takes the first file and the load filters', () => {
    expect(
      proposeExecutionName({
        fileNames: ['plan_week_43.xlsx', 'other.xlsx'],
        filterLabels: ['North plant', ''],
        fromExecution: null,
        date,
        t,
      }),
    ).toBe('Plan week 43 · North plant')
  })

  test('without files, names the data by its date', () => {
    expect(
      proposeExecutionName({ fileNames: [], filterLabels: [], fromExecution: null, date, t }),
    ).toBe('createExecution.name.fromDatabase{"date":"23/10/2026"}')
  })

  test('a relaunch keeps the name it comes from', () => {
    expect(
      proposeExecutionName({ fileNames: [], filterLabels: [], fromExecution: 'Plan 42', date, t }),
    ).toBe('createExecution.name.relaunch{"name":"Plan 42"}')
  })
})
