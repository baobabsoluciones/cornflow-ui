import readXlsxFile from 'read-excel-file'
import * as XLSX from 'xlsx'

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
        return rows.map((row) => ({ [row[0]]: row[1] }))
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
  const readTab = function (tab) {
    const tabType = schema.properties[tab].type
    const useFirstColumnAsKeys = tabType === 'object'
    return readTable(file, tab, useFirstColumnAsKeys).then((table) => {
      if (tabType === 'array') {
        return table
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
const schemaDataToTable = function (wb, schema, data) {
  const tabs = Object.keys(schema.properties)
  const _types = Object.values(schema.properties).map((k) => k.type)
  var tabsData = tabs
    .map((el, i) => (_types[i] === 'array' ? data[el] : [data[el]]))
    .map((el) => (el === undefined ? [] : el))
    .map(XLSX.utils.json_to_sheet)
  tabs.forEach((tab, i) => {
    XLSX.utils.book_append_sheet(wb, tabsData[i], tab)
  })
}

const schemasToREADME = function (
  wb,
  instanceSchema,
  solutionSchema,
  locale = 'en',
) {
  const schemaToDescriptions = function (schema) {
    const mainProps = schema.properties
    return Object.entries(mainProps).map(([key, value]) => ({
      table: key,
      description:
        (typeof value.description === 'object'
          ? value.description[locale]
          : value.description) || '',
    }))
  }
  let descriptions = schemaToDescriptions(instanceSchema)
  descriptions = descriptions.concat(schemaToDescriptions(solutionSchema))
  const readmeTable = XLSX.utils.json_to_sheet(descriptions)
  XLSX.utils.book_append_sheet(wb, readmeTable, '_README')

  const schemaToTypes = function (schema) {
    const mainProps = schema.properties
    const listPerTable = function (tab) {
      let tabProps
      if (mainProps[tab].type === 'array') {
        tabProps = mainProps[tab].items.properties
      } else if (mainProps[tab].type === 'object') {
        tabProps = mainProps[tab].properties
      }

      return Object.entries(tabProps).map(([key, value]) => ({
        table: tab,
        column: key,
        type: value.type,
      }))
    }
    return Object.keys(mainProps).map(listPerTable).flat()
  }
  let types = schemaToTypes(instanceSchema)
  types = types.concat(schemaToTypes(solutionSchema))
  const typesTable = XLSX.utils.json_to_sheet(types)
  XLSX.utils.book_append_sheet(wb, typesTable, '_TYPES')
}

const toISOStringLocal = function (date, isEndDate = false) {
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

export { loadExcel, schemaDataToTable, schemasToREADME, toISOStringLocal }
