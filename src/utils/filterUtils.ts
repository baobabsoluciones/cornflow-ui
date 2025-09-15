import i18n from '@/plugins/i18n'
import { isTablePropertyFilterable, getTableHeaders, getTableJsonSchema, getTableJsonSchemaProperty, getTablePropertyTitle } from './tableUtils'

/**
 * Checks if an object is empty
 */
export function isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object
}

/**
 * Gets the filter type based on header type
 */
export function getFilterType(headerType): string {
  let filterType = ''
  let type = Array.isArray(headerType) ? headerType[0] : headerType
  switch (type) {
    case 'string':
    case 'boolean':
      filterType = 'checkbox'
      break
    case 'integer':
    case 'number':
      filterType = 'range'
      break
    case 'date':
      filterType = 'daterange'
      break
  }
  return filterType
}

/**
 * Gets column data from the selected execution
 */
export function getColumnData(selectedExecution, type, table_name, column) {
  // Get the data
  const { data } = selectedExecution.experiment[type]

  // Make sure data[table_name] exists
  if (!data[table_name] || !Array.isArray(data[table_name])) {
    return []
  }

  // Create a set to store unique values
  const uniqueValuesSet = new Set()

  // Loop through the array items and add unique values to the set
  data[table_name].forEach((item) => {
    if (item.hasOwnProperty(column)) {
      uniqueValuesSet.add(item[column])
    }
  })

  // Convert the set to an array and return it
  return Array.from(uniqueValuesSet)
}

/**
 * Checks if a filter is selected
 */
export function isFilterSelected(selectedExecution, type, table, header) {
  const filtersPreference = selectedExecution?.getFiltersPreference(type)
  const tableFilters = filtersPreference ? filtersPreference[table] : undefined
  const filter = tableFilters ? tableFilters[header] : undefined
  return filter !== undefined && !isEmptyObject(filter)
}

/**
 * Checks if a filter value is checked
 */
export function isFilterChecked(selectedExecution, type, table, header, value) {
  const filtersPreference = selectedExecution?.getFiltersPreference(type)
  const tableFilters = filtersPreference ? filtersPreference[table] : undefined
  const filter = tableFilters ? tableFilters[header] : undefined
  const stringValue = value ? value.toString() : 'false'
  return filter !== undefined && filter.value.includes(stringValue)
}

/**
 * Gets filter options for a column
 */
export function getFilterOptions(selectedExecution, collection, table, header) {
  const columnData = getColumnData(selectedExecution, collection, table, header)
  const uniqueValues = [...new Set(columnData)]

  return uniqueValues.map((value) => ({
    label: value,
    value: value,
    checked: isFilterChecked(selectedExecution, collection, table, header, value),
  }))
}

/**
 * Gets the minimum value for a filter
 */
export function getFilterMinValue(selectedExecution, collection, table, header) {
  const columnData = getColumnData(selectedExecution, collection, table, header)
  const numericData = columnData.filter(value => typeof value === 'number' && !isNaN(value)) as number[]
  return numericData.length > 0 ? Math.min(...numericData) : 0
}

/**
 * Gets the maximum value for a filter
 */
export function getFilterMaxValue(selectedExecution, collection, table, header) {
  const columnData = getColumnData(selectedExecution, collection, table, header)
  const numericData = columnData.filter(value => typeof value === 'number' && !isNaN(value)) as number[]
  return numericData.length > 0 ? Math.max(...numericData) : 0
}

/**
 * Gets the minimum date for a filter
 */
export function getFilterMinDate(selectedExecution, collection, table, header) {
  const columnData = getColumnData(selectedExecution, collection, table, header)
  return columnData.reduce(
    (minDate, date) => (date < minDate ? date : minDate),
    columnData[0],
  )
}

/**
 * Gets the maximum date for a filter
 */
export function getFilterMaxDate(selectedExecution, collection, table, header) {
  const columnData = getColumnData(selectedExecution, collection, table, header)
  return columnData.reduce(
    (maxDate, date) => (date > maxDate ? date : maxDate),
    columnData[0],
  )
}

/**
 * Gets the filter names for a table
 */
export function getFilterNames(schemaConfig, selectedExecution, collection, table, type, lang = 'en'): any {
  const filters = getTableHeaders(schemaConfig, collection, table)
  return filters.reduce((acc, header) => {
    const headerType = getTableJsonSchemaProperty(
      schemaConfig,
      collection,
      table,
      header,
    ).type

    acc[header] = {
      title: getTablePropertyTitle(schemaConfig, collection, table, header, lang),
      filterable: isTablePropertyFilterable(schemaConfig, collection, table, header),
      type: getFilterType(headerType),
      selected: isFilterSelected(selectedExecution, type, table, header),
      required: getTableJsonSchema(
        schemaConfig,
        collection,
        table,
      ).items.required?.includes(header),
    }
    if (acc[header].type == 'checkbox') {
      acc[header].options = getFilterOptions(selectedExecution, type, table, header)

      if (
        acc[header].options[0]?.label &&
        !isNaN(new Date(acc[header].options[0].label).getTime())
      ) {
        acc[header].min = getFilterMinDate(selectedExecution, type, table, header)
        acc[header].max = getFilterMaxDate(selectedExecution, type, table, header)
        acc[header].type = 'daterange'
      }

      if (headerType == 'boolean') {
        acc[header].type = 'checkbox'
        acc[header].options = [
          {
            label: i18n.global.t('inputOutputData.true'),
            value: 'true',
            checked: isFilterChecked(selectedExecution, type, table, header, 'true'),
          },
          {
            label: i18n.global.t('inputOutputData.false'),
            value: 'false',
            checked: isFilterChecked(selectedExecution, type, table, header, 'false'),
          },
        ]
      }
    } else if (acc[header].type == 'range') {
      acc[header].min = getFilterMinValue(selectedExecution, type, table, header)
      acc[header].max = getFilterMaxValue(selectedExecution, type, table, header)
    }
    return acc
  }, {})
}