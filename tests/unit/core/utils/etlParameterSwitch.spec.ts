import { describe, test, expect } from 'vitest'
import {
  resolveEtlParamKey,
  resolveReuploadedParameterSwitchValue,
  etlParameterSwitchValue,
  normalizeTableNameForLookup,
  resolveEtlParameterSwitchKey,
  fromDbParameterSwitchKey,
} from '@cornflow-ui/core/utils/etlParameterSwitch'

describe('resolveEtlParamKey', () => {
  test('vertical parameter tables key by tableKey.rowId', () => {
    expect(resolveEtlParamKey({ isParameterTableVertical: true }, {}, 'T', 5, 'whatever')).toBe('T.5')
  })

  test('etl field keys resolve via the row param name (name/ID/key)', () => {
    expect(resolveEtlParamKey({}, { name: 'p1' }, 'T', 1, '__etl_default__')).toBe('T.p1')
    expect(resolveEtlParamKey({}, { ID: 'p2' }, 'T', 1, '__etl_from_db__')).toBe('T.p2')
    expect(resolveEtlParamKey({}, { key: 'p3' }, 'T', 1, '__etl_fixed__')).toBe('T.p3')
  })

  test('returns null when the param name is missing or the field is not an etl switch', () => {
    expect(resolveEtlParamKey({}, {}, 'T', 1, '__etl_default__')).toBeNull()
    expect(resolveEtlParamKey({}, { name: 'p' }, 'T', 1, 'regularField')).toBeNull()
  })
})

describe('resolveReuploadedParameterSwitchValue', () => {
  test('maps each etl field toggle to its parameterSwitches value', () => {
    expect(resolveReuploadedParameterSwitchValue('__etl_default__', true)).toBeNull()
    expect(resolveReuploadedParameterSwitchValue('__etl_default__', false)).toBe(false)
    expect(resolveReuploadedParameterSwitchValue('__etl_from_db__', true)).toBe(false)
    expect(resolveReuploadedParameterSwitchValue('__etl_from_db__', false)).toBeNull()
    expect(resolveReuploadedParameterSwitchValue('__etl_fixed__', true)).toBe(true)
    expect(resolveReuploadedParameterSwitchValue('__etl_fixed__', false)).toBeNull()
  })

  test('returns undefined for unknown field keys', () => {
    expect(resolveReuploadedParameterSwitchValue('other', true)).toBeUndefined()
  })
})

describe('etlParameterSwitchValue', () => {
  test('non-reuploaded: ON -> false (from DB), OFF -> true (fixed)', () => {
    expect(etlParameterSwitchValue('__etl_from_db__', true, false)).toBe(false)
    expect(etlParameterSwitchValue('__etl_from_db__', false, false)).toBe(true)
  })

  test('reuploaded: the value of the toggled field', () => {
    expect(etlParameterSwitchValue('__etl_fixed__', true, true)).toBe(true)
    expect(etlParameterSwitchValue('__etl_default__', true, true)).toBeNull()
  })

  test('reuploaded with an unknown field sets nothing', () => {
    expect(etlParameterSwitchValue('unknown', true, true)).toBeUndefined()
  })
})

describe('normalizeTableNameForLookup', () => {
  test('normalizes spaces, hyphens, camelCase and casing', () => {
    expect(normalizeTableNameForLookup('')).toBe('')
    expect(normalizeTableNameForLookup('Operadores Intercambios')).toBe('operadores_intercambios')
    expect(normalizeTableNameForLookup('foo-bar')).toBe('foo_bar')
    expect(normalizeTableNameForLookup('camelCase')).toBe('camel_case')
    expect(normalizeTableNameForLookup('UPPER')).toBe('upper')
    expect(normalizeTableNameForLookup('lower')).toBe('lower')
  })
})

describe('resolveEtlParameterSwitchKey', () => {
  test('exact and case-insensitive full matches', () => {
    expect(resolveEtlParameterSwitchKey({ parameterSwitches: { 'T.5': false } }, 'T', 5)).toBe('T.5')
    expect(resolveEtlParameterSwitchKey({ parameterSwitches: { 't.5': true } }, 'T', '5')).toBe('t.5')
  })

  test('normalized-table + matching row', () => {
    const flow = { parameterSwitches: { 'My Table.r1': false } }
    expect(resolveEtlParameterSwitchKey(flow, 'my_table', 'r1')).toBe('My Table.r1')
  })

  test('unique row-suffix fallback', () => {
    const flow = { parameterSwitches: { 'SomeOther.x': false } }
    expect(resolveEtlParameterSwitchKey(flow, 'zzz', 'x')).toBe('SomeOther.x')
  })

  test('returns null when nothing matches', () => {
    expect(resolveEtlParameterSwitchKey({ parameterSwitches: { 'A.1': false } }, 'B', 2)).toBeNull()
  })
})

describe('fromDbParameterSwitchKey', () => {
  test('a resolved "from DB" (false) switch', () => {
    expect(fromDbParameterSwitchKey({ parameterSwitches: { 'T.5': false } }, 'T', 5)).toBe('T.5')
  })

  test('none when the resolved switch is not from DB', () => {
    expect(fromDbParameterSwitchKey({ parameterSwitches: { 'T.5': null } }, 'T', 5)).toBeNull()
  })

  test('none when no switch matches', () => {
    expect(fromDbParameterSwitchKey({ parameterSwitches: { 'A.1': false } }, 'B', 2)).toBeNull()
  })
})
