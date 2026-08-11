import { describe, expect, it } from 'vitest'
import {
  analyzeTable,
  formatColumnName,
  generateDashboardWidgets,
  generateAutoDashboard,
  type TableAnalysis,
  type DashboardWidget,
} from '@cornflow-ui/core/services/AutoDashboardService'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Time-series + categorical + numeric data. */
const salesRows = [
  { fecha: '2026-01-01', region: 'Norte', revenue: 100, cost: 40 },
  { fecha: '2026-01-02', region: 'Sur', revenue: 200, cost: 80 },
  { fecha: '2026-01-03', region: 'Norte', revenue: 150, cost: 60 },
  { fecha: '2026-01-04', region: 'Sur', revenue: 250, cost: 90 },
  { fecha: '2026-01-05', region: 'Este', revenue: 50, cost: 20 },
]

/** Rows with lat/lon coordinates and a binary flag. */
const geoRows = [
  { lat: 40.4, lon: -3.7, activo: 1, ciudad: 'Madrid' },
  { lat: 41.4, lon: 2.1, activo: 0, ciudad: 'Barcelona' },
  { lat: 37.4, lon: -5.9, activo: 1, ciudad: 'Sevilla' },
  { lat: 39.5, lon: -0.4, activo: 1, ciudad: 'Valencia' },
]

// ---------------------------------------------------------------------------
// formatColumnName
// ---------------------------------------------------------------------------

describe('formatColumnName', () => {
  it('replaces underscores and title-cases words', () => {
    expect(formatColumnName('total_revenue')).toBe('Total Revenue')
  })

  it('splits camelCase into words', () => {
    expect(formatColumnName('totalRevenue')).toBe('Total Revenue')
  })

  it('handles a single lowercase word', () => {
    expect(formatColumnName('revenue')).toBe('Revenue')
  })

  it('returns empty string for empty input', () => {
    expect(formatColumnName('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// analyzeTable
// ---------------------------------------------------------------------------

describe('analyzeTable', () => {
  it('returns null for empty data', () => {
    expect(analyzeTable('t', [])).toBeNull()
  })

  it('returns null for null data', () => {
    expect(analyzeTable('t', null as unknown as any[])).toBeNull()
  })

  it('classifies numeric, categorical and date columns', () => {
    const analysis = analyzeTable('sales', salesRows)!
    expect(analysis).not.toBeNull()
    expect(analysis.tableKey).toBe('sales')
    expect(analysis.rowCount).toBe(5)
    expect(analysis.numericColumns).toEqual(
      expect.arrayContaining(['revenue', 'cost']),
    )
    expect(analysis.categoricalColumns).toContain('region')
    expect(analysis.dateColumns).toContain('fecha')
    expect(analysis.hasTimeSeries).toBe(true)
    expect(analysis.hasCategories).toBe(true)
  })

  it('detects id columns and excludes them from numeric columns', () => {
    const rows = [
      { employee_id: 10, name: 'a', salary: 1000 },
      { employee_id: 11, name: 'b', salary: 2000 },
    ]
    const analysis = analyzeTable('emp', rows)!
    expect(analysis.idColumns).toContain('employee_id')
    expect(analysis.numericColumns).not.toContain('employee_id')
    expect(analysis.numericColumns).toContain('salary')
  })

  it('detects exact "id" column', () => {
    const rows = [
      { id: 1, value: 5 },
      { id: 2, value: 6 },
    ]
    const analysis = analyzeTable('t', rows)!
    expect(analysis.idColumns).toContain('id')
  })

  it('detects code columns', () => {
    const rows = [
      { codigo_refineria: 'R1', amount: 5 },
      { codigo_refineria: 'R2', amount: 6 },
    ]
    const analysis = analyzeTable('t', rows)!
    expect(analysis.codeColumns).toContain('codigo_refineria')
    expect(analysis.numericColumns).not.toContain('codigo_refineria')
  })

  it('detects binary columns via data values', () => {
    const analysis = analyzeTable('geo', geoRows)!
    expect(analysis.binaryColumns).toContain('activo')
    expect(analysis.numericColumns).not.toContain('activo')
  })

  it('detects binary columns via schema minimum/maximum', () => {
    const rows = [
      { flag: 1, val: 10 },
      { flag: 1, val: 20 },
    ]
    const schema = {
      properties: {
        flag: { type: 'integer', minimum: 0, maximum: 1 },
      },
    }
    const analysis = analyzeTable('t', rows, schema)!
    expect(analysis.binaryColumns).toContain('flag')
    expect(analysis.schema).toBe(schema)
  })

  it('detects coordinate columns as location columns', () => {
    const analysis = analyzeTable('geo', geoRows)!
    expect(analysis.locationColumns).toEqual(
      expect.arrayContaining(['lat', 'lon']),
    )
    // lat/lon must not appear as numeric columns
    expect(analysis.numericColumns).not.toContain('lat')
    expect(analysis.numericColumns).not.toContain('lon')
  })

  it('does not treat invalid lat/lon as coordinates', () => {
    const rows = [
      { lat: 999, lon: 999, v: 1 },
      { lat: 888, lon: 888, v: 2 },
    ]
    const analysis = analyzeTable('t', rows)!
    expect(analysis.locationColumns).toHaveLength(0)
  })

  it('treats a near-sequential integer column as an id', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      seq: i + 1,
      label: `item${i % 3}`,
      measure: i * 2,
    }))
    const analysis = analyzeTable('t', rows)!
    expect(analysis.idColumns).toContain('seq')
    expect(analysis.numericColumns).not.toContain('seq')
  })

  it('rejects empty-string values as non-numeric (categorical)', () => {
    const rows = [
      { code: '', n: 1 },
      { code: '', n: 2 },
    ]
    const analysis = analyzeTable('t', rows)!
    // empty strings are not numeric; unique set is {''} -> categorical
    expect(analysis.numericColumns).not.toContain('code')
  })

  it('ignores columns with too many unique categorical values', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      label: `unique_${i}`,
      n: 1,
    }))
    const analysis = analyzeTable('t', rows)!
    // 60 unique strings > 50 limit -> not categorical
    expect(analysis.categoricalColumns).not.toContain('label')
  })

  it('skips columns that are all null', () => {
    const rows = [
      { empty: null, n: 1 },
      { empty: null, n: 2 },
    ]
    const analysis = analyzeTable('t', rows)!
    expect(analysis.numericColumns).not.toContain('empty')
    expect(analysis.categoricalColumns).not.toContain('empty')
  })

  it('detects Date objects as date columns', () => {
    const rows = [
      { when: '2026-01-01', n: 1 },
      { when: '2026-01-02', n: 2 },
    ]
    const analysis = analyzeTable('t', rows)!
    expect(analysis.dateColumns).toContain('when')
  })

  it('hasTimeSeries is false with a single row', () => {
    const analysis = analyzeTable('t', [
      { fecha: '2026-01-01', revenue: 100, region: 'Norte' },
    ])!
    expect(analysis.hasTimeSeries).toBe(false)
    expect(analysis.hasCategories).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateDashboardWidgets
// ---------------------------------------------------------------------------

describe('generateDashboardWidgets', () => {
  it('generates KPI + line + bar + pie widgets for rich data', () => {
    const analysis = analyzeTable('sales', salesRows)!
    const widgets = generateDashboardWidgets(analysis)
    const types = widgets.map((w) => w.type)
    expect(types).toContain('kpi')
    expect(types).toContain('line')
    expect(types).toContain('bar')
    // every widget carries the table key
    widgets.forEach((w) => expect(w.tableKey).toBe('sales'))
  })

  it('produces KPI titles using the default title getter', () => {
    const analysis = analyzeTable('sales', salesRows)!
    const widgets = generateDashboardWidgets(analysis)
    const kpi = widgets.find((w) => w.type === 'kpi')!
    expect(kpi.title).toContain('Total')
    expect(kpi.config.value).toBeGreaterThan(0)
    expect(kpi.config.format).toBe('currency')
  })

  it('uses a custom translation function when provided', () => {
    const analysis = analyzeTable('sales', salesRows)!
    const t = (key: string) => `TR:${key}`
    const widgets = generateDashboardWidgets(analysis, 'es', t)
    const kpi = widgets.find((w) => w.type === 'kpi')!
    expect(kpi.title).toBe('TR:dashboard.widgets.total')
  })

  it('returns no widgets for purely categorical data without numerics', () => {
    const rows = [
      { region: 'Norte', city: 'Bilbao' },
      { region: 'Sur', city: 'Cadiz' },
    ]
    const analysis = analyzeTable('t', rows)!
    const widgets = generateDashboardWidgets(analysis)
    expect(widgets).toHaveLength(0)
  })

  it('generates a map widget for coordinate data', () => {
    const analysis = analyzeTable('geo', geoRows)!
    const widgets = generateDashboardWidgets(analysis)
    const map = widgets.find((w) => w.type === 'map')
    expect(map).toBeDefined()
    expect(map!.config.coordinates.length).toBeGreaterThan(0)
    expect(map!.config.valueType).toBe('binary')
  })

  it('uses average aggregation for rate-like columns in KPIs', () => {
    const rows = [
      { region: 'A', efficiency_rate: 80 },
      { region: 'B', efficiency_rate: 60 },
      { region: 'C', efficiency_rate: 100 },
    ]
    const analysis = analyzeTable('t', rows)!
    const widgets = generateDashboardWidgets(analysis)
    const kpi = widgets.find((w) => w.type === 'kpi')
    expect(kpi).toBeDefined()
    expect(kpi!.title).toContain('Average')
    // (80+60+100)/3 = 80
    expect(kpi!.config.value).toBe(80)
  })

  it('does not generate KPIs when there are too many numeric columns', () => {
    const row: Record<string, number> = {}
    for (let i = 0; i < 7; i++) row[`measure_${i}`] = i + 1
    const analysis = analyzeTable('t', [row, { ...row }])!
    const widgets = generateDashboardWidgets(analysis)
    expect(widgets.filter((w) => w.type === 'kpi')).toHaveLength(0)
  })

  it('skips charts when all numeric values are zero', () => {
    const rows = [
      { fecha: '2026-01-01', region: 'A', amount: 0 },
      { fecha: '2026-01-02', region: 'B', amount: 0 },
    ]
    const analysis = analyzeTable('t', rows)!
    const widgets = generateDashboardWidgets(analysis)
    expect(widgets.filter((w) => w.type === 'line')).toHaveLength(0)
    expect(widgets.filter((w) => w.type === 'bar')).toHaveLength(0)
    expect(widgets.filter((w) => w.type === 'kpi')).toHaveLength(0)
  })

  it('generates a multi-series line chart for multiple numeric columns', () => {
    const analysis = analyzeTable('sales', salesRows)!
    const widgets = generateDashboardWidgets(analysis)
    const line = widgets.find((w) => w.type === 'line') as DashboardWidget
    expect(line).toBeDefined()
    expect(line.config.series.length).toBeGreaterThanOrEqual(1)
    expect(line.config.categories.length).toBeGreaterThan(1)
  })

  it('generates an area chart when there are multiple numeric columns', () => {
    const analysis = analyzeTable('sales', salesRows)!
    const widgets = generateDashboardWidgets(analysis)
    const area = widgets.find((w) => w.type === 'area')
    expect(area).toBeDefined()
    expect(area!.config.series[0].data.length).toBeGreaterThan(1)
  })
})

// ---------------------------------------------------------------------------
// generateAutoDashboard
// ---------------------------------------------------------------------------

describe('generateAutoDashboard', () => {
  it('returns empty array when executionData is falsy', () => {
    expect(generateAutoDashboard(null, 'instance')).toEqual([])
    expect(generateAutoDashboard(undefined, 'solution')).toEqual([])
  })

  it('returns empty array for a missing/empty table key', () => {
    const exec = { data: { sales: [] } }
    expect(generateAutoDashboard(exec, 'instance', 'sales')).toEqual([])
    expect(generateAutoDashboard(exec, 'instance', 'missing')).toEqual([])
  })

  it('returns empty array when table key data is not an array', () => {
    const exec = { data: { sales: { not: 'array' } } }
    expect(generateAutoDashboard(exec, 'instance', 'sales')).toEqual([])
  })

  it('generates widgets for a specific table key', () => {
    const exec = { data: { sales: salesRows } }
    const widgets = generateAutoDashboard(exec, 'instance', 'sales')
    expect(widgets.length).toBeGreaterThan(0)
    widgets.forEach((w) => expect(w.tableKey).toBe('sales'))
  })

  it('uses table schema when provided for a specific table', () => {
    const exec = { data: { sales: salesRows } }
    const schema = {
      get_list: {
        response_schema: {
          items: {
            properties: {
              revenue: { type: 'number' },
            },
          },
        },
      },
    }
    const widgets = generateAutoDashboard(
      exec,
      'instance',
      'sales',
      'en',
      undefined,
      schema,
    )
    expect(widgets.length).toBeGreaterThan(0)
  })

  it('analyzes all tables when no table key is given', () => {
    const exec = {
      data: {
        sales: salesRows,
        geo: geoRows,
        emptyTable: [],
        notArray: 'nope',
      },
    }
    const widgets = generateAutoDashboard(exec, 'solution')
    const tableKeys = new Set(widgets.map((w) => w.tableKey))
    expect(tableKeys.has('sales')).toBe(true)
    expect(tableKeys.has('geo')).toBe(true)
    expect(tableKeys.has('emptyTable')).toBe(false)
  })

  it('handles executionData without a data property', () => {
    expect(generateAutoDashboard({}, 'instance')).toEqual([])
  })

  it('passes a custom translation function through', () => {
    const exec = { data: { sales: salesRows } }
    const t = (key: string) => `X:${key}`
    const widgets = generateAutoDashboard(exec, 'instance', 'sales', 'es', t)
    const kpi = widgets.find((w) => w.type === 'kpi')!
    expect(kpi.title.startsWith('X:')).toBe(true)
  })
})
