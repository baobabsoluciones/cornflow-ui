import { describe, test, expect } from 'vitest'
import {
  resolveEtlParamKey,
  resolveReuploadedParameterSwitchValue,
  applyEtlParameterSwitch,
  normalizeTableNameForLookup,
  resolveEtlParameterSwitchKey,
  turnOffEtlParameterFromDbSwitchAfterManualValueEdit,
} from '@/utils/etlParameterSwitch'

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

describe('applyEtlParameterSwitch', () => {
  test('non-reuploaded: ON -> false (from DB), OFF -> true (fixed)', () => {
    const flow: any = { parameterSwitches: {} }
    applyEtlParameterSwitch(flow, 'T.p', '__etl_from_db__', true, false)
    expect(flow.parameterSwitches['T.p']).toBe(false)
    applyEtlParameterSwitch(flow, 'T.p', '__etl_from_db__', false, false)
    expect(flow.parameterSwitches['T.p']).toBe(true)
  })

  test('reuploaded: writes the resolved value', () => {
    const flow: any = { parameterSwitches: {} }
    applyEtlParameterSwitch(flow, 'T.p', '__etl_fixed__', true, true)
    expect(flow.parameterSwitches['T.p']).toBe(true)
  })

  test('reuploaded with an unknown field is a no-op', () => {
    const flow: any = { parameterSwitches: { 'T.p': 'untouched' } }
    applyEtlParameterSwitch(flow, 'T.p', 'unknown', true, true)
    expect(flow.parameterSwitches['T.p']).toBe('untouched')
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

describe('turnOffEtlParameterFromDbSwitchAfterManualValueEdit', () => {
  test('flips a resolved "from DB" (false) switch to fixed (true)', () => {
    const flow = { parameterSwitches: { 'T.5': false } }
    turnOffEtlParameterFromDbSwitchAfterManualValueEdit(flow, 'T', 5)
    expect(flow.parameterSwitches['T.5']).toBe(true)
  })

  test('leaves a non-false resolved switch untouched', () => {
    const flow = { parameterSwitches: { 'T.5': null } }
    turnOffEtlParameterFromDbSwitchAfterManualValueEdit(flow, 'T', 5)
    expect(flow.parameterSwitches['T.5']).toBeNull()
  })

  test('no-op when no switch matches', () => {
    const flow = { parameterSwitches: { 'A.1': false } }
    turnOffEtlParameterFromDbSwitchAfterManualValueEdit(flow, 'B', 2)
    expect(flow.parameterSwitches['A.1']).toBe(false)
  })
})
