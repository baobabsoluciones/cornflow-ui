import readXlsxFile, { readSheetNames } from 'read-excel-file'
import i18n from '@/plugins/i18n'
import { formatDateForExcel } from '@/utils/date'
import * as ExcelJS from 'exceljs'

const readTable = function (
  file,
  key,
  useFirstColumnAsKeys = false,
  req = null,
) {
  return readXlsxFile(file, { sheet: key })
    .then((rows) => {
      if (useFirstColumnAsKeys) {
        // If the first column should be used as the keys, create an object for each row
        // where the key is the value from the first column and the value is the value from the second column.
        return rows.map((row) => ({ [row[0].toString()]: row[1] }))
      } else {
        // Otherwise, treat the first row as the header row and use it to create the keys for the objects.
        const cols = rows.shift()
        // If cols is undefined (empty sheet), return empty array
        if (!cols) {
          return []
        }

        const formattedCols = cols.map((col) => {
          if (col instanceof Date) {
            return formatDateForExcel(col)
          }
          return col
        })
        return rows.map((row) =>
          Object.fromEntries(formattedCols.map((col, i) => [col, row[i]])),
        )
      }
    })
    .catch((error) => {
      const regex = new RegExp('Sheet ".+" not found')
      if (regex.test(error.message) && !req) {
        return []
      } else {
        throw error
      }
    })
}

const loadExcel = async function (file, schema) {
  // Get all sheets from Excel file
  const allSheets = await readXlsxFile(file, { getSheets: true })
  const sheetNames = allSheets.map((sheet) => sheet.name)
  const schemaTableNames = Object.keys(schema.properties)
  const required = schema.required || []

  const readTab = function (tab) {
    const isInSchema = schemaTableNames.includes(tab)
    const tabSchema = isInSchema ? schema.properties[tab] : null
    const isRequired = required.includes(tab)

    // For tables in schema, use schema settings
    const useFirstColumnAsKeys = isInSchema && tabSchema?.type === 'object'

    // Get field formats from schema for array type tables
    const getFieldFormat = function (fieldKey: string) {
      if (!isInSchema || !tabSchema) return undefined
      if (
        tabSchema.type === 'array' &&
        tabSchema.items?.properties?.[fieldKey]
      ) {
        return tabSchema.items.properties[fieldKey].format
      }
      return undefined
    }

    return readTable(file, tab, useFirstColumnAsKeys, isRequired)
      .then((table) => {
        if (Array.isArray(table)) {
          return [
            tab,
            table.map((row) => {
              return Object.fromEntries(
                Object.entries(row).map(([key, value]) => {
                  if (value instanceof Date) {
                    // Get format from schema for this field
                    const fieldFormat = getFieldFormat(key)
                    // Pass format to formatDateForExcel (second parameter)
                    return [key, formatDateForExcel(value, fieldFormat, true)]
                  } else if (Number.isNaN(value)) {
                    return [key, null]
                  } else if (typeof value === 'number' && value % 1 !== 0) {
                    return [key, parseFloat(value.toFixed(4))]
                  }
                  return [key, value]
                }),
              )
            }),
          ]
        }
        // Handle object type tables
        return [tab, table]
      })
      .catch((error) => {
        throw error
      })
  }

  // Process all sheets, including those not in schema
  const results = await Promise.all(sheetNames.map((tab) => readTab(tab)))
  return Object.fromEntries(results)
}

// this function writes all sheets according to the schema
async function schemaDataToTable(
  wb: any,
  data: Record<string, any>,
  schema: Record<string, any> | null = null,
) {
  var dataArray = Object.entries(data).map(([sheetName, sheetData]) => {
    if (!Array.isArray(sheetData)) {
      sheetData = [sheetData]
    }
    return [sheetName, sheetData]
  })

  for (let [sheetName, sheetData] of dataArray) {
    // Skip tables that are not visible
    if (schema && schema.properties?.[sheetName]?.visible === false) {
      continue
    }

    if (sheetData.length === 0) {
      if (schema?.properties?.[sheetName]?.items?.required) {
        const headers = schema.properties[sheetName].items.required
        sheetData = [
          headers.reduce((acc: Record<string, any>, header: string) => {
            acc[header] = null
            return acc
          }, {}),
        ]
      } else {
        continue
      }
    }

    const worksheet = wb.addWorksheet(sheetName)

    if (schema?.properties?.[sheetName]?.type === 'object') {
      // Filter out non-visible properties and 'id' columns for object type
      const tableData = Object.entries(
        sheetData[0] as Record<string, any>,
      ).filter(([key]) => {
        // Exclude 'id' columns
        if (key === 'id') {
          return false
        }
        const propertySchema =
          schema?.properties?.[sheetName]?.properties?.[key]
        return !schema || propertySchema?.visible !== false
      })

      worksheet.addRows(tableData)
      worksheet.getColumn(1).width = 20
      worksheet.getColumn(2).width = 30

      // Apply styles to the table
      tableData.forEach((row, index) => {
        ;['A', 'B'].forEach((col) => {
          const cell = worksheet.getCell(`${col}${index + 1}`)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: index % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2' },
          }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          }
        })
      })
    } else {
      // Filter out non-visible headers and 'id' columns for array type
      const allHeaders = Object.keys(sheetData[0])
      const headers = allHeaders.filter((header) => {
        // Exclude 'id' columns
        if (header === 'id') {
          return false
        }
        const propertySchema =
          schema?.properties?.[sheetName]?.items?.properties?.[header]
        return !schema || propertySchema?.visible !== false
      })

      const tableData = [
        headers,
        ...sheetData.map((row) => headers.map((header) => row[header])),
      ]
      worksheet.addRows(tableData)

      headers.forEach((header, index) => {
        worksheet.getColumn(index + 1).width = header.length + 5
      })

      // Apply styles without creating the table
      tableData.forEach((row, rowIndex) => {
        row.forEach((_, colIndex) => {
          const cell = worksheet.getCell(rowIndex + 1, colIndex + 1)
          if (rowIndex === 0) {
            // Style for header row
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD3D3D3' },
            }
            cell.font = { bold: true }
          } else {
            // Style for data rows
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2' },
            }
          }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          }
        })
      })
    }
  }
}

const toISOStringLocal = function (date, isEndDate = false) {
  if (date) {
    var timezoneOffsetMin = date.getTimezoneOffset(),
      offsetHours = Math.abs(timezoneOffsetMin / 60),
      offsetMinutes = timezoneOffsetMin % 60,
      offsetSign = timezoneOffsetMin > 0 ? '-' : '+'

    // If it's an end date, set the time to 23:59
    if (isEndDate) {
      date.setHours(23, 59, 0, 0)
    } else {
      // If it's a start date, set the time to 00:00
      date.setHours(0, 0, 0, 0)
    }

    return (
      new Date(date.getTime() - timezoneOffsetMin * 60 * 1000)
        .toISOString()
        .slice(0, -1) +
      offsetSign +
      String(offsetHours).padStart(2, '0') +
      ':' +
      String(offsetMinutes).padStart(2, '0')
    )
  }
}

const formatDateForHeaders = function (date, locale = i18n.global.locale) {
  const today = new Date()
  const itemDate = new Date(date)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }

  let formattedDate = new Intl.DateTimeFormat(locale.value, options).format(
    itemDate,
  )
  itemDate.toDateString() ===
    new Date(today.setDate(today.getDate() - 1)).toDateString()

  return formattedDate
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function getNumberFromLetter(letter) {
  let number = 0
  for (let i = 0; i < letter.length; i++) {
    number = number * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1)
  }
  return number
}

function getLetterFromNumber(number) {
  let result = ''
  while (number > 0) {
    const remainder = (number - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    number = Math.floor((number - 1) / 26)
  }
  return result
}

/**
 * Exports table data to Excel file with proper formatting based on backend schema
 * @param {Array} items - Array of data items to export (can be empty for structure-only export)
 * @param {Object} tableConfig - Table configuration with schema information
 * @param {string} tableName - Name of the table for the filename
 * @param {string} tableTitle - Display title for the worksheet
 * @param {Function} t - Translation function for i18n
 * @returns {Promise<void>}
 */
async function exportTableToExcel(
  items,
  tableConfig,
  tableName,
  tableTitle,
  t,
) {
  // Allow export even without data to show structure

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(tableTitle || tableName)

  // Get schema properties (backend field names and types)
  let schemaFields = []
  let backendKeys = []

  if (tableConfig?.get_list?.response_schema?.items?.properties) {
    const properties = tableConfig.get_list.response_schema.items.properties
    Object.entries(properties).forEach(([key, fieldSchema]: [string, any]) => {
      const isReadOnly = fieldSchema?.readOnly || false
      const isHidden = fieldSchema?.hidden || false
      const isForeignKey = fieldSchema?.isForeignKey || false
      const hasColumnsToJoin =
        fieldSchema?.columnsToJoin && Array.isArray(fieldSchema.columnsToJoin)

      // Exclude: id field, readOnly fields, hidden fields, foreign keys, and fields with columnsToJoin
      if (
        key !== 'id' &&
        !isReadOnly &&
        !isHidden &&
        !isForeignKey &&
        !hasColumnsToJoin
      ) {
        schemaFields.push({
          key: key,
          type: fieldSchema?.type || 'string',
          required:
            tableConfig.get_list?.response_schema?.items?.required?.includes(
              key,
            ) || false,
        })
        backendKeys.push(key) // Use actual backend field names as headers
      }
    })
  } else {
    // Fallback: if no schema, use data keys
    if (items && items.length > 0) {
      backendKeys = Object.keys(items[0]).filter((key) => key !== 'id')
      schemaFields = backendKeys.map((key) => ({
        key,
        type: 'string',
        required: false,
      }))
    }
  }

  // Add headers (backend field names) to worksheet
  if (backendKeys.length > 0) {
    worksheet.addRow(backendKeys)

    // Style header row with modern design
    const headerRow = worksheet.getRow(1)
    headerRow.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' }, // White text
      size: 11,
    }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4A90E2' }, // Modern blue
    }
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    }
    headerRow.height = 25

    // Add data rows (if any data exists)
    if (items && items.length > 0) {
      items.forEach((item, index) => {
        const rowData = schemaFields.map((field) => {
          const value = item[field.key]
          return formatValueByType(value, field.type)
        })
        const row = worksheet.addRow(rowData)

        // Subtle alternate row colors
        if (index % 2 === 1) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' }, // Very light gray
          }
        }
      })
    }

    // Set column types and formatting with better sizing
    schemaFields.forEach((field, index) => {
      const column = worksheet.getColumn(index + 1)
      // Better column width calculation
      const minWidth = Math.max(field.key.length + 4, 12)
      const maxWidth = 25
      column.width = Math.min(minWidth, maxWidth)

      // Set column number format based on type
      switch (field.type) {
        case 'integer':
          column.numFmt = '#,##0' // Number with thousands separator
          break
        case 'number':
          column.numFmt = '#,##0.00' // Number with decimals and separator
          break
        case 'boolean':
          column.numFmt = '@' // Text format for true/false
          break
        default:
          column.numFmt = '@' // Text format
      }
    })

    // Add clean borders only to data area
    const lastRow = items && items.length > 0 ? items.length + 1 : 1
    const lastColumn = backendKeys.length

    for (let row = 1; row <= lastRow; row++) {
      for (let col = 1; col <= lastColumn; col++) {
        const cell = worksheet.getCell(row, col)
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE1E5E9' } },
          left: { style: 'thin', color: { argb: 'FFE1E5E9' } },
          bottom: { style: 'thin', color: { argb: 'FFE1E5E9' } },
          right: { style: 'thin', color: { argb: 'FFE1E5E9' } },
        }

        // Center alignment for data cells (not header)
        if (row > 1) {
          cell.alignment = { vertical: 'middle' }
        }
      }
    }
  }

  // Generate and download the Excel file
  const excelBuffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  link.download = `${tableName}_${new Date().toISOString().split('T')[0]}.xlsx`
  link.click()

  // Clean up the URL object
  window.URL.revokeObjectURL(link.href)
}

/**
 * Format value according to its schema type for Excel export
 */
function formatValueByType(value, type) {
  if (value === null || value === undefined) {
    return ''
  }

  switch (type) {
    case 'boolean':
      return typeof value === 'boolean'
        ? value
        : value === 'true' || value === '1'
    case 'integer':
      return typeof value === 'number'
        ? Math.floor(value)
        : parseInt(value) || 0
    case 'number':
      return typeof value === 'number' ? value : parseFloat(value) || 0
    case 'string':
    default:
      return String(value)
  }
}

export {
  loadExcel,
  schemaDataToTable,
  exportTableToExcel,
  toISOStringLocal,
  formatDateForHeaders,
  formatDate,
  getLetterFromNumber,
  getNumberFromLetter,
}
