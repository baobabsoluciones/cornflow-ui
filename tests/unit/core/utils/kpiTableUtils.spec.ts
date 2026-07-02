import { describe, test, expect } from 'vitest'
import {
  generateKpiTableConfigs,
  applyKpiDisplayMode,
  KPI_DUPLICATE_TABLE_KEY_SUFFIX,
} from '@cornflow-ui/core/utils/kpiTableUtils'
import { formatTitle } from '@cornflow-ui/core/utils/schemaUtils'

describe('kpiTableUtils - generateKpiTableConfigs', () => {
  test('returns {} for nullish or non-object input', () => {
    expect(generateKpiTableConfigs(null as any, 'G')).toEqual({})
    expect(generateKpiTableConfigs(undefined as any, 'G')).toEqual({})
    expect(generateKpiTableConfigs(42 as any, 'G')).toEqual({})
  })

  test('skips tables that are not non-empty arrays of objects', () => {
    const out = generateKpiTableConfigs(
      {
        notArray: { a: 1 } as any,
        empty: [],
        primitiveRows: [1, 2, 3] as any,
        nullRow: [null] as any,
      },
      'G',
    )
    expect(out).toEqual({})
  })

  test('builds a schema with detected column types and required keys', () => {
    const out = generateKpiTableConfigs(
      { sales: [{ region: 'north', units: 10, active: true }] },
      'KPI tables',
    )
    const cfg = out.sales as any
    expect(cfg.group).toBe('KPI tables')
    expect(cfg._isFromRawKpis).toBe(true)
    expect(cfg._rawKpisSourceKey).toBe('sales')
    expect(cfg.title).toBe(formatTitle('sales'))

    const props = cfg.get_list.response_schema.items.properties
    expect(props.region).toEqual({ title: formatTitle('region'), type: 'string' })
    expect(props.units.type).toBe('number')
    expect(props.active.type).toBe('boolean')
    expect(cfg.get_list.response_schema.items.required).toEqual([
      'region',
      'units',
      'active',
    ])
    expect(cfg.get_list.http_method).toBe('GET')
  })
})

describe('kpiTableUtils - applyKpiDisplayMode', () => {
  const base: any = { existing: { group: 'Datos', title: 'Existing' } }

  test('returns the base config untouched when disabled or no kpis', () => {
    expect(applyKpiDisplayMode(base, { x: [{ a: 1 }] }, 'disabled')).toBe(base)
    expect(applyKpiDisplayMode(base, null, 'separate')).toBe(base)
    expect(applyKpiDisplayMode(base, {}, 'separate')).toBe(base)
  })

  test('separate mode adds non-overlapping KPI tables in their own group', () => {
    const merged = applyKpiDisplayMode(base, { newKpi: [{ v: 1 }] }, 'separate', 'es') as any
    expect(merged.existing).toBe(base.existing)
    expect(merged.newKpi).toBeDefined()
    // Spanish group label
    expect(merged.newKpi.group).toBe('Tabla de KPIs')
  })

  test('separate mode aliases KPI tables whose key collides with the base config', () => {
    const merged = applyKpiDisplayMode(base, { existing: [{ v: 1 }] }, 'separate', 'fr') as any
    const aliasKey = `existing${KPI_DUPLICATE_TABLE_KEY_SUFFIX}`
    // base entry preserved, KPI copy added under the suffixed key
    expect(merged.existing).toBe(base.existing)
    expect(merged[aliasKey]).toBeDefined()
    expect(merged[aliasKey]._rawKpisSourceKey).toBe('existing')
    expect(merged[aliasKey].group).toBe('Tableau de KPI')
  })

  test('unknown locale falls back to the English group title', () => {
    const merged = applyKpiDisplayMode(base, { k: [{ v: 1 }] }, 'separate', 'de') as any
    expect(merged.k.group).toBe('KPI tables')
  })
})
