import readXlsxFile from 'read-excel-file'
import i18n from '@/plugins/i18n'
import { getTableVisible, getTablePropertyVisible } from '@/utils/tableUtils'

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
        return rows.map((row) =>
          Object.fromEntries(cols.map((col, i) => [col, row[i]])),
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
  const sheetNames = allSheets.map(sheet => sheet.name)
  const schemaTableNames = Object.keys(schema.properties)
  const required = schema.required || []
  
  const readTab = function (tab) {
    const isInSchema = schemaTableNames.includes(tab)
    const tabSchema = isInSchema ? schema.properties[tab] : null
    const isRequired = required.includes(tab)
    
    // For tables in schema, use schema settings
    const useFirstColumnAsKeys = isInSchema && tabSchema?.type === 'object'
    
    return readTable(file, tab, useFirstColumnAsKeys, isRequired)
      .then(table => {
        if (Array.isArray(table)) {
          return [tab, table.map(row => {
            return Object.fromEntries(
              Object.entries(row).map(([key, value]) => {
                if (value instanceof Date) {
                  const hours = value.getUTCHours()
                  const minutes = value.getUTCMinutes()
                  if (hours === 0 && minutes === 0) {
                    return [key, value.toISOString().split('T')[0]]
                  } else {
                    return [key, value.toISOString().slice(0, 16).replace('T', ' ')]
                  }
                } 
                else if (Number.isNaN(value)) {
                  return [key, null]
                }
                else if (typeof value === 'number' && value % 1 !== 0) {
                  return [key, parseFloat(value.toFixed(4))]
                }
                return [key, value]
              })
            )
          })]
        }
        // Handle object type tables
        return [tab, table]
      })
      .catch(error => {
          throw error
      })
  }

  // Process all sheets, including those not in schema
  const results = await Promise.all(sheetNames.map(tab => readTab(tab)))
  return Object.fromEntries(results)
}

// this function writes all sheets according to the schema
async function schemaDataToTable(wb: any, data: Record<string, any>, schema: Record<string, any> | null = null) {
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
      // Filter out non-visible properties for object type
      const tableData = Object.entries(sheetData[0] as Record<string, any>)
        .filter(([key]) => {
          const propertySchema = schema?.properties?.[sheetName]?.properties?.[key]
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
      // Filter out non-visible headers for array type
      const allHeaders = Object.keys(sheetData[0])
      const headers = allHeaders.filter(header => {
        const propertySchema = schema?.properties?.[sheetName]?.items?.properties?.[header]
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

export {
  loadExcel,
  schemaDataToTable,
  toISOStringLocal,
  formatDateForHeaders,
  formatDate,
  getLetterFromNumber,
  getNumberFromLetter,
}
