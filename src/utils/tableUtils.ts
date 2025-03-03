import i18n from '@/plugins/i18n'

/**
 * Gets the keys for a table from both schema and data
 */
export function getTableDataKeys(schemaConfig, collection: string, data: object): any[] {
  const schemaChecks = schemaConfig[collection]
  const allSchemaKeys = Object.keys(schemaChecks.properties)
  const dataKeys = Object.keys(data)

  return Array.from(new Set([...allSchemaKeys, ...dataKeys]))
}

/**
 * Checks if a table should be visible
 */
export function getTableVisible(schemaConfig, collection: string, table: string): boolean {
  const tableSchema = schemaConfig[collection].properties[table]
  const visible = tableSchema?.visible
  return visible === undefined ? true : visible
}

/**
 * Gets the display names for table data
 */
export function getTableDataNames(
  schemaConfig, 
  collection: string, 
  data: object, 
  lang = 'en'
): any[] {
  // Always use only keys from the data object
  const keys = Object.keys(data);
  
  return keys
    .map((el) => {
      const title = getTableDataName(schemaConfig, collection, el, lang)
      return {
        text: title ?? el,
        value: el,
        visible: getTableVisible(schemaConfig, collection, el)
      }
    })
    .filter(table => table.visible)
}

/**
 * Gets the display name for a table
 */
export function getTableDataName(schemaConfig, collection: string, key: string, lang = 'en'): string {
  const tableSchema = schemaConfig[collection]?.properties[key]
  if (!tableSchema) return key
  
  const title = tableSchema.title
  if (typeof title === 'string') {
    return title
  } else if (typeof title === 'object') {
    return title[lang] ?? title.en ?? key
  }
  return key
}

/**
 * Gets the JSON schema for a table
 */
export function getTableJsonSchema(schemaConfig, collection: string, table): any {
  return schemaConfig[collection]?.properties[table] || {
    type: 'array',
    items: {
      properties: {},
      required: []
    }
  }
}

/**
 * Gets a specific option from a table's schema
 */
export function getTableOption(schemaConfig, collection: string, table, option): any {
  return getTableJsonSchema(schemaConfig, collection, table)[option]
}

/**
 * Checks if a table should be shown
 */
export function showTable(schemaConfig, collection: string, table: string): boolean {
  const show = getTableOption(schemaConfig, collection, table, 'show')
  return show !== undefined ? show : true
}

/**
 * Gets the header for a table
 */
export function getTableHeader(schemaConfig, collection, table): any[] {
  const items = getTableJsonSchema(schemaConfig, collection, table).items
  const keys = Object.keys(items.properties)
  const required = items.required || []

  return Array.from(new Set([...required, ...keys]))
}

/**
 * Gets a property from a table's JSON schema
 */
export function getTableJsonSchemaProperty(schemaConfig, collection, table, property): any {
  return getTableJsonSchema(schemaConfig, collection, table).items.properties[property]
}

/**
 * Checks if a table property is sortable
 */
export function isTablePropertySortable(schemaConfig, collection, table, item): boolean {
  const propSortable = getTableJsonSchemaProperty(
    schemaConfig,
    collection,
    table,
    item,
  ).sortable
  if (propSortable === undefined) {
    const tableSortable = getTableJsonSchemaProperty(
      schemaConfig,
      collection,
      table,
      item,
    ).sortable
    return tableSortable !== undefined ? tableSortable : true
  }
  return propSortable
}

/**
 * Checks if a table property is filterable
 */
export function isTablePropertyFilterable(schemaConfig, collection, table, item): boolean {
  const propFilterable = getTableJsonSchemaProperty(
    schemaConfig,
    collection,
    table,
    item,
  ).filterable
  if (propFilterable === undefined) {
    const tableFilterable = getTableJsonSchemaProperty(
      schemaConfig,
      collection,
      table,
      item,
    ).filterable
    return tableFilterable !== undefined ? tableFilterable : false
  }
  return propFilterable
}

/**
 * Gets the title for a table property
 */
export function getTablePropertyTitle(schemaConfig, collection, table, item, lang = 'en'): string {
  const title = getTableJsonSchemaProperty(
    schemaConfig,
    collection,
    table,
    item,
  ).title
  if (typeof title === 'string') {
    return title
  } else if (typeof title === 'object') {
    return title[lang] || title.en || item
  }
  return item
}

/**
 * Checks if a table property should be visible
 */
export function getTablePropertyVisible(schemaConfig, collection, table, item): boolean {
  const visible = getTableJsonSchemaProperty(schemaConfig, collection, table, item).visible
  return visible === undefined ? true : visible
}

/**
 * Gets the headers for a table
 */
export function getTableHeaders(schemaConfig, collection, table): any[] {
  const items = getTableJsonSchema(schemaConfig, collection, table).items
  const keys = Object.keys(items.properties)
  let result = items.required?.slice()

  if (!result || result.length === 0) {
    result = keys
  } else {
    keys.forEach((el) => {
      if (!result.includes(el)) {
        result.push(el)
      }
    })
  }

  return result
}

/**
 * Gets headers from data
 */
export function getHeadersFromData(data): any[] {
  const keys = Object.keys(data)
  return keys.map(key => ({
    title: key,
    value: key,
    visible: true,
    sortable: true,
    filterable: false,
  }))
}

/**
 * Gets the headers data for a table
 */
export function getTableHeadersData(schemaConfig, collection, table, lang = 'en'): any[] {
  const headers = getTableHeaders(schemaConfig, collection, table)
  return headers
    .map((header) => ({
      title: getTablePropertyTitle(schemaConfig, collection, table, header, lang),
      value: header,
      visible: getTablePropertyVisible(schemaConfig, collection, table, header),
      sortable: isTablePropertySortable(schemaConfig, collection, table, header),
      filterable: isTablePropertyFilterable(schemaConfig, collection, table, header),
      type:
        getTableJsonSchemaProperty(schemaConfig, collection, table, header).type ===
        'integer'
          ? 'number'
          : getTableJsonSchemaProperty(schemaConfig, collection, table, header).type,
      required: getTableJsonSchema(
        schemaConfig,
        collection,
        table,
      ).items.required?.includes(header),
    }))
    .filter(header => header.visible)
}

/**
 * Gets the config table headers data
 */
export function getConfigTableHeadersData(): any[] {
  return [
    {
      title: i18n.global.t('inputOutputData.parameter'),
      value: 'displayName',
      sortable: true,
      disabled: true,
      config: true,
    },
    {
      title: i18n.global.t('inputOutputData.value'),
      value: 'value',
      sortable: true,
      config: true,
    },
  ]
}

/**
 * Gets the config table data
 */
export function getConfigTableData(schemaConfig, data: object, collection, table, lang = 'en'): any[] {
  return Object.keys(data).map((key) => ({
    displayName: getConfigDisplayName(schemaConfig, collection, table, key, lang),
    type: getConfigType(schemaConfig, collection, table, key),
    value: data[key],
    key: key,
  }))
}

/**
 * Gets the display name for a config
 */
export function getConfigDisplayName(schemaConfig, collection, table, key, lang = 'en'): string {
  const title = getTableJsonSchema(schemaConfig, collection, table).properties[key]
    .title
  if (typeof title === 'string') {
    return title
  } else if (typeof title === 'object') {
    return title[lang] || title.en || key
  }
  return key
}

/**
 * Gets the type for a config
 */
export function getConfigType(schemaConfig, collection, table, key): string {
  return getTableJsonSchema(schemaConfig, collection, table).properties[key].type ==
    'integer'
    ? 'number'
    : getTableJsonSchema(schemaConfig, collection, table).properties[key].type
} 