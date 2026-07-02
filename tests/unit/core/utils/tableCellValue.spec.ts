import { describe, test, expect, vi } from 'vitest'

vi.mock('@cornflow-ui/core/utils/schemaUtils', () => ({
  parseJoinFrom: (jf: string) => {
    const [table, field] = String(jf).split('.')
    return table && field ? { table, field } : null
  },
}))
vi.mock('@cornflow-ui/core/utils/i18nUtils', () => ({
  resolveTitle: (title: any, fb: string) => (typeof title === 'string' ? title : fb),
}))

import { resolveJoinFromValue } from '@cornflow-ui/core/utils/tableCellValue'

const header = { foreignKeyField: 'orderId', joinFrom: 'orders.name' }

describe('resolveJoinFromValue', () => {
  test('returns the valueNone title when the FK is empty', () => {
    const h = { ...header, valueNone: { title: 'None' } }
    expect(resolveJoinFromValue({ orderId: null }, h, {})).toBe('None')
  })

  test('looks up the joined field by row id', () => {
    const tableData = { orders: [{ id: 5, name: 'Order 5' }] }
    expect(resolveJoinFromValue({ orderId: 5 }, header, tableData)).toBe('Order 5')
  })

  test('matches by the foreign key field when id does not match', () => {
    const tableData = { orders: [{ id: 1, orderId: 5, name: 'By FK' }] }
    expect(resolveJoinFromValue({ orderId: 5 }, header, tableData)).toBe('By FK')
  })

  test('returns undefined when there is no table data or no matching row', () => {
    expect(resolveJoinFromValue({ orderId: 5 }, header, null)).toBeUndefined()
    expect(resolveJoinFromValue({ orderId: 9 }, header, { orders: [{ id: 5, name: 'x' }] })).toBeUndefined()
  })

  test('returns undefined when joinFrom is unparseable', () => {
    expect(
      resolveJoinFromValue({ orderId: 5 }, { foreignKeyField: 'orderId', joinFrom: 'bad' }, { orders: [] }),
    ).toBeUndefined()
  })
})
