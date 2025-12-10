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

/**
 * Generate dashboard widgets from table analysis
 */
export function generateDashboardWidgets(
  analysis: TableAnalysis,
  locale: string = 'en',
  t?: (key: string, params?: Record<string, string>) => string,
): DashboardWidget[] {
  // Helper function to get translated title
  const getTitle = (
    key: string,
    params: Record<string, string> = {},
  ): string => {
    if (t) {
      return t(key, params)
    }
    // Fallback to English if no translation function provided
    const translations: Record<string, string> = {
      'dashboard.widgets.total': `Total ${params.column || ''}`,
      'dashboard.widgets.average': `Average ${params.column || ''}`,
      'dashboard.widgets.overTime': `${params.column || ''} Over Time`,
      'dashboard.widgets.by': `${params.numericColumn || ''} by ${params.categoryColumn || ''}`,
      'dashboard.widgets.distributionBy': `Distribution by ${params.column || ''}`,
      'dashboard.widgets.cumulative': `Cumulative ${params.column || ''}`,
      'dashboard.widgets.map': `${params.locationColumn || ''} Map`,
      'dashboard.widgets.mapBy': `${params.valueColumn || ''} by ${params.locationColumn || ''}`,
    }
    let title = translations[key] || key
    // Replace placeholders
    Object.keys(params).forEach((param) => {
      title = title.replace(`{${param}}`, params[param])
    })
    return title
  }
  const widgets: DashboardWidget[] = []

  // KPI widgets for numeric columns (if few unique values or aggregatable)
  if (analysis.numericColumns.length > 0 && analysis.rowCount > 0) {
    analysis.numericColumns.forEach((col) => {
      const values = analysis.data.map((row) => Number(row[col])).filter((v) => !isNaN(v))
      if (values.length > 0) {
        const sum = roundToTwoDecimals(values.reduce((a, b) => a + b, 0))
        const avg = roundToTwoDecimals(sum / values.length)
        const max = roundToTwoDecimals(Math.max(...values))
        const min = roundToTwoDecimals(Math.min(...values))

        // Skip if all values are zero
        if (allValuesAreZero(values)) {
          return
        }

        // Create KPI widgets for key metrics
        if (analysis.numericColumns.length <= 3) {
          const icon = getIconForColumn(col)
          const format = getFormatForColumn(col)
          
          const columnName = formatColumnName(col)
          
          // Only add total KPI if sum is not zero
          if (Math.abs(sum) >= 0.01) {
            widgets.push({
              type: 'kpi',
              title: getTitle('dashboard.widgets.total', { column: columnName }),
              tableKey: analysis.tableKey,
              config: {
                value: sum,
                label: getTitle('dashboard.widgets.total', { column: columnName }),
                format: format,
                icon: icon,
              },
              cols: 4,
            })
          }

          // Only add average KPI if avg is not zero
          if (Math.abs(avg) >= 0.01) {
            widgets.push({
              type: 'kpi',
              title: getTitle('dashboard.widgets.average', { column: columnName }),
              tableKey: analysis.tableKey,
              config: {
                value: avg,
                label: getTitle('dashboard.widgets.average', { column: columnName }),
                format: format,
                icon: icon,
              },
              cols: 4,
            })
          }
        }
      }
    })
  }

  // Time series chart
  if (analysis.hasTimeSeries && analysis.dateColumns.length > 0 && analysis.numericColumns.length > 0) {
    const dateCol = analysis.dateColumns[0]
    const numericCol = analysis.numericColumns[0]

    // Group by date if needed
    const grouped = groupByDate(analysis.data, dateCol, numericCol)
    if (grouped.length > 1) {
      // Check if all values are zero
      const allValues = grouped.map((g) => g.value)
      if (!allValuesAreZero(allValues)) {
        const numericColName = formatColumnName(numericCol)
        widgets.push({
          type: 'line',
          title: getTitle('dashboard.widgets.overTime', { column: numericColName }),
          tableKey: analysis.tableKey,
          config: {
            categories: grouped.map((g) => g.date),
            series: [
              {
                name: numericColName,
                data: grouped.map((g) => roundToTwoDecimals(g.value)),
              },
            ],
          },
          cols: 12,
        })
      }
    }
  }

  // Bar chart for categorical data
  // Skip if categorical column is binary (0 or 1 only)
  if (analysis.hasCategories && analysis.categoricalColumns.length > 0 && analysis.numericColumns.length > 0) {
    const catCol = analysis.categoricalColumns[0]
    const numericCol = analysis.numericColumns[0]

    // Skip if this categorical column is binary
    if (analysis.binaryColumns.includes(catCol)) {
      // Don't create bar chart for binary categorical columns
    } else {
      // Group by category
      const grouped = groupByCategory(analysis.data, catCol, numericCol)
      if (grouped.length > 1 && grouped.length <= 20) {
        // Check if all values are zero
        const allValues = grouped.map((g) => g.value)
        if (!allValuesAreZero(allValues)) {
          const numericColName = formatColumnName(numericCol)
          const catColName = formatColumnName(catCol)
          widgets.push({
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
          })
        }
      }
    }
  }

  // Pie chart for categorical distribution (if few categories)
  // Skip if categorical column is binary (0 or 1 only)
  if (
    analysis.hasCategories &&
    analysis.categoricalColumns.length > 0 &&
    analysis.numericColumns.length > 0
  ) {
    const catCol = analysis.categoricalColumns[0]
    const numericCol = analysis.numericColumns[0]

    // Skip if this categorical column is binary
    if (!analysis.binaryColumns.includes(catCol)) {
      const grouped = groupByCategory(analysis.data, catCol, numericCol)
      if (grouped.length >= 2 && grouped.length <= 10) {
        // Check if all values are zero
        const allValues = grouped.map((g) => g.value)
        if (!allValuesAreZero(allValues)) {
          const catColName = formatColumnName(catCol)
          widgets.push({
            type: 'pie',
            title: getTitle('dashboard.widgets.distributionBy', { column: catColName }),
            tableKey: analysis.tableKey,
            config: {
              labels: grouped.map((g) => g.category),
              series: grouped.map((g) => roundToTwoDecimals(g.value)),
            },
            cols: 6,
          })
        }
      }
    }
  }

  // Area chart for cumulative data
  if (analysis.hasTimeSeries && analysis.dateColumns.length > 0 && analysis.numericColumns.length > 0) {
    const dateCol = analysis.dateColumns[0]
    const numericCol = analysis.numericColumns[0]

    const grouped = groupByDate(analysis.data, dateCol, numericCol)
    if (grouped.length > 1) {
      // Check if all values are zero
      const allValues = grouped.map((g) => g.value)
      if (!allValuesAreZero(allValues)) {
        let cumulative = 0
        const numericColName = formatColumnName(numericCol)
        const cumulativeTitle = getTitle('dashboard.widgets.cumulative', {
          column: numericColName,
        })
        widgets.push({
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
        })
      }
    }
  }

  // Map widget for coordinate columns (lat/lon) with associated values
  if (analysis.locationColumns.length >= 2) {
    // Get all columns from the data
    const allColumns = analysis.data.length > 0 ? Object.keys(analysis.data[0]) : []
    // Find lat and lon columns
    const coordinateCols = findCoordinateColumns(allColumns, analysis.data)
    
    if (coordinateCols.latCol && coordinateCols.lonCol) {
      // Try to find a binary or numeric column to associate with coordinates
      let valueCol: string | null = null
      let valueType: 'binary' | 'numeric' = 'numeric'
      
      // Prefer binary columns first (like intercambio: 0 or 1)
      if (analysis.binaryColumns.length > 0) {
        valueCol = analysis.binaryColumns[0]
        valueType = 'binary'
      } else if (analysis.numericColumns.length > 0) {
        valueCol = analysis.numericColumns[0]
        valueType = 'numeric'
      }
      
      if (valueCol) {
        // Collect coordinate data with values
        const coordinateData: Array<{
          lat: number
          lon: number
          value: number
        }> = []
        
        analysis.data.forEach((row) => {
          const lat = Number(row[coordinateCols.latCol!])
          const lon = Number(row[coordinateCols.lonCol!])
          const value = Number(row[valueCol!]) || 0
          
          // Validate coordinates
          if (
            !isNaN(lat) &&
            !isNaN(lon) &&
            !isNaN(value) &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180
          ) {
            coordinateData.push({
              lat: roundToTwoDecimals(lat),
              lon: roundToTwoDecimals(lon),
              value: valueType === 'binary' ? value : roundToTwoDecimals(value),
            })
          }
        })
        
        // Check if all values are zero
        const allValues = coordinateData.map((d) => d.value)
        if (!allValuesAreZero(allValues) && coordinateData.length > 0) {
          const valueColName = formatColumnName(valueCol)
          
          widgets.push({
            type: 'map',
            title: getTitle('dashboard.widgets.map', {
              valueColumn: valueColName,
            }),
            tableKey: analysis.tableKey,
            config: {
              coordinates: coordinateData.map((d) => [d.lat, d.lon]),
              values: coordinateData.map((d) => d.value),
              valueType: valueType,
              valueColumn: valueColName,
            },
            cols: 12, // Maps take full width
          })
        }
      }
    }
  }

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
  
  // Currency related
  if (
    colLower.includes('revenue') ||
    colLower.includes('income') ||
    colLower.includes('sales') ||
    colLower.includes('cost') ||
    colLower.includes('expense') ||
    colLower.includes('price') ||
    colLower.includes('amount') ||
    colLower.includes('value') ||
    colLower.includes('profit') ||
    colLower.includes('margin')
  ) {
    return 'currency'
  }
  
  // Percentage related
  if (
    colLower.includes('percentage') ||
    colLower.includes('percent') ||
    colLower.includes('rate') ||
    colLower.includes('ratio')
  ) {
    return 'percentage'
  }
  
  // Default to number
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
    .sort()
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

