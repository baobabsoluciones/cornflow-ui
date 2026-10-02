import { describe, test, expect } from 'vitest'
import {
  resolveTableColumnOrder,
  readDeclaredColumnOrder,
} from '@cornflow-ui/core/utils/tableColumnOrder'

const PROPS = {
  mes: {},
  variabilidad_numero: {},
  variabilidad_puntualidad: {},
  numero_camiones: {},
  inicio_horario: {},
}
const REQUIRED = ['mes', 'numero_camiones']

describe('resolveTableColumnOrder', () => {
  describe('with rows, the data decides', () => {
    test('returns the first row keys, in the order they arrived', () => {
      const rows = [
        { mes: 'Enero', numero_camiones: 4, variabilidad_numero: '(-1,2)' },
      ]
      // Not the schema order: the schema would put variabilidad_numero second.
      expect(resolveTableColumnOrder(rows, PROPS, REQUIRED)).toEqual([
        'mes',
        'numero_camiones',
        'variabilidad_numero',
      ])
    })

    test('keeps a column the schema never declared', () => {
      // The export keeps it, so the table has to as well.
      const rows = [{ mes: 'Enero', extra: 1 }]
      expect(resolveTableColumnOrder(rows, PROPS, REQUIRED)).toEqual([
        'mes',
        'extra',
      ])
    })

    test('ignores schema columns the data does not carry', () => {
      expect(resolveTableColumnOrder([{ mes: 'Enero' }], PROPS, REQUIRED)).toEqual(
        ['mes'],
      )
    })

    test('skips leading nulls and non-objects to find a real row', () => {
      const rows = [null, 'nonsense', { b: 2, a: 1 }]
      expect(resolveTableColumnOrder(rows, PROPS, REQUIRED)).toEqual(['b', 'a'])
    })

    test('an array row is not a row of columns', () => {
      // Object.keys of an array would yield "0", "1", "2" as column names.
      expect(resolveTableColumnOrder([[1, 2, 3]], PROPS, REQUIRED)).toEqual([
        'mes',
        'numero_camiones',
        'variabilidad_numero',
        'variabilidad_puntualidad',
        'inicio_horario',
      ])
    })
  })

  describe('without rows, required decides', () => {
    test.each([
      ['an empty array', []],
      ['null', null],
      ['undefined', undefined],
    ])('orders by required, then the rest, when rows are %s', (_label, rows) => {
      expect(resolveTableColumnOrder(rows as any, PROPS, REQUIRED)).toEqual([
        // required, in its own order...
        'mes',
        'numero_camiones',
        // ...then everything else the schema declares, in declaration order.
        'variabilidad_numero',
        'variabilidad_puntualidad',
        'inicio_horario',
      ])
    })

    test('an empty table keeps every column, not only the mandatory ones', () => {
      // Losing columns exactly when a table is empty would be worse than the wrong order.
      const order = resolveTableColumnOrder([], PROPS, ['mes'])
      expect(order).toHaveLength(Object.keys(PROPS).length)
      expect(order[0]).toBe('mes')
    })

    test('falls back to properties order when nothing is required', () => {
      expect(resolveTableColumnOrder([], PROPS, [])).toEqual(Object.keys(PROPS))
      expect(resolveTableColumnOrder([], PROPS, undefined)).toEqual(
        Object.keys(PROPS),
      )
    })

    test('a required entry the schema does not declare is dropped', () => {
      expect(resolveTableColumnOrder([], PROPS, ['ghost', 'mes'])).toEqual([
        'mes',
        'variabilidad_numero',
        'variabilidad_puntualidad',
        'numero_camiones',
        'inicio_horario',
      ])
    })

    test('a schema with required but no properties still names its columns', () => {
      expect(resolveTableColumnOrder([], null, ['a', 'b'])).toEqual(['a', 'b'])
      expect(resolveTableColumnOrder([], {}, ['a', 'b'])).toEqual(['a', 'b'])
    })

    test('de-duplicates a repeated required entry', () => {
      expect(resolveTableColumnOrder([], PROPS, ['mes', 'mes'])).toEqual([
        'mes',
        'variabilidad_numero',
        'variabilidad_puntualidad',
        'numero_camiones',
        'inicio_horario',
      ])
    })

    test('nothing at all yields nothing', () => {
      expect(resolveTableColumnOrder([], null, null)).toEqual([])
    })

    test('ignores non-string required entries', () => {
      expect(resolveTableColumnOrder([], PROPS, [1, null, 'mes'] as any)).toEqual(
        ['mes', 'variabilidad_numero', 'variabilidad_puntualidad', 'numero_camiones', 'inicio_horario'],
      )
    })
  })

  describe("the schema's declared order outranks both", () => {
    const ROWS = [{ mes: 'Enero', numero_camiones: 4, inicio_horario: '09:00' }]

    test('beats the data order', () => {
      expect(
        resolveTableColumnOrder(ROWS, PROPS, REQUIRED, [
          'inicio_horario',
          'mes',
          'numero_camiones',
        ]),
      ).toEqual(['inicio_horario', 'mes', 'numero_camiones'])
    })

    test('beats required when there are no rows', () => {
      const order = resolveTableColumnOrder([], PROPS, REQUIRED, [
        'inicio_horario',
      ])
      expect(order[0]).toBe('inicio_horario')
      // ...and the rest still follow the required-first fallback.
      expect(order).toEqual([
        'inicio_horario',
        'mes',
        'numero_camiones',
        'variabilidad_numero',
        'variabilidad_puntualidad',
      ])
    })

    test('a partial order places what it names and leaves the rest alone', () => {
      // It orders columns; it does not select them. Dropping the unnamed ones would put
      // the table back out of step with its own export.
      expect(
        resolveTableColumnOrder(ROWS, PROPS, REQUIRED, ['inicio_horario']),
      ).toEqual(['inicio_horario', 'mes', 'numero_camiones'])
    })

    test('drops a name no column answers to', () => {
      // A stale schema must not add a phantom column.
      expect(resolveTableColumnOrder(ROWS, PROPS, REQUIRED, ['ghost', 'mes'])).toEqual([
        'mes',
        'numero_camiones',
        'inicio_horario',
      ])
    })

    test('de-duplicates', () => {
      expect(
        resolveTableColumnOrder(ROWS, PROPS, REQUIRED, ['mes', 'mes', 'inicio_horario']),
      ).toEqual(['mes', 'inicio_horario', 'numero_camiones'])
    })

    test.each([
      ['empty', []],
      ['null', null],
      ['undefined', undefined],
      ['entirely unknown names', ['ghost']],
    ])('falls back to the default rule when the order is %s', (_label, order) => {
      expect(resolveTableColumnOrder(ROWS, PROPS, REQUIRED, order as any)).toEqual(
        Object.keys(ROWS[0]),
      )
    })
  })
})

describe('readDeclaredColumnOrder', () => {
  test('reads the order from the first candidate that has one', () => {
    expect(readDeclaredColumnOrder({ order: ['a'] }, { order: ['b'] })).toEqual(['a'])
  })

  test('falls through to the table level when the items declare none', () => {
    // `description` sits on the table and `properties` on its items, so "beside
    // properties" and "beside description" are different levels. Both are accepted.
    expect(
      readDeclaredColumnOrder({ properties: {} }, { description: 'x', order: ['b'] }),
    ).toEqual(['b'])
  })

  test.each([
    ['nothing declares one', [{}, null, undefined]],
    ['it is not an array', [{ order: 'a,b' }]],
    ['it is empty', [{ order: [] }]],
    ['it holds no usable names', [{ order: [1, null, ''] }]],
  ])('returns null when %s', (_label, candidates) => {
    expect(readDeclaredColumnOrder(...(candidates as any))).toBeNull()
  })

  test('keeps only the usable names', () => {
    expect(readDeclaredColumnOrder({ order: ['a', 2, '', null, 'b'] } as any)).toEqual([
      'a',
      'b',
    ])
  })
})
