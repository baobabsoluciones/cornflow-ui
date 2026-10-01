import { describe, test, expect } from 'vitest'
import { prepareSheetData } from '@cornflow-ui/core/utils/excelStyling'

const schema = {
  properties: {
    turnos: {
      items: {
        required: ['id_turno', 'hora_inicio'],
        properties: {
          nombre: {},
          id_turno: {},
          hora_inicio: {},
          hora_fin: {},
        },
      },
    },
    sin_required: { items: { properties: { a: {}, b: {} } } },
    sin_nada: { items: {} },
  },
}

describe('prepareSheetData — the empty-table half of the column-order rule', () => {
  test('orders an empty sheet by required, then the remaining columns', () => {
    const result = prepareSheetData([], schema, 'turnos')

    // `required` leads — `nombre` is declared first but is not mandatory.
    expect(Object.keys(result![0])).toEqual([
      'id_turno',
      'hora_inicio',
      'nombre',
      'hora_fin',
    ])
  })

  test('an empty sheet keeps every column, not only the mandatory ones', () => {
    // Before, the sheet carried only `required`, so an empty table silently lost the
    // optional columns the on-screen table shows.
    expect(Object.keys(prepareSheetData([], schema, 'turnos')![0])).toHaveLength(4)
  })

  test('a table with no required at all still gets its columns', () => {
    // These sheets used to be dropped from the workbook entirely.
    expect(Object.keys(prepareSheetData([], schema, 'sin_required')![0])).toEqual([
      'a',
      'b',
    ])
  })

  test('a sheet the schema says nothing about is still skipped', () => {
    expect(prepareSheetData([], schema, 'sin_nada')).toBeNull()
    expect(prepareSheetData([], null, 'cualquiera')).toBeNull()
  })

  test('rows are left alone — the data orders itself', () => {
    const rows = [{ hora_fin: '21:00', id_turno: 1 }]
    expect(prepareSheetData(rows, schema, 'turnos')).toBe(rows)
  })
})
