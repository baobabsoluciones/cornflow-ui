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
  idColumns: string[]
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
 * Check if a column name indicates it's an ID / identifier field.
 * These columns should NEVER be aggregated (sum, average, etc.) because
 * their numeric values carry no meaningful information.
 *
 * Catches patterns such as:
 *   id, _id, id_, id_employee, employee_id, codigo_X, code_X, X_code, etc.
 */
function isIdColumn(columnName: string): boolean {
  const colLower = columnName.toLowerCase().trim()

  // Exact matches
  if (colLower === 'id' || colLower === 'idx' || colLower === 'index') {
    return true
  }

  // Prefix patterns: id_, id., id-, idx_
  if (/^(id|idx)[_.\-\s]/.test(colLower)) return true

  // Suffix patterns: _id, .id, -id
  if (/[_.\-\s](id|idx)$/.test(colLower)) return true

  // Contains _id_ or .id. in the middle
  if (/[_.\-\s](id|idx)[_.\-\s]/.test(colLower)) return true

  return false
}

/**
 * Check if a column name indicates it's a code/identifier field.
 * Examples: codigo_refineria, code_user, etc.
 * These are always excluded from numeric aggregation.
 */
function isCodeColumn(columnName: string): boolean {
  const colLower = columnName.toLowerCase().trim()

  // Code/codigo patterns (always treated as identifiers)
  const codePatterns = [
    /^codigo[_.\-\s]/,
    /^code[_.\-\s]/,
    /[_.\-\s]codigo$/,
    /[_.\-\s]code$/,
    /^cod[_.\-\s]/,
    /[_.\-\s]cod$/,
  ]

  return codePatterns.some((pattern) => pattern.test(colLower))
}

/**
 * Check whether a column is an identifier (ID or code) that should be
 * excluded from any numeric aggregation or chart generation.
 */
function isIdentifierColumn(columnName: string): boolean {
  return isIdColumn(columnName) || isCodeColumn(columnName)
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
 * Heuristic: detect whether a numeric column looks like a sequential
 * identifier (auto-increment primary key or similar).
 *
 * A column is considered a sequential ID when:
 * - All sample values are integers
 * - Almost every value is unique (≥ 90%)
 * - The values roughly span from 1..N (range ≈ count)
 */
function looksLikeSequentialId(
  _columnName: string,
  sampleValues: unknown[],
  totalRows: number,
): boolean {
  if (sampleValues.length < 5) return false

  const nums = sampleValues.map(Number)
  // Must all be integers
  if (!nums.every((n) => Number.isInteger(n))) return false

  const uniqueCount = new Set(nums).size
  const uniqueRatio = uniqueCount / nums.length

  // Almost all values should be unique
  if (uniqueRatio < 0.9) return false

  const minVal = Math.min(...nums)
  const maxVal = Math.max(...nums)
  const range = maxVal - minVal + 1

  // The range should be close to the total row count (±50%)
  // This catches patterns like 1, 2, 3, ... N
  if (range <= totalRows * 1.5 && minVal >= 0 && range >= totalRows * 0.5) {
    return true
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
  const idColumns: string[] = []
  const codeColumns: string[] = []
  const locationColumns: string[] = []

  // First pass: identify ID and code columns (these are never aggregated)
  columns.forEach((col) => {
    if (isIdColumn(col)) {
      idColumns.push(col)
    } else if (isCodeColumn(col)) {
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
    // Skip identifier columns (id, code), and location columns entirely
    if (
      isIdentifierColumn(col) ||
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
      // Additional heuristic: if a numeric column looks like a sequential
      // identifier (all unique integers that form a near-continuous range),
      // treat it as an ID column instead of a numeric one.
      if (looksLikeSequentialId(col, sampleValues, data.length)) {
        idColumns.push(col)
        return
      }
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
    idColumns,
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

type AggregationMethod = 'sum' | 'avg'

/**
 * Determine the best aggregation method for a numeric column.
 *
 * Uses "average" when the data has multiple rows per group and the column
 * looks like a rate/ratio/per-unit measure. Falls back to "sum" otherwise.
 */
function chooseAggregation(
  colName: string,
  data: any[],
  groupCol: string,
): AggregationMethod {
  const colLower = colName.toLowerCase()

  // Columns that semantically represent rates/averages should always be averaged
  const avgPatterns = [
    'rate',
    'ratio',
    'percentage',
    'percent',
    'avg',
    'average',
    'mean',
    'score',
    'rating',
    'efficiency',
    'utilization',
    'index',
    'factor',
    'coefficient',
    'price',
    'unit_cost',
    'per_',
    '_per_',
  ]
  if (avgPatterns.some((p) => colLower.includes(p))) return 'avg'

  // If most groups have multiple rows, average is often more meaningful
  const groups: Record<string, number> = {}
  data.forEach((row) => {
    const key = String(row[groupCol] ?? '')
    groups[key] = (groups[key] || 0) + 1
  })
  const groupValues = Object.values(groups)
  const avgGroupSize =
    groupValues.length > 0
      ? groupValues.reduce((a, b) => a + b, 0) / groupValues.length
      : 1

  // If average group size > 3, use average (many rows per group)
  if (avgGroupSize > 3) return 'avg'

  return 'sum'
}

function aggregate(values: number[], method: AggregationMethod): number {
  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  return method === 'avg' ? roundToTwoDecimals(sum / values.length) : roundToTwoDecimals(sum)
}

function groupByDate(
  data: any[],
  dateCol: string,
  numericCol: string,
  aggMethod: AggregationMethod = 'sum',
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
      value: aggregate(grouped[date], aggMethod),
    }))
}

function groupByCategory(
  data: any[],
  catCol: string,
  numericCol: string,
  aggMethod: AggregationMethod = 'sum',
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
      value: aggregate(grouped[category], aggMethod),
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
  aggMethods?: AggregationMethod[],
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
  const series = numericCols.map((col, idx) => {
    const method = aggMethods?.[idx] ?? 'sum'
    return {
      name: formatColumnName(col),
      data: categories.map((cat) => {
        const values = grouped[cat]?.[col] || []
        return aggregate(values, method)
      }),
    }
  })

  return { categories, series }
}

// ---------------------------------------------------------------------------
// Smart column selection helpers
// ---------------------------------------------------------------------------

/**
 * Pick the best categorical column for a chart.
 *
 * Ranking criteria (lower score = better):
 * 1. Ideal cardinality for the chart type (pie: 2-8, bar: 3-15)
 * 2. Avoid columns that look like names or free-text (very high uniqueness)
 * 3. Prefer columns with meaningful labels (not single-char categories)
 */
function pickBestCategoricalColumn(
  analysis: TableAnalysis,
  chartType: 'pie' | 'bar',
): string | null {
  if (analysis.categoricalColumns.length === 0) return null

  const idealRange =
    chartType === 'pie' ? { min: 2, max: 8 } : { min: 2, max: 20 }

  const scored = analysis.categoricalColumns.map((col) => {
    const uniqueValues = new Set(analysis.data.map((row) => String(row[col])))
    const cardinality = uniqueValues.size
    let score = 0

    // Penalise if cardinality is outside ideal range
    if (cardinality < idealRange.min) {
      score += (idealRange.min - cardinality) * 10
    } else if (cardinality > idealRange.max) {
      score += (cardinality - idealRange.max) * 5
    }

    // Penalise very-high-cardinality columns (likely names / free text)
    const uniqueRatio = cardinality / analysis.data.length
    if (uniqueRatio > 0.8) score += 50

    // Penalise columns whose values are all single characters
    const allSingleChar = [...uniqueValues].every((v) => v.length <= 1)
    if (allSingleChar) score += 20

    return { col, score, cardinality }
  })

  scored.sort((a, b) => a.score - b.score)

  const best = scored[0]
  // Reject if cardinality is completely outside chart limits
  if (best.cardinality < 2) return null
  if (chartType === 'pie' && best.cardinality > 15) return null
  if (chartType === 'bar' && best.cardinality > 30) return null

  return best.col
}

/**
 * Pick the best numeric columns for chart series.
 * Filters out columns that are all-zero and returns up to `maxCols`.
 */
function pickBestNumericColumns(
  analysis: TableAnalysis,
  maxCols: number,
): string[] {
  return analysis.numericColumns
    .filter((col) => {
      const values = analysis.data
        .map((row) => Number(row[col]))
        .filter((v) => !isNaN(v))
      return !allValuesAreZero(values)
    })
    .slice(0, maxCols)
}

// ---------------------------------------------------------------------------
// Widget generators
// ---------------------------------------------------------------------------

/**
 * Determine whether "total" (sum) is a meaningful KPI for a column.
 * Rates, percentages, prices-per-unit, etc. should NOT be summed.
 */
function isSummableColumn(colName: string): boolean {
  const colLower = colName.toLowerCase()
  const nonSummablePatterns = [
    'rate',
    'ratio',
    'percentage',
    'percent',
    'avg',
    'average',
    'mean',
    'score',
    'rating',
    'efficiency',
    'utilization',
    'index',
    'factor',
    'coefficient',
    'price',
    'unit_cost',
    'per_',
    '_per_',
  ]
  return !nonSummablePatterns.some((p) => colLower.includes(p))
}

/**
 * Generate KPI widgets for numeric columns.
 * Generates at most 1 KPI per column: Total for summable columns, Average for rate-like columns.
 * Limits total KPIs to 4 to avoid clutter.
 */
function generateKPIWidgets(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget[] {
  const widgets: DashboardWidget[] = []

  if (analysis.numericColumns.length === 0 || analysis.rowCount === 0) {
    return widgets
  }

  // Only generate KPIs when there are a manageable number of numeric columns
  if (analysis.numericColumns.length > 6) {
    return widgets
  }

  analysis.numericColumns.forEach((col) => {
    // Limit total KPIs to 4
    if (widgets.length >= 4) return

    const values = analysis.data
      .map((row) => Number(row[col]))
      .filter((v) => !isNaN(v))
    if (values.length === 0 || allValuesAreZero(values)) return

    const sum = roundToTwoDecimals(values.reduce((a, b) => a + b, 0))
    const avg = roundToTwoDecimals(sum / values.length)
    const icon = getIconForColumn(col)
    const format = getFormatForColumn(col)
    const columnName = formatColumnName(col)

    if (isSummableColumn(col) && Math.abs(sum) >= 0.01) {
      // Show Total for summable columns (count, quantity, amount, etc.)
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
    } else if (Math.abs(avg) >= 0.01) {
      // Show Average for rate/percentage/non-summable columns
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

  // Support multi-series line charts (up to 3 non-zero numeric columns)
  const numericCols = pickBestNumericColumns(analysis, 3)
  const series: Array<{ name: string; data: number[] }> = []
  let categories: string[] = []

  for (const numericCol of numericCols) {
    const aggMethod = chooseAggregation(numericCol, analysis.data, dateCol)
    const grouped = groupByDate(analysis.data, dateCol, numericCol, aggMethod)
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

  // Pick the best categorical column for a bar chart
  const catCol = pickBestCategoricalColumn(analysis, 'bar')
  if (!catCol) return null
  if (analysis.binaryColumns.includes(catCol)) return null

  // Use up to 3 non-zero numeric columns
  const numericCols = pickBestNumericColumns(analysis, 3)
  if (numericCols.length === 0) return null

  if (numericCols.length === 1) {
    // Single-series bar chart with smart aggregation
    const aggMethod = chooseAggregation(numericCols[0], analysis.data, catCol)
    const grouped = groupByCategory(analysis.data, catCol, numericCols[0], aggMethod)
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

  // Multi-series bar chart with per-column aggregation
  const aggMethods = numericCols.map((col) =>
    chooseAggregation(col, analysis.data, catCol),
  )
  const multiData = groupByCategoryMultiSeries(
    analysis.data,
    catCol,
    numericCols,
    aggMethods,
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

  // Pick the best categorical column for a pie chart (low cardinality)
  const catCol = pickBestCategoricalColumn(analysis, 'pie')
  if (!catCol) return null
  if (analysis.binaryColumns.includes(catCol)) return null

  // Pick the first non-zero numeric column
  const numericCols = pickBestNumericColumns(analysis, 1)
  if (numericCols.length === 0) return null
  const numericCol = numericCols[0]

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
 * Prefers a numeric column not already used by the line chart.
 */
function generateAreaChartWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
  usedCols: Set<string> = new Set(),
): DashboardWidget | null {
  if (
    !analysis.hasTimeSeries ||
    analysis.dateColumns.length === 0 ||
    analysis.numericColumns.length === 0
  ) {
    return null
  }

  const dateCol = analysis.dateColumns[0]

  // Prefer a numeric column that hasn't been used by the line chart
  let numericCol = analysis.numericColumns.find((c) => !usedCols.has(c))
  // Fall back to first numeric column only if nothing else exists
  if (!numericCol) numericCol = analysis.numericColumns[0]

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

  // Track which numeric columns are already used, to avoid redundant charts
  const usedNumericCols = new Set<string>()

  // Generate time-series line chart
  const lineChart = generateLineChartWidget(analysis, getTitle)
  if (lineChart) {
    widgets.push(lineChart)
    // Mark the numeric columns used in the line chart
    lineChart.config?.series?.forEach((s: any) => {
      const col = analysis.numericColumns.find(
        (c) => formatColumnName(c) === s.name,
      )
      if (col) usedNumericCols.add(col)
    })
  }

  // Generate area chart only if there are unused numeric columns for it,
  // OR if there are at least 2 numeric columns total (so it's not redundant)
  if (analysis.numericColumns.length > 1 || !lineChart) {
    const areaChart = generateAreaChartWidget(analysis, getTitle, usedNumericCols)
    if (areaChart) widgets.push(areaChart)
  }

  // Generate categorical charts
  const barChart = generateBarChartWidget(analysis, getTitle)
  if (barChart) widgets.push(barChart)

  const pieChart = generatePieChartWidget(analysis, getTitle)
  if (pieChart) widgets.push(pieChart)

  // Generate map widget
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
