/**
 * Service for automatically generating dashboards from table data
 * Analyzes table patterns and creates appropriate visualizations
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
  schema?: any // Schema information for better analysis
  binaryColumns: string[] // Columns that are binary (0 or 1)
  codeColumns: string[] // Columns that are codes/IDs (should be excluded)
  locationColumns: string[] // Columns that contain coordinates (lat/lon)
}

/**
 * Check if a column contains coordinate data (latitude or longitude)
 * Looks for patterns like: lat, lon, latitude, longitude, coord, etc.
 */
function isLocationColumn(columnName: string, data: any[]): boolean {
  const colLower = columnName.toLowerCase()
  
  // Check for common coordinate-related column names
  const coordinatePatterns = [
    /^lat$|^latitude$|^latitud$/i,
    /^lon$|^lng$|^long$|^longitude$|^longitud$/i,
    /coord/i,
  ]
  
  return coordinatePatterns.some((pattern) => pattern.test(colLower))
}

/**
 * Find coordinate column pairs (lat/lon) in the table
 */
function findCoordinateColumns(columns: string[], data: any[]): { latCol: string | null; lonCol: string | null } {
  let latCol: string | null = null
  let lonCol: string | null = null
  
  // Look for latitude column
  const latPatterns = [/^lat$|^latitude$|^latitud$/i]
  latCol = columns.find((col) => latPatterns.some((pattern) => pattern.test(col.toLowerCase()))) || null
  
  // Look for longitude column
  const lonPatterns = [/^lon$|^lng$|^long$|^longitude$|^longitud$/i]
  lonCol = columns.find((col) => lonPatterns.some((pattern) => pattern.test(col.toLowerCase()))) || null
  
  // If we found both, verify they contain valid numeric coordinates
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
    
    // At least 50% of samples should be valid coordinates
    if (validSamples.length / sampleSize >= 0.5) {
      return { latCol, lonCol }
    }
  }
  
  return { latCol: null, lonCol: null }
}

/**
 * Check if a column name indicates it's a code/ID field
 * Examples: codigo_refineria, code_user, id_product, etc.
 */
function isCodeColumn(columnName: string, allColumns: string[]): boolean {
  const colLower = columnName.toLowerCase()
  
  // Check for common code/ID patterns
  const codePatterns = [
    /^codigo_/,
    /^code_/,
    /^id_/,
    /_codigo$/,
    /_code$/,
    /_id$/,
  ]
  
  // Check if column name matches code patterns
  if (codePatterns.some((pattern) => pattern.test(colLower))) {
    // Extract the base name (e.g., "refineria" from "codigo_refineria")
    const baseName = colLower
      .replace(/^(codigo|code|id)_/, '')
      .replace(/_(codigo|code|id)$/, '')
    
    // Check if there's a corresponding column without the code prefix/suffix
    // e.g., if "codigo_refineria" exists, check for "refineria"
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
  
  // Also check for standalone id columns (but not the main 'id' field)
  if (colLower === 'id') return true
  if (colLower.endsWith('_id') && colLower !== 'id') return true
  
  return false
}

/**
 * Check if a column is binary (only 0 and 1 values) based on schema or data
 */
function isBinaryColumn(
  columnName: string,
  schema: any,
  data: any[],
): boolean {
  // Check schema first for minimum/maximum constraints
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
  
  // Check data if schema doesn't indicate binary
  const sampleValues = data
    .slice(0, Math.min(100, data.length))
    .map((row) => row[columnName])
    .filter((val) => val != null)
  
  if (sampleValues.length === 0) return false
  
  // Check if all values are 0 or 1
  const uniqueValues = new Set(sampleValues.map((v) => Number(v)))
  return uniqueValues.size <= 2 && uniqueValues.has(0) && uniqueValues.has(1)
}

/**
 * Analyze a table to determine its structure and potential visualizations
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
    // Store both columns as location columns (we'll use them together for maps)
    locationColumns.push(coordinateCols.latCol)
    locationColumns.push(coordinateCols.lonCol)
  }

  // Analyze each column
  columns.forEach((col) => {
    // Skip id columns and code columns
    if (col === 'id' || col.endsWith('_id') || codeColumns.includes(col)) {
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
      // Don't add binary columns to numeric or categorical - they're not useful for widgets
      return
    }

    // Check if numeric
    const isNumeric = sampleValues.every(
      (val) => typeof val === 'number' || !isNaN(Number(val)),
    )
    if (isNumeric) {
      numericColumns.push(col)
      return
    }

    // Check if date (basic check)
    const isDate =
      sampleValues.some(
        (val) =>
          typeof val === 'string' &&
          (val.match(/^\d{4}-\d{2}-\d{2}/) ||
            val.match(/^\d{2}\/\d{2}\/\d{4}/)),
      ) || sampleValues.some((val) => val instanceof Date)
    if (isDate) {
      dateColumns.push(col)
      return
    }

    // Otherwise, treat as categorical
    categoricalColumns.push(col)
  })

  // Determine if it's a time series (has date column and numeric columns)
  const hasTimeSeries = dateColumns.length > 0 && numericColumns.length > 0

  // Determine if it has categories
  const hasCategories = categoricalColumns.length > 0

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

/**
 * Check if all values in an array are zero (or effectively zero)
 */
function allValuesAreZero(values: number[]): boolean {
  if (values.length === 0) return true
  return values.every((v) => Math.abs(v) < 0.0001) // Use small epsilon for floating point comparison
}

// Type for title getter function
type TitleGetter = (key: string, params?: Record<string, string>) => string

/**
 * Create a title getter function with optional translation support
 */
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
 * Generate KPI widgets for numeric columns
 */
function generateKPIWidgets(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget[] {
  const widgets: DashboardWidget[] = []
  
  if (analysis.numericColumns.length === 0 || analysis.rowCount === 0) {
    return widgets
  }
  
  if (analysis.numericColumns.length > 3) {
    return widgets
  }

  analysis.numericColumns.forEach((col) => {
    const values = analysis.data.map((row) => Number(row[col])).filter((v) => !isNaN(v))
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
        config: { value: sum, label: getTitle('dashboard.widgets.total', { column: columnName }), format, icon },
        cols: 4,
      })
    }

    if (Math.abs(avg) >= 0.01) {
      widgets.push({
        type: 'kpi',
        title: getTitle('dashboard.widgets.average', { column: columnName }),
        tableKey: analysis.tableKey,
        config: { value: avg, label: getTitle('dashboard.widgets.average', { column: columnName }), format, icon },
        cols: 4,
      })
    }
  })

  return widgets
}

/**
 * Generate time series line chart widget
 */
function generateLineChartWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (!analysis.hasTimeSeries || analysis.dateColumns.length === 0 || analysis.numericColumns.length === 0) {
    return null
  }

  const dateCol = analysis.dateColumns[0]
  const numericCol = analysis.numericColumns[0]
  const grouped = groupByDate(analysis.data, dateCol, numericCol)
  
  if (grouped.length <= 1) return null
  
  const allValues = grouped.map((g) => g.value)
  if (allValuesAreZero(allValues)) return null

  const numericColName = formatColumnName(numericCol)
  return {
    type: 'line',
    title: getTitle('dashboard.widgets.overTime', { column: numericColName }),
    tableKey: analysis.tableKey,
    config: {
      categories: grouped.map((g) => g.date),
      series: [{ name: numericColName, data: grouped.map((g) => roundToTwoDecimals(g.value)) }],
    },
    cols: 12,
  }
}

/**
 * Generate bar chart widget for categorical data
 */
function generateBarChartWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (!analysis.hasCategories || analysis.categoricalColumns.length === 0 || analysis.numericColumns.length === 0) {
    return null
  }

  const catCol = analysis.categoricalColumns[0]
  const numericCol = analysis.numericColumns[0]
  
  if (analysis.binaryColumns.includes(catCol)) return null

  const grouped = groupByCategory(analysis.data, catCol, numericCol)
  if (grouped.length <= 1 || grouped.length > 20) return null

  const allValues = grouped.map((g) => g.value)
  if (allValuesAreZero(allValues)) return null

  const numericColName = formatColumnName(numericCol)
  const catColName = formatColumnName(catCol)
  return {
    type: 'bar',
    title: getTitle('dashboard.widgets.by', { numericColumn: numericColName, categoryColumn: catColName }),
    tableKey: analysis.tableKey,
    config: {
      categories: grouped.map((g) => g.category),
      series: [{ name: numericColName, data: grouped.map((g) => roundToTwoDecimals(g.value)) }],
    },
    cols: 12,
  }
}

/**
 * Generate pie chart widget for categorical distribution
 */
function generatePieChartWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (!analysis.hasCategories || analysis.categoricalColumns.length === 0 || analysis.numericColumns.length === 0) {
    return null
  }

  const catCol = analysis.categoricalColumns[0]
  const numericCol = analysis.numericColumns[0]
  
  if (analysis.binaryColumns.includes(catCol)) return null

  const grouped = groupByCategory(analysis.data, catCol, numericCol)
  if (grouped.length < 2 || grouped.length > 10) return null

  const allValues = grouped.map((g) => g.value)
  if (allValuesAreZero(allValues)) return null

  const catColName = formatColumnName(catCol)
  return {
    type: 'pie',
    title: getTitle('dashboard.widgets.distributionBy', { column: catColName }),
    tableKey: analysis.tableKey,
    config: {
      labels: grouped.map((g) => g.category),
      series: grouped.map((g) => roundToTwoDecimals(g.value)),
    },
    cols: 6,
  }
}

/**
 * Generate area chart widget for cumulative data
 */
function generateAreaChartWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (!analysis.hasTimeSeries || analysis.dateColumns.length === 0 || analysis.numericColumns.length === 0) {
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
  const cumulativeTitle = getTitle('dashboard.widgets.cumulative', { column: numericColName })
  
  return {
    type: 'area',
    title: cumulativeTitle,
    tableKey: analysis.tableKey,
    config: {
      categories: grouped.map((g) => g.date),
      series: [{
        name: cumulativeTitle,
        data: grouped.map((g) => {
          cumulative += g.value
          return roundToTwoDecimals(cumulative)
        }),
      }],
    },
    cols: 12,
  }
}

/**
 * Collect valid coordinate data from analysis
 */
function collectCoordinateData(
  analysis: TableAnalysis,
  coordinateCols: { latCol: string; lonCol: string },
  valueCol: string,
  valueType: 'binary' | 'numeric',
): Array<{ lat: number; lon: number; value: number }> {
  const coordinateData: Array<{ lat: number; lon: number; value: number }> = []
  
  analysis.data.forEach((row) => {
    const lat = Number(row[coordinateCols.latCol])
    const lon = Number(row[coordinateCols.lonCol])
    const value = Number(row[valueCol]) || 0
    
    const isValidCoordinate =
      !isNaN(lat) && !isNaN(lon) && !isNaN(value) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    
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
 * Generate map widget for coordinate columns
 */
function generateMapWidget(
  analysis: TableAnalysis,
  getTitle: TitleGetter,
): DashboardWidget | null {
  if (analysis.locationColumns.length < 2) return null

  const allColumns = analysis.data.length > 0 ? Object.keys(analysis.data[0]) : []
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
    { latCol: coordinateCols.latCol, lonCol: coordinateCols.lonCol },
    valueCol,
    valueType,
  )
  
  const allValues = coordinateData.map((d) => d.value)
  if (allValuesAreZero(allValues) || coordinateData.length === 0) return null

  const valueColName = formatColumnName(valueCol)
  return {
    type: 'map',
    title: getTitle('dashboard.widgets.map', { valueColumn: valueColName }),
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

/**
 * Generate dashboard widgets from table analysis
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
 * Generate complete dashboard layout from execution data
 */
export function generateAutoDashboard(
  executionData: any,
  dashboardType: 'instance' | 'solution',
  tableKey?: string,
  locale: string = 'en',
  t?: (key: string, params?: Record<string, string>) => string,
  tableSchema?: any, // Optional schema for better analysis
): DashboardWidget[] {
  const widgets: DashboardWidget[] = []

  if (!executionData) return widgets

  // Get data source based on type
  const dataSource = executionData.data || {}

  // If tableKey is provided, only generate widgets for that table
  if (tableKey) {
    const tableData = dataSource[tableKey]
    if (!Array.isArray(tableData) || tableData.length === 0) return widgets

    // Extract schema from tableSchema if provided
    // Schema structure: tableSchema.get_list?.response_schema?.items
    const schema = tableSchema?.get_list?.response_schema?.items || tableSchema

    const analysis = analyzeTable(tableKey, tableData, schema)
    if (!analysis) return widgets

    // Generate widgets for this table
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

    // Generate widgets for this table
    const tableWidgets = generateDashboardWidgets(analysis, locale, t)
    widgets.push(...tableWidgets)
  })

  return widgets
}

// Helper functions

/**
 * Round a number to maximum 2 decimal places
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Get appropriate icon for a column based on its name
 */
function getIconForColumn(col: string): string {
  const colLower = col.toLowerCase()
  
  // Financial/revenue related
  if (colLower.includes('revenue') || colLower.includes('income') || colLower.includes('sales')) {
    return 'mdi-wallet'
  }
  if (colLower.includes('cost') || colLower.includes('expense') || colLower.includes('price')) {
    return 'mdi-currency-eur'
  }
  if (colLower.includes('profit') || colLower.includes('margin')) {
    return 'mdi-trending-up'
  }
  
  // Count/quantity related
  if (colLower.includes('count') || colLower.includes('quantity') || colLower.includes('total')) {
    return 'mdi-counter'
  }
  if (colLower.includes('amount') || colLower.includes('value')) {
    return 'mdi-cash-multiple'
  }
  
  // Time related
  if (colLower.includes('time') || colLower.includes('duration') || colLower.includes('period')) {
    return 'mdi-clock-outline'
  }
  
  // User/people related
  if (colLower.includes('user') || colLower.includes('customer') || colLower.includes('client')) {
    return 'mdi-account'
  }
  if (colLower.includes('employee') || colLower.includes('staff')) {
    return 'mdi-account-group'
  }
  
  // Performance related
  if (colLower.includes('performance') || colLower.includes('efficiency') || colLower.includes('rate')) {
    return 'mdi-speedometer'
  }
  if (colLower.includes('score') || colLower.includes('rating')) {
    return 'mdi-star'
  }
  
  // Exchange/transaction related
  if (colLower.includes('exchange') || colLower.includes('intercambio')) {
    return 'mdi-swap-horizontal'
  }
  if (colLower.includes('transaction') || colLower.includes('transfer')) {
    return 'mdi-swap-vertical'
  }
  
  // Default icon
  return 'mdi-chart-line'
}

/**
 * Get appropriate format for a column based on its name
 */
function getFormatForColumn(col: string): 'number' | 'currency' | 'percentage' {
  const colLower = col.toLowerCase()
  
  const currencyPatterns = [
    'revenue', 'income', 'sales', 'cost', 'expense',
    'price', 'amount', 'value', 'profit', 'margin',
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
      value: roundToTwoDecimals(grouped[date].reduce((a, b) => a + b, 0)),
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
      value: roundToTwoDecimals(grouped[category].reduce((a, b) => a + b, 0)),
    }))
    .sort((a, b) => b.value - a.value)
}

