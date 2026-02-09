/**
 * Service for automatically generating dashboards from table data.
 * Analyzes table patterns and creates appropriate visualizations.
 */

export interface DashboardWidget {
  type: 'kpi' | 'line' | 'bar' | 'pie' | 'area' | 'map'
  title: string
  tableKey: string
  config: any
  cols?: number
}

export interface TableAnalysis {
  tableKey: string
  data: any[]
  numericColumns: string[]
  categoricalColumns: string[]
  dateColumns: string[]
  hasTimeSeries: boolean
  hasCategories: boolean
  rowCount: number
  schema?: any
  binaryColumns: string[]
  codeColumns: string[]
  locationColumns: string[]
}

// ---------------------------------------------------------------------------
// Column detection helpers
// ---------------------------------------------------------------------------

/**
 * Find coordinate column pairs (lat/lon) in the table.
 */
function findCoordinateColumns(
  columns: string[],
  data: any[],
): { latCol: string | null; lonCol: string | null } {
  const latPatterns = [/^lat$|^latitude$|^latitud$/i]
  const lonPatterns = [/^lon$|^lng$|^long$|^longitude$|^longitud$/i]

  const latCol =
    columns.find((col) =>
      latPatterns.some((pattern) => pattern.test(col.toLowerCase())),
    ) || null
  const lonCol =
    columns.find((col) =>
      lonPatterns.some((pattern) => pattern.test(col.toLowerCase())),
    ) || null

  if (latCol && lonCol) {
    const sampleSize = Math.min(10, data.length)
    const validSamples = data.slice(0, sampleSize).filter((row) => {
      const lat = Number(row[latCol!])
      const lon = Number(row[lonCol!])
      return (
        !isNaN(lat) &&
        !isNaN(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
      )
    })

    if (validSamples.length / sampleSize >= 0.5) {
      return { latCol, lonCol }
    }
  }

  return { latCol: null, lonCol: null }
}

/**
 * Check if a column name indicates it's a code/ID field.
 * Examples: codigo_refineria, code_user, id_product, etc.
 */
function isCodeColumn(columnName: string, allColumns: string[]): boolean {
  const colLower = columnName.toLowerCase()

  const codePatterns = [
    /^codigo_/,
    /^code_/,
    /^id_/,
    /_codigo$/,
    /_code$/,
    /_id$/,
  ]

  if (codePatterns.some((pattern) => pattern.test(colLower))) {
    const baseName = colLower
      .replace(/^(codigo|code|id)_/, '')
      .replace(/_(codigo|code|id)$/, '')

    const hasCorrespondingColumn = allColumns.some((col) => {
      const otherColLower = col.toLowerCase()
      return (
        otherColLower === baseName ||
        otherColLower === `${baseName}_name` ||
        otherColLower === `name_${baseName}`
      )
    })

    return hasCorrespondingColumn
  }

  if (colLower === 'id') return true
  if (colLower.endsWith('_id') && colLower !== 'id') return true

  return false
}

/**
 * Check if a column is binary (only 0 and 1 values) based on schema or data.
 */
function isBinaryColumn(
  columnName: string,
  schema: any,
  data: any[],
): boolean {
  if (schema?.properties?.[columnName]) {
    const prop = schema.properties[columnName]
    if (
      prop.minimum === 0 &&
      prop.maximum === 1 &&
      (prop.type === 'integer' || prop.type === 'number')
    ) {
      return true
    }
  }

  const sampleValues = data
    .slice(0, Math.min(100, data.length))
    .map((row) => row[columnName])
    .filter((val) => val != null)

  if (sampleValues.length === 0) return false

  const uniqueValues = new Set(sampleValues.map((v) => Number(v)))
  return uniqueValues.size <= 2 && uniqueValues.has(0) && uniqueValues.has(1)
}

/**
 * Determine whether a value is truly numeric (not blank, not a pure string).
 */
function isNumericValue(val: unknown): boolean {
  if (val == null) return false
  if (typeof val === 'number') return !isNaN(val)
  if (typeof val === 'string') {
    const trimmed = val.trim()
    // Reject empty strings – Number('') is 0, which is misleading
    if (trimmed === '') return false
    return !isNaN(Number(trimmed))
  }
  return false
}

/**
 * Common date patterns used for detection.
 */
const DATE_REGEX_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
  /^\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY or MM/DD/YYYY
  /^\d{2}-\d{2}-\d{4}/, // DD-MM-YYYY or MM-DD-YYYY
  /^\d{4}\/\d{2}\/\d{2}/, // YYYY/MM/DD
]

/**
 * Check if a value looks like a date string.
 */
function isDateValue(val: unknown): boolean {
  if (val instanceof Date) return !isNaN(val.getTime())
  if (typeof val !== 'string') return false
  return DATE_REGEX_PATTERNS.some((regex) => regex.test(val))
}

// ---------------------------------------------------------------------------
// Table analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a table to determine its structure and potential visualizations.
 */
export function analyzeTable(
  tableKey: string,
  data: any[],
  schema?: any,
): TableAnalysis | null {
  if (!data || data.length === 0) return null

  const firstRow = data[0]
  const columns = Object.keys(firstRow)
  const numericColumns: string[] = []
  const categoricalColumns: string[] = []
  const dateColumns: string[] = []
  const binaryColumns: string[] = []
  const codeColumns: string[] = []
  const locationColumns: string[] = []

  // First pass: identify code columns
  columns.forEach((col) => {
    if (isCodeColumn(col, columns)) {
      codeColumns.push(col)
    }
  })

  // Check for coordinate columns (lat/lon pairs)
  const coordinateCols = findCoordinateColumns(columns, data)
  if (coordinateCols.latCol && coordinateCols.lonCol) {
    locationColumns.push(coordinateCols.latCol)
    locationColumns.push(coordinateCols.lonCol)
  }

  // Analyze each column
  columns.forEach((col) => {
    // Skip id columns, code columns, and location columns
    if (
      col === 'id' ||
      col.endsWith('_id') ||
      codeColumns.includes(col) ||
      locationColumns.includes(col)
    ) {
      return
    }

    const sampleValues = data
      .slice(0, Math.min(100, data.length))
      .map((row) => row[col])
      .filter((val) => val != null)

    if (sampleValues.length === 0) return

    // Check if binary (before checking if numeric)
    if (isBinaryColumn(col, schema, data)) {
      binaryColumns.push(col)
      return
    }

    // Check if numeric – use strict check that rejects empty strings
    const isNumeric = sampleValues.every((val) => isNumericValue(val))
    if (isNumeric) {
      numericColumns.push(col)
      return
    }

    // Check if date – at least 80% of non-null values should match date patterns
    const dateMatches = sampleValues.filter((val) => isDateValue(val))
    if (dateMatches.length >= sampleValues.length * 0.8) {
      dateColumns.push(col)
      return
    }

    // Otherwise, treat as categorical (only if not too many unique values)
    const uniqueValues = new Set(sampleValues.map(String))
    if (uniqueValues.size <= 50) {
      categoricalColumns.push(col)
    }
  })

  const hasTimeSeries =
    dateColumns.length > 0 && numericColumns.length > 0 && data.length > 1
  const hasCategories =
    categoricalColumns.length > 0 && numericColumns.length > 0 && data.length > 1

  return {
    tableKey,
    data,
    numericColumns,
    categoricalColumns,
    dateColumns,
    hasTimeSeries,
    hasCategories,
    rowCount: data.length,
    schema,
    binaryColumns,
    codeColumns,
    locationColumns,
  }
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Check if all values in an array are zero (or effectively zero).
 */
function allValuesAreZero(values: number[]): boolean {
  if (values.length === 0) return true
  return values.every((v) => Math.abs(v) < 0.0001)
}

type TitleGetter = (key: string, params?: Record<string, string>) => string

function createTitleGetter(
  t?: (key: string, params?: Record<string, string>) => string,
): TitleGetter {
  const translations: Record<string, string> = {
    'dashboard.widgets.total': 'Total {column}',
    'dashboard.widgets.average': 'Average {column}',
    'dashboard.widgets.overTime': '{column} Over Time',
    'dashboard.widgets.by': '{numericColumn} by {categoryColumn}',
    'dashboard.widgets.distributionBy': 'Distribution by {column}',
    'dashboard.widgets.cumulative': 'Cumulative {column}',
    'dashboard.widgets.map': '{valueColumn} Map',
  }

  return (key: string, params: Record<string, string> = {}): string => {
    if (t) return t(key, params)
    let title = translations[key] || key
    Object.entries(params).forEach(([param, value]) => {
      title = title.replace(`{${param}}`, value)
    })
    return title
  }
}

/**
 * Round a number to maximum 2 decimal places.
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Get appropriate icon for a column based on its name.
 */
function getIconForColumn(col: string): string {
  const colLower = col.toLowerCase()

  if (
    colLower.includes('revenue') ||
    colLower.includes('income') ||
    colLower.includes('sales')
  ) {
    return 'mdi-wallet'
  }
  if (
    colLower.includes('cost') ||
    colLower.includes('expense') ||
    colLower.includes('price')
  ) {
    return 'mdi-currency-eur'
  }
  if (colLower.includes('profit') || colLower.includes('margin')) {
    return 'mdi-trending-up'
  }

  if (
    colLower.includes('count') ||
    colLower.includes('quantity') ||
    colLower.includes('total')
  ) {
    return 'mdi-counter'
  }
  if (colLower.includes('amount') || colLower.includes('value')) {
    return 'mdi-cash-multiple'
  }

  if (
    colLower.includes('time') ||
    colLower.includes('duration') ||
    colLower.includes('period')
  ) {
    return 'mdi-clock-outline'
  }

  if (
    colLower.includes('user') ||
    colLower.includes('customer') ||
    colLower.includes('client')
  ) {
    return 'mdi-account'
  }
  if (colLower.includes('employee') || colLower.includes('staff')) {
    return 'mdi-account-group'
  }

  if (
    colLower.includes('performance') ||
    colLower.includes('efficiency') ||
    colLower.includes('rate')
  ) {
    return 'mdi-speedometer'
  }
  if (colLower.includes('score') || colLower.includes('rating')) {
    return 'mdi-star'
  }

  if (colLower.includes('exchange') || colLower.includes('intercambio')) {
    return 'mdi-swap-horizontal'
  }
  if (colLower.includes('transaction') || colLower.includes('transfer')) {
    return 'mdi-swap-vertical'
  }

  if (
    colLower.includes('weight') ||
    colLower.includes('peso') ||
    colLower.includes('mass')
  ) {
    return 'mdi-weight'
  }
  if (
    colLower.includes('distance') ||
    colLower.includes('distancia') ||
    colLower.includes('length')
  ) {
    return 'mdi-map-marker-distance'
  }
  if (
    colLower.includes('capacity') ||
    colLower.includes('capacidad') ||
    colLower.includes('volume')
  ) {
    return 'mdi-gauge'
  }

  return 'mdi-chart-line'
}

/**
 * Get appropriate format for a column based on its name.
 */
function getFormatForColumn(
  col: string,
): 'number' | 'currency' | 'percentage' {
  const colLower = col.toLowerCase()

  const currencyPatterns = [
    'revenue',
    'income',
    'sales',
    'cost',
    'expense',
    'price',
    'amount',
    'value',
    'profit',
    'margin',
  ]

  const percentagePatterns = ['percentage', 'percent', 'rate', 'ratio']

  if (currencyPatterns.some((pattern) => colLower.includes(pattern))) {
    return 'currency'
  }
  if (percentagePatterns.some((pattern) => colLower.includes(pattern))) {
    return 'percentage'
  }

  return 'number'
}

export function formatColumnName(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function groupByDate(
  data: any[],
  dateCol: string,
  numericCol: string,
): Array<{ date: string; value: number }> {
  const grouped: Record<string, number[]> = {}

  data.forEach((row) => {
    const date = row[dateCol]
    const value = Number(row[numericCol])

    if (date && !isNaN(value)) {
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(value)
    }
  })

  return Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      value: roundToTwoDecimals(
        grouped[date].reduce((a, b) => a + b, 0),
      ),
    }))
}

function groupByCategory(
  data: any[],
  catCol: string,
  numericCol: string,
): Array<{ category: string; value: number }> {
  const grouped: Record<string, number[]> = {}

  data.forEach((row) => {
    const category = String(row[catCol])
    const value = Number(row[numericCol])

    if (category && !isNaN(value)) {
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(value)
    }
  })

  return Object.keys(grouped)
    .map((category) => ({
      category,
      value: roundToTwoDecimals(
        grouped[category].reduce((a, b) => a + b, 0),
      ),
    }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Group data by category for multiple numeric columns (multi-series bar chart).
 */
function groupByCategoryMultiSeries(
  data: any[],
  catCol: string,
  numericCols: string[],
): {
  categories: string[]
  series: Array<{ name: string; data: number[] }>
} {
  const grouped: Record<string, Record<string, number[]>> = {}

  data.forEach((row) => {
    const category = String(row[catCol])
    if (!category) return
    if (!grouped[category]) {
      grouped[category] = {}
    }
    numericCols.forEach((col) => {
      const value = Number(row[col])
      if (!isNaN(value)) {
        if (!grouped[category][col]) {
          grouped[category][col] = []
        }
        grouped[category][col].push(value)
      }
    })
  })

  const categories = Object.keys(grouped).sort()
  const series = numericCols.map((col) => ({
    name: formatColumnName(col),
    data: categories.map((cat) => {
      const values = grouped[cat]?.[col] || []
      return roundToTwoDecimals(
        values.reduce((a, b) => a + b, 0),
      )
    }),
  }))

  return { categories, series }
}

// ---------------------------------------------------------------------------
// Widget generators
// ---------------------------------------------------------------------------

/**
 * Generate KPI widgets for numeric columns.
 */
function generateKPIWidgets(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget[] {
  const widgets: DashboardWidget[] = []

  if (analysis.numericColumns.length === 0 || analysis.rowCount === 0) {
    return widgets
  }

  // Only generate KPIs when there are a small number of numeric columns
  if (analysis.numericColumns.length > 4) {
    return widgets
  }

  analysis.numericColumns.forEach((col) => {
    const values = analysis.data
      .map((row) => Number(row[col]))
      .filter((v) => !isNaN(v))
    if (values.length === 0 || allValuesAreZero(values)) return

    const sum = roundToTwoDecimals(values.reduce((a, b) => a + b, 0))
    const avg = roundToTwoDecimals(sum / values.length)
    const icon = getIconForColumn(col)
    const format = getFormatForColumn(col)
    const columnName = formatColumnName(col)

    if (Math.abs(sum) >= 0.01) {
      widgets.push({
        type: 'kpi',
        title: getTitle('dashboard.widgets.total', { column: columnName }),
        tableKey: analysis.tableKey,
        config: {
          value: sum,
          label: getTitle('dashboard.widgets.total', { column: columnName }),
          format,
          icon,
        },
        cols: 4,
      })
    }

    if (Math.abs(avg) >= 0.01) {
      widgets.push({
        type: 'kpi',
        title: getTitle('dashboard.widgets.average', { column: columnName }),
        tableKey: analysis.tableKey,
        config: {
          value: avg,
          label: getTitle('dashboard.widgets.average', {
            column: columnName,
          }),
          format,
          icon,
        },
        cols: 4,
      })
    }
  })

  return widgets
}

/**
 * Generate time series line chart widget.
 */
function generateLineChartWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (
    !analysis.hasTimeSeries ||
    analysis.dateColumns.length === 0 ||
    analysis.numericColumns.length === 0
  ) {
    return null
  }

  const dateCol = analysis.dateColumns[0]

  // Support multi-series line charts (up to 3 numeric columns)
  const numericCols = analysis.numericColumns.slice(0, 3)
  const series: Array<{ name: string; data: number[] }> = []
  let categories: string[] = []

  for (const numericCol of numericCols) {
    const grouped = groupByDate(analysis.data, dateCol, numericCol)
    if (grouped.length <= 1) continue

    const allValues = grouped.map((g) => g.value)
    if (allValuesAreZero(allValues)) continue

    if (categories.length === 0) {
      categories = grouped.map((g) => g.date)
    }

    series.push({
      name: formatColumnName(numericCol),
      data: grouped.map((g) => roundToTwoDecimals(g.value)),
    })
  }

  if (series.length === 0 || categories.length === 0) return null

  const titleCol =
    series.length === 1 ? series[0].name : formatColumnName(dateCol)
  return {
    type: 'line',
    title: getTitle('dashboard.widgets.overTime', { column: titleCol }),
    tableKey: analysis.tableKey,
    config: {
      categories,
      series,
    },
    cols: 12,
  }
}

/**
 * Generate bar chart widget for categorical data.
 * Supports multi-series when multiple numeric columns exist.
 */
function generateBarChartWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (
    !analysis.hasCategories ||
    analysis.categoricalColumns.length === 0 ||
    analysis.numericColumns.length === 0
  ) {
    return null
  }

  const catCol = analysis.categoricalColumns[0]
  if (analysis.binaryColumns.includes(catCol)) return null

  // Check category count
  const uniqueCategories = new Set(analysis.data.map((row) => String(row[catCol])))
  if (uniqueCategories.size <= 1 || uniqueCategories.size > 20) return null

  // Use up to 3 numeric columns for multi-series bar chart
  const numericCols = analysis.numericColumns.slice(0, 3)

  if (numericCols.length === 1) {
    // Single-series bar chart (original logic)
    const grouped = groupByCategory(analysis.data, catCol, numericCols[0])
    if (grouped.length <= 1) return null

    const allValues = grouped.map((g) => g.value)
    if (allValuesAreZero(allValues)) return null

    const numericColName = formatColumnName(numericCols[0])
    const catColName = formatColumnName(catCol)
    return {
      type: 'bar',
      title: getTitle('dashboard.widgets.by', {
        numericColumn: numericColName,
        categoryColumn: catColName,
      }),
      tableKey: analysis.tableKey,
      config: {
        categories: grouped.map((g) => g.category),
        series: [
          {
            name: numericColName,
            data: grouped.map((g) => roundToTwoDecimals(g.value)),
          },
        ],
      },
      cols: 12,
    }
  }

  // Multi-series bar chart
  const multiData = groupByCategoryMultiSeries(
    analysis.data,
    catCol,
    numericCols,
  )
  if (multiData.categories.length <= 1) return null

  // Check that at least one series has non-zero data
  const hasNonZero = multiData.series.some(
    (s) => !allValuesAreZero(s.data),
  )
  if (!hasNonZero) return null

  const catColName = formatColumnName(catCol)
  return {
    type: 'bar',
    title: getTitle('dashboard.widgets.by', {
      numericColumn: multiData.series.map((s) => s.name).join(', '),
      categoryColumn: catColName,
    }),
    tableKey: analysis.tableKey,
    config: {
      categories: multiData.categories,
      series: multiData.series,
    },
    cols: 12,
  }
}

/**
 * Generate pie chart widget for categorical distribution.
 */
function generatePieChartWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (
    !analysis.hasCategories ||
    analysis.categoricalColumns.length === 0 ||
    analysis.numericColumns.length === 0
  ) {
    return null
  }

  const catCol = analysis.categoricalColumns[0]
  const numericCol = analysis.numericColumns[0]

  if (analysis.binaryColumns.includes(catCol)) return null

  const grouped = groupByCategory(analysis.data, catCol, numericCol)
  if (grouped.length < 2 || grouped.length > 10) return null

  const allValues = grouped.map((g) => g.value)
  if (allValuesAreZero(allValues)) return null

  // Filter out negative values for pie charts
  const positiveGrouped = grouped.filter((g) => g.value > 0)
  if (positiveGrouped.length < 2) return null

  const catColName = formatColumnName(catCol)
  return {
    type: 'pie',
    title: getTitle('dashboard.widgets.distributionBy', {
      column: catColName,
    }),
    tableKey: analysis.tableKey,
    config: {
      labels: positiveGrouped.map((g) => g.category),
      series: positiveGrouped.map((g) => roundToTwoDecimals(g.value)),
    },
    cols: 6,
  }
}

/**
 * Generate area chart widget for cumulative data.
 */
function generateAreaChartWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (
    !analysis.hasTimeSeries ||
    analysis.dateColumns.length === 0 ||
    analysis.numericColumns.length === 0
  ) {
    return null
  }

  const dateCol = analysis.dateColumns[0]
  const numericCol = analysis.numericColumns[0]
  const grouped = groupByDate(analysis.data, dateCol, numericCol)

  if (grouped.length <= 1) return null

  const allValues = grouped.map((g) => g.value)
  if (allValuesAreZero(allValues)) return null

  let cumulative = 0
  const numericColName = formatColumnName(numericCol)
  const cumulativeTitle = getTitle('dashboard.widgets.cumulative', {
    column: numericColName,
  })

  return {
    type: 'area',
    title: cumulativeTitle,
    tableKey: analysis.tableKey,
    config: {
      categories: grouped.map((g) => g.date),
      series: [
        {
          name: cumulativeTitle,
          data: grouped.map((g) => {
            cumulative += g.value
            return roundToTwoDecimals(cumulative)
          }),
        },
      ],
    },
    cols: 12,
  }
}

/**
 * Collect valid coordinate data from analysis.
 */
function collectCoordinateData(
  analysis: TableAnalysis,
  coordinateCols: { latCol: string; lonCol: string },
  valueCol: string,
  valueType: 'binary' | 'numeric',
): Array<{ lat: number; lon: number; value: number }> {
  const coordinateData: Array<{ lat: number; lon: number; value: number }> =
    []

  analysis.data.forEach((row) => {
    const lat = Number(row[coordinateCols.latCol])
    const lon = Number(row[coordinateCols.lonCol])
    const value = Number(row[valueCol]) || 0

    const isValidCoordinate =
      !isNaN(lat) &&
      !isNaN(lon) &&
      !isNaN(value) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180

    if (isValidCoordinate) {
      coordinateData.push({
        lat: roundToTwoDecimals(lat),
        lon: roundToTwoDecimals(lon),
        value: valueType === 'binary' ? value : roundToTwoDecimals(value),
      })
    }
  })

  return coordinateData
}

/**
 * Generate map widget for coordinate columns.
 */
function generateMapWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (analysis.locationColumns.length < 2) return null

  const allColumns =
    analysis.data.length > 0 ? Object.keys(analysis.data[0]) : []
  const coordinateCols = findCoordinateColumns(allColumns, analysis.data)

  if (!coordinateCols.latCol || !coordinateCols.lonCol) return null

  // Find value column (prefer binary, then numeric)
  let valueCol: string | null = null
  let valueType: 'binary' | 'numeric' = 'numeric'

  if (analysis.binaryColumns.length > 0) {
    valueCol = analysis.binaryColumns[0]
    valueType = 'binary'
  } else if (analysis.numericColumns.length > 0) {
    valueCol = analysis.numericColumns[0]
  }

  if (!valueCol) return null

  const coordinateData = collectCoordinateData(
    analysis,
    {
      latCol: coordinateCols.latCol,
      lonCol: coordinateCols.lonCol,
    },
    valueCol,
    valueType,
  )

  const allValues = coordinateData.map((d) => d.value)
  if (allValuesAreZero(allValues) || coordinateData.length === 0) return null

  const valueColName = formatColumnName(valueCol)
  return {
    type: 'map',
    title: getTitle('dashboard.widgets.map', {
      valueColumn: valueColName,
    }),
    tableKey: analysis.tableKey,
    config: {
      coordinates: coordinateData.map((d) => [d.lat, d.lon]),
      values: coordinateData.map((d) => d.value),
      valueType,
      valueColumn: valueColName,
    },
    cols: 12,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate dashboard widgets from table analysis.
 */
export function generateDashboardWidgets(
  analysis: TableAnalysis,
  locale: string = 'en',
  t?: (key: string, params?: Record<string, string>) => string,
): DashboardWidget[] {
  const getTitle = createTitleGetter(t)
  const widgets: DashboardWidget[] = []

  // Generate KPI widgets
  widgets.push(...generateKPIWidgets(analysis, getTitle))

  // Generate chart widgets
  const lineChart = generateLineChartWidget(analysis, getTitle)
  if (lineChart) widgets.push(lineChart)

  const barChart = generateBarChartWidget(analysis, getTitle)
  if (barChart) widgets.push(barChart)

  const pieChart = generatePieChartWidget(analysis, getTitle)
  if (pieChart) widgets.push(pieChart)

  const areaChart = generateAreaChartWidget(analysis, getTitle)
  if (areaChart) widgets.push(areaChart)

  const mapWidget = generateMapWidget(analysis, getTitle)
  if (mapWidget) widgets.push(mapWidget)

  return widgets
}

/**
 * Generate complete dashboard layout from execution data.
 */
export function generateAutoDashboard(
  executionData: any,
  dashboardType: 'instance' | 'solution',
  tableKey?: string,
  locale: string = 'en',
  t?: (key: string, params?: Record<string, string>) => string,
  tableSchema?: any,
): DashboardWidget[] {
  const widgets: DashboardWidget[] = []

  if (!executionData) return widgets

  const dataSource = executionData.data || {}

  if (tableKey) {
    const tableData = dataSource[tableKey]
    if (!Array.isArray(tableData) || tableData.length === 0) return widgets

    const schema =
      tableSchema?.get_list?.response_schema?.items || tableSchema

    const analysis = analyzeTable(tableKey, tableData, schema)
    if (!analysis) return widgets

    const tableWidgets = generateDashboardWidgets(analysis, locale, t)
    widgets.push(...tableWidgets)
    return widgets
  }

  // Otherwise, analyze each table (backward compatibility)
  Object.keys(dataSource).forEach((key) => {
    const tableData = dataSource[key]
    if (!Array.isArray(tableData) || tableData.length === 0) return

    const analysis = analyzeTable(key, tableData)
    if (!analysis) return

    const tableWidgets = generateDashboardWidgets(analysis, locale, t)
    widgets.push(...tableWidgets)
  })

  return widgets
}
