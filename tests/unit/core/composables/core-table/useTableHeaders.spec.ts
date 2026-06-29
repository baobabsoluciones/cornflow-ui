import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Control what getListResponseRowProperties returns per test.
const ctrl = vi.hoisted(() => ({ rowSchema: null as any }))
vi.mock('@/utils/schemaUtils', () => ({
  getListResponseRowProperties: () => ctrl.rowSchema,
}))

import { useTableHeaders } from '@/composables/core-table/useTableHeaders'

const $t = (key: string) => key
const getColumnAlignment = (type: string) => (type === 'boolean' ? 'center' : 'start')

beforeEach(() => {
  ctrl.rowSchema = null
})

function setup(opts: {
  canDelete?: boolean
  showActions?: boolean
  localized?: any
  config?: any
}) {
  return useTableHeaders(
    ref(opts.localized ?? null),
    ref(opts.config ?? { title: 'cfg' }),
    ref(opts.canDelete ?? false),
    ref(opts.showActions ?? false),
    getColumnAlignment,
    $t,
  )
}

describe('useTableHeaders', () => {
  test('builds headers from schema, filtering id and frontendReadOnly', () => {
    ctrl.rowSchema = {
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', title: 'Name' },
        active: { type: 'boolean' },
        secret: { type: 'string', frontendReadOnly: true },
      },
    }
    const { headers } = setup({})
    const keys = headers.value.map((h: any) => h.key)
    expect(keys).toEqual(['name', 'active'])
    expect(headers.value.find((h: any) => h.key === 'active').align).toBe('center')
    expect(headers.value.find((h: any) => h.key === 'name').title).toBe('Name')
  })

  test('uses key as title when title missing', () => {
    ctrl.rowSchema = { properties: { code: { type: 'string' } } }
    const { headers } = setup({})
    expect(headers.value[0].title).toBe('code')
  })

  test('prepends selection column when canDeleteItems', () => {
    ctrl.rowSchema = { properties: { name: { type: 'string' } } }
    const { headers } = setup({ canDelete: true })
    expect(headers.value[0].key).toBe('selection')
    expect(headers.value[0].sortable).toBe(false)
  })

  test('appends actions column when showActionsColumn (schema path)', () => {
    ctrl.rowSchema = { properties: { name: { type: 'string' } } }
    const { headers } = setup({ showActions: true })
    const last = headers.value[headers.value.length - 1]
    expect(last.key).toBe('actions')
    expect(last.title).toBe('table.actions')
  })

  test('prefers localizedTableConfig over tableConfig (both still resolved via mock)', () => {
    ctrl.rowSchema = { properties: { name: { type: 'string' } } }
    const { headers } = setup({ localized: { title: 'loc' } })
    expect(headers.value.map((h: any) => h.key)).toContain('name')
  })

  test('falls back to default Name header when no schema', () => {
    ctrl.rowSchema = null
    const { headers } = setup({})
    expect(headers.value).toEqual([{ title: 'Name', key: 'name', sortable: true }])
  })

  test('default path appends actions column when showActionsColumn', () => {
    ctrl.rowSchema = null
    const { headers } = setup({ showActions: true })
    expect(headers.value.map((h: any) => h.key)).toEqual(['name', 'actions'])
  })

  test('default path includes selection column when canDeleteItems', () => {
    ctrl.rowSchema = null
    const { headers } = setup({ canDelete: true })
    expect(headers.value[0].key).toBe('selection')
  })
})
