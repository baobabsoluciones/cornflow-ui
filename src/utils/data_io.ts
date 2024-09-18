import readXlsxFile from 'read-excel-file'
import i18n from '@/plugins/i18n'

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

const loadExcel = function (file, schema) {
  const tables = Object.keys(schema.properties)
  const required = schema.required ? schema.required : tables
  const readTab = function (tab, isRequired) {
    const tabType = schema.properties[tab].type
    const useFirstColumnAsKeys = tabType === 'object'
    return readTable(file, tab, useFirstColumnAsKeys).then((table) => {
      if (tabType === 'array') {
        return table.map((row) => {
          return Object.fromEntries(
            Object.entries(row).map(([key, value]) => {
              // Convert dates to ISO strings
              if (value instanceof Date) {
                const hours = value.getUTCHours()
                const minutes = value.getUTCMinutes()
                if (hours === 0 && minutes === 0) {
                  return [key, value.toISOString().split('T')[0]] // 'YYYY-MM-DD'
                } else {
                  return [
                    key,
                    value.toISOString().slice(0, 16).replace('T', ' '),
                  ] // 'YYYY-MM-DD HH:mm'
                }
              } else if (Number.isNaN(value)) {
                // Convert NaN to null
                return [key, null]
              } else if (typeof value === 'number' && value % 1 !== 0) {
                // Round numbers to 4 decimal places
                return [key, parseFloat(value.toFixed(4))]
              } else {
                return [key, value]
              }
            }),
          )
        })
      }
      // for objects, merge all objects in the table array into a single object
      const obj = Object.assign({}, ...table)
      return obj
    })
  }
  const promises = []
  tables.forEach((el) => {
    promises.push(readTab(el, required.includes(el)))
  })
  return Promise.all(promises).then((values) => {
    return Object.fromEntries(tables.map((tab, i) => [tab, values[i]]))
  })
}

// this function writes all sheets according to the schema
async function schemaDataToTable(wb, data) {
  // Convert the data object to an array of key-value pairs
  var dataArray = Object.entries(data).map(
    ([sheetName, sheetData]: [string, Array<any>]) => {
      if (!Array.isArray(sheetData)) {
        sheetData = [sheetData] // If it's not an array, convert it to an array
      }
      return [sheetName, sheetData]
    },
  )

  // Iterate over each sheet in the data
  for (const [sheetName, sheetData] of dataArray) {
    if (sheetData.length === 0) {
      continue
    }
    // Add a worksheet with the sheet name to the workbook
    const worksheet = wb.addWorksheet(sheetName)
    const tableData = []
    // Get the headers from the first row of data
    const headers = Object.keys(sheetData[0])
    // Push the headers into the tableData array as the first row
    tableData.push(headers)
    // Iterate over each row of data
    if (Array.isArray(sheetData)) {
      sheetData.forEach((row) => {
        // Map each value in the row to the corresponding header
        const rowData = headers.map((header) => row[header])
        // Push the row of data into the tableData array
        tableData.push(rowData)
      })
    }
    // Remove the headers row from tableData
    var tableDataNoHeaders = tableData.slice(1)
    // Set the starting cell for the table
    var startCell = 'A1'
    // Add a table to the worksheet with specified options
    worksheet.addTable({
      name: sheetName,
      ref: startCell,
      headerRow: true,
      totalsRow: false,
      style: {
        theme: 'TableStyleMedium14',
        showRowStripes: true,
        showColumnStripes: false,
      },
      columns: headers.map((header) => ({ name: header })),
      rows: tableDataNoHeaders,
    })
    // Calculate the maximum header length
    let maxHeaderLength = 0
    // Iterate over each header to find the maximum length
    headers.forEach((header) => {
      const headerLength = header.length
      if (headerLength > maxHeaderLength) {
        maxHeaderLength = headerLength
      }
    })
    // Add extra width to the calculated column width
    const extraWidth = 1
    const columnWidth = maxHeaderLength + extraWidth
    // Get the table reference and split it into start and end cells
    const columns = worksheet.getTable(sheetName).table
    var refScplit = columns.tableRef.split(':')
    // Get the start and end cells' row and column numbers
    const startCellRange = worksheet.getCell(refScplit[0])
    const endCell = worksheet.getCell(refScplit[1])
    const startRow = startCellRange.row
    const startColumn = getNumberFromLetter(refScplit[0].replace(/[0-9]/g, ''))
    const endRow = endCell.row
    const endColumn = getNumberFromLetter(refScplit[1].replace(/[0-9]/g, ''))
    // Set the width of each column in the table
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startColumn; col <= endColumn; col++) {
        worksheet.getColumn(col).width = columnWidth
      }
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
  let result = 0
  const uppercaseLetter = letter.toUpperCase()
  for (let i = 0; i < uppercaseLetter.length; i++) {
    const charCode = uppercaseLetter.charCodeAt(i)
    const number = charCode - 64
    const positionValue = Math.pow(26, uppercaseLetter.length - i - 1)
    result += number * positionValue
  }
  return result
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
