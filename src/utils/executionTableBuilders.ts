/**
 * Pure builders for object-type instance tables, extracted from
 * ExecutionDataView.vue. Component state (i18n `t`, instance schema, the
 * external ETL flow) is injected via a `deps` argument so these can be
 * unit-tested without mounting the component.
 */

import { generateHeadersFromData, generateSecureId } from '@cornflow-ui/core/utils/tableFilterUtils'
import {
  isAllowLoadFromDbDisabled,
  isParameterPropertySchemaVisible,
  filterParameterObjectByVisibleProperties,
  normalizeJsonSchemaPropertyTypeForUi,
} from '@cornflow-ui/core/utils/schemaUtils'
import { resolveTitle } from '@cornflow-ui/core/utils/i18nUtils'

/** Synthetic row id for single-row (horizontal) object tables. */
export const OBJECT_TABLE_ROW_ID = '__object__'

/** Title-cases a key and replaces underscores with spaces. */
export function formatTitle(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replaceAll('_', ' ')
}

export interface ParameterTableDeps {
  t: (key: string) => string
  instanceSchema: any
  etlFlow: any
}

export interface ObjectTableDeps {
  instanceSchema: any
}

/**
 * Builds a vertical parameter table for ETL review: columns "Parámetro",
 * "Valor", "Desde base de datos". One row per parameter so the switch is
 * clearly associated with each value.
 */
export function createParameterTableVertical(
  tableKey: string,
  objectData: Record<string, any>,
  rawSchema: any,
  deps: ParameterTableDeps,
) {
  const { t, etlFlow } = deps
  const objectSchema = rawSchema?.properties?.[tableKey]
  const propSchemas = objectSchema?.properties || {}
  const required = objectSchema?.required || []
  const instanceSchema = deps.instanceSchema
  const filteredObjectData = filterParameterObjectByVisibleProperties(
    objectData,
    tableKey,
    instanceSchema,
  )
  const schemaKeysOrdered = [
    ...required.filter((k) =>
      propSchemas[k] === undefined
        ? true
        : isParameterPropertySchemaVisible(propSchemas[k]),
    ),
    ...Object.keys(propSchemas).filter(
      (k) =>
        !required.includes(k) &&
        isParameterPropertySchemaVisible(propSchemas[k]),
    ),
  ]
  const dataKeys = new Set([
    ...schemaKeysOrdered,
    ...Object.keys(filteredObjectData).filter((k) => !k.startsWith('__')),
  ])
  const orderedKeys = [
    ...schemaKeysOrdered,
    ...Array.from(dataKeys).filter((k) => !schemaKeysOrdered.includes(k)),
  ]

  const switchState = etlFlow?.tableSwitches?.[tableKey]
  const isReuploaded = switchState?.variant === 'reuploaded'

  const selectionHeader = {
    title: '',
    value: 'selection',
    key: 'selection',
    sortable: false,
    filterable: false,
    type: 'selection',
    required: false,
    width: '48px',
  }

  const headers: any[] = [
    selectionHeader,
    {
      key: 'parameterTitle',
      title: t('inputOutputData.parameter'),
      sortable: true,
      filterable: true,
      type: 'string',
      frontendReadOnly: true,
    },
    {
      key: 'value',
      title: t('inputOutputData.value'),
      sortable: true,
      filterable: true,
      type: 'string',
      required: false,
    },
  ]

  if (isReuploaded) {
    headers.push(
      {
        key: '__etl_default__',
        title: t('externalEtl.switch.default'),
        type: 'boolean',
        renderAsSwitch: true,
        sortable: false,
        filterable: false,
      },
      {
        key: '__etl_from_db__',
        title: t('externalEtl.switch.fromDb'),
        type: 'boolean',
        renderAsSwitch: true,
        sortable: false,
        filterable: false,
        cellDisabledKey: '__etl_from_db_disabled__',
      },
      {
        key: '__etl_fixed__',
        title: t('externalEtl.switch.fixed'),
        type: 'boolean',
        renderAsSwitch: true,
        sortable: false,
        filterable: false,
      },
    )
  } else {
    headers.push({
      key: '__etl_from_db__',
      title: t('externalEtl.parameter.columnFromDb'),
      type: 'boolean',
      renderAsSwitch: true,
      sortable: false,
      filterable: false,
      cellDisabledKey: '__etl_from_db_disabled__',
    })
  }

  const items = orderedKeys.map((paramKey) => {
    const prop = propSchemas[paramKey]
    const title = prop?.title
      ? resolveTitle(prop.title, formatTitle(paramKey.replaceAll('_', ' ')))
      : formatTitle(paramKey.replaceAll('_', ' '))
    const paramSwitchKey = `${tableKey}.${paramKey}`
    const currentVal = etlFlow?.parameterSwitches?.[paramSwitchKey]
    const allowLoadFromDbDisabled = isAllowLoadFromDbDisabled(prop)
    const row: any = {
      id: paramKey,
      parameter: paramKey,
      parameterTitle: title,
      value: filteredObjectData[paramKey],
      __etl_from_db__: currentVal === false,
      __etl_from_db_disabled__: allowLoadFromDbDisabled,
    }
    if (isReuploaded) {
      row.__etl_default__ = currentVal === null
      row.__etl_from_db__ = currentVal === false
      row.__etl_fixed__ = currentVal === true
    }
    return row
  })

  const title = objectSchema?.title
    ? resolveTitle(objectSchema.title, tableKey)
    : formatTitle(tableKey.replaceAll('_', ' '))

  return {
    key: tableKey,
    title,
    headers,
    items,
    originalItems: items,
    isObjectTable: true,
    isParameterTableVertical: true,
  }
}

/** Builds a table view for object-type instance data (parameters, requirements, penalties, etc.). */
export function createObjectTableObject(
  tableKey: string,
  objectData: Record<string, any>,
  rawSchema: any,
  deps: ObjectTableDeps,
) {
  const objectSchema = rawSchema?.properties?.[tableKey]
  const instanceSchema = deps.instanceSchema
  const visibleObjectData = filterParameterObjectByVisibleProperties(
    objectData,
    tableKey,
    instanceSchema,
  )
  const selectionHeader = {
    title: '',
    value: 'selection',
    key: 'selection',
    sortable: false,
    filterable: false,
    type: 'selection',
    required: false,
    width: '48px',
  }

  let headers: any[]
  if (objectSchema?.properties && typeof objectSchema.properties === 'object') {
    headers = Object.entries(objectSchema.properties)
      .filter(([, prop]) => isParameterPropertySchemaVisible(prop))
      .map(([key, prop]: [string, any]) => ({
        title: prop?.title || key,
        value: key,
        key,
        sortable: true,
        filterable: true,
        type:
          prop?.type === 'integer'
            ? 'number'
            : prop?.type || 'string',
        required: (objectSchema.required || []).includes(key),
        frontendReadOnly: prop?.frontendReadOnly || false,
      }))
  } else {
    const dataHeaders = generateHeadersFromData([{ ...visibleObjectData }])
    headers = dataHeaders.filter(
      (h: any) => h.key !== 'id' && h.key !== 'selection',
    )
  }
  headers = [selectionHeader, ...headers]

  const title = objectSchema?.title || formatTitle(tableKey.replaceAll('_', ' '))
  const headerKeys = headers
    .filter((h) => h.key !== 'selection')
    .map((h) => h.key)
  const singleRow: Record<string, any> = { id: OBJECT_TABLE_ROW_ID }
  for (const k of headerKeys) {
    if (visibleObjectData[k] !== undefined) singleRow[k] = visibleObjectData[k]
  }
  const items = [singleRow]

  return {
    key: tableKey,
    title,
    headers,
    items,
    originalItems: items,
    isObjectTable: true,
  }
}

export interface ValidationTableDeps {
  /** The component's filter/search applier, keyed by `validation_<tableKey>`. */
  applyFilters: (items: any[], tableKey: string) => any[]
  /** The checks JSON schema (used to flag warning-only tables). */
  checksSchema: any
}

/** Builds the validation/checks tables from `execution.instance.dataChecks`. */
export function createValidationTables(execution: any, deps: ValidationTableDeps) {
  const { applyFilters, checksSchema } = deps
  const validationTables: any[] = []
  const instanceData = execution.instance.dataChecks || {}

  Object.keys(instanceData).forEach((tableKey) => {
    const tableData = instanceData[tableKey]
    // Only create table if it's an array with data
    if (Array.isArray(tableData) && tableData.length > 0) {
      // Check if array contains primitives (strings, numbers, etc.) or objects
      const isPrimitiveArray =
        typeof tableData[0] !== 'object' ||
        tableData[0] === null ||
        Array.isArray(tableData[0])

      let processedData: any[]
      let headers: any[]

      if (isPrimitiveArray) {
        // Convert primitives to objects with a 'value' field
        processedData = tableData.map((value: any, index: number) => ({
          id: generateSecureId(`validation_${tableKey}_${index}`),
          value: value,
        }))
        headers = [
          {
            title: 'ID',
            value: 'id',
            key: 'id',
            sortable: false,
            filterable: false,
            type: 'string',
            align: ' d-none',
          },
          {
            title: formatTitle(tableKey),
            value: 'value',
            key: 'value',
            sortable: true,
            filterable: true,
            type: typeof tableData[0],
          },
        ]
      } else {
        // Object array - ensure all items have an ID
        processedData = tableData.map((item: any, index: number) => ({
          id: item.id || generateSecureId(`validation_${tableKey}_${index}`),
          ...item,
        }))

        // Generate headers from data for validation tables
        const dataHeaders = generateHeadersFromData(processedData)
        headers = [
          {
            title: 'ID',
            value: 'id',
            key: 'id',
            sortable: false,
            filterable: false,
            type: 'string',
            align: ' d-none',
          },
          ...dataHeaders.filter((h: any) => h.key !== 'id' && h.key !== 'selection'),
        ]
      }

      // Apply filters
      let filteredItems = applyFilters(processedData, `validation_${tableKey}`)
      filteredItems = filteredItems.map((item: any) => ({
        id: item.id,
        ...item,
      }))

      const schemaEntry = checksSchema?.properties?.[tableKey]
      const isWarning = schemaEntry?.is_warning === true

      validationTables.push({
        key: `validation_${tableKey}`,
        title: `${formatTitle(tableKey)}`,
        headers: headers,
        items: filteredItems,
        originalItems: tableData,
        isValidationTable: true,
        isWarning,
      })
    }
  })

  return validationTables
}

export interface InjectSwitchDeps {
  t: (key: string) => string
  etlFlow: any
}

/**
 * Appends ETL parameter-switch columns to an already-built table object and
 * sets each row's switch flags from `etlFlow.parameterSwitches`. Mutates
 * `tableObject` in place. No-op when there is no external ETL flow.
 */
export function injectParameterSwitchColumns(
  tableObject: any,
  tableKey: string,
  deps: InjectSwitchDeps,
): void {
  const { t, etlFlow } = deps
  if (!etlFlow) return

  const switchState = etlFlow.tableSwitches[tableKey]
  const isReuploaded = switchState?.variant === 'reuploaded'

  if (isReuploaded) {
    tableObject.headers.push(
      {
        title: t('externalEtl.switch.default'),
        key: '__etl_default__',
        type: 'boolean',
        renderAsSwitch: true,
        sortable: false,
        filterable: false,
      },
      {
        title: t('externalEtl.switch.fromDb'),
        key: '__etl_from_db__',
        type: 'boolean',
        renderAsSwitch: true,
        sortable: false,
        filterable: false,
      },
      {
        title: t('externalEtl.switch.fixed'),
        key: '__etl_fixed__',
        type: 'boolean',
        renderAsSwitch: true,
        sortable: false,
        filterable: false,
      },
    )

    for (const item of tableObject.items) {
      const paramName = item.name ?? item.ID ?? item.key
      if (paramName == null) continue
      const paramKey = `${tableKey}.${paramName}`
      const val = etlFlow.parameterSwitches[paramKey] ?? null
      item.__etl_default__ = val === null
      item.__etl_from_db__ = val === false
      item.__etl_fixed__ = val === true
    }
  } else {
    tableObject.headers.push({
      title: t('externalEtl.parameter.columnFromDb'),
      key: '__etl_from_db__',
      type: 'boolean',
      renderAsSwitch: true,
      sortable: false,
      filterable: false,
    })

    for (const item of tableObject.items) {
      const paramName = item.name ?? item.ID ?? item.key
      if (paramName == null) continue
      const paramKey = `${tableKey}.${paramName}`
      const currentVal = etlFlow.parameterSwitches[paramKey]
      // Only show "From DB" ON when user chose replace (false); default OFF so replace-with-DB is off
      item.__etl_from_db__ = currentVal === false
    }
  }
}

export interface CreateTableObjectDeps {
  /** The component's filter/search applier, keyed by tableKey. */
  applyFilters: (items: any[], tableKey: string) => any[]
}

/**
 * Builds a standard array-backed table object. `effectiveConfig` is the master
 * table config when there is a match, otherwise the instance schema entry.
 * Mutates `tableData` to ensure every item has an id.
 */
export function createTableObject(
  tableKey: string,
  tableData: any[],
  schema: any,
  effectiveConfig: any,
  deps: CreateTableObjectDeps,
) {
  // Ensure all items have an ID (before generating headers)
  tableData.forEach((item: any, index: number) => {
    if (!item.id) {
      item.id = generateSecureId(`${tableKey}_${index}`)
    }
  })

  const tableConfig = effectiveConfig ?? schema?.[tableKey]
  let headers: any[]
  let title = tableKey

  if (tableConfig?.title) {
    title = tableConfig.title
  }

  const selectionHeader = {
    title: '',
    value: 'selection',
    key: 'selection',
    sortable: false,
    filterable: false,
    type: 'selection',
    required: false,
    width: '48px',
  }

  const responseSchema = tableConfig?.get_list?.response_schema
  if (responseSchema?.items?.properties) {
    const properties = responseSchema.items.properties
    const requiredFields = responseSchema.items.required || []

    // SAFETY CHECK: Verify that schema property keys actually exist in the data.
    // When a master table config is used (effectiveConfig), its column keys may differ
    // from the instance data keys (e.g., different casing or different column set),
    // which would cause empty cells since item[header.key] wouldn't find a match.
    const schemaKeys = Object.keys(properties).filter((k) => k !== 'id')
    const dataKeys =
      tableData.length > 0
        ? Object.keys(tableData[0]).filter((k) => k !== 'id' && k !== '_id')
        : []

    const keysMatchData =
      dataKeys.length === 0 || schemaKeys.some((sk) => dataKeys.includes(sk))

    if (keysMatchData) {
      // Schema keys match data keys - use schema headers with full metadata
      const schemaHeaders = Object.entries(properties)
        .filter(([key]) => key !== 'id')
        .filter(([, prop]) => isParameterPropertySchemaVisible(prop))
        .map(([key, prop]: [string, any]) => ({
          title: prop.title || key,
          value: key,
          key: key,
          sortable: true,
          filterable: true,
          type: normalizeJsonSchemaPropertyTypeForUi(prop),
          required: requiredFields.includes(key),
          minLength: prop.minLength,
          maxLength: prop.maxLength,
          min: prop.minimum,
          max: prop.maximum,
          pattern: prop.pattern,
          frontendReadOnly: prop.frontendReadOnly || false,
          isForeignKey: prop.isForeignKey || false,
          isDependentField: prop.isDependentField || false,
          isMainSelector: prop.isMainSelector || false,
          joinFrom: prop.joinFrom || undefined,
          columnsToJoin: prop.columnsToJoin || undefined,
          foreignKeyField: prop.foreignKeyField || undefined,
          hidden: prop.hidden || false,
          // Use explicit choices from config, or schema enum (e.g. 'refineria' | 'factoria') so dropdowns show options without lookup
          choices:
            prop.choices ??
            (Array.isArray(prop.enum) && prop.enum.length > 0
              ? prop.enum
              : undefined),
        }))

      headers = [selectionHeader, ...schemaHeaders]
    } else {
      // Schema keys DON'T match data keys (e.g., master table config has different
      // column names than the instance data). Fall back to data-derived headers
      // but enrich them with metadata from the master config via case-insensitive matching.
      console.warn(
        `ExecutionDataView: Schema property keys for "${tableKey}" don't match data keys (schema: [${schemaKeys.join(', ')}], data: [${dataKeys.join(', ')}]). Falling back to data-derived headers.`,
      )

      // Build a case-insensitive lookup from the config properties for enrichment
      const configPropsLookup = new Map<string, any>()
      Object.entries(properties).forEach(([key, prop]) => {
        configPropsLookup.set(key.toLowerCase(), prop as any)
      })

      const dataHeaders = generateHeadersFromData(tableData)
      const enrichedHeaders = dataHeaders
        .filter((h: any) => h.key !== 'id' && h.key !== 'selection')
        .map((h: any) => {
          const configProp = configPropsLookup.get(h.key.toLowerCase())
          if (configProp) {
            return {
              ...h,
              title: configProp.title || h.title,
              type:
                configProp.type === 'integer'
                  ? 'number'
                  : configProp.type || h.type,
              required: requiredFields.includes(h.key),
              frontendReadOnly: configProp.frontendReadOnly || false,
              isForeignKey: configProp.isForeignKey || false,
              isDependentField: configProp.isDependentField || false,
              isMainSelector: configProp.isMainSelector || false,
              joinFrom: configProp.joinFrom || undefined,
              columnsToJoin: configProp.columnsToJoin || undefined,
              foreignKeyField: configProp.foreignKeyField || undefined,
              hidden: configProp.hidden || false,
              choices:
                configProp.choices ??
                (Array.isArray(configProp.enum) && configProp.enum.length > 0
                  ? configProp.enum
                  : undefined),
            }
          }
          return h
        })
        .filter((h: any) => {
          const cp = configPropsLookup.get(String(h.key).toLowerCase())
          if (cp && !isParameterPropertySchemaVisible(cp)) return false
          return true
        })

      headers = [selectionHeader, ...enrichedHeaders]
    }
  } else {
    console.warn(
      `ExecutionDataView: No response schema items.properties for "${tableKey}", using fallback`,
    )
    const dataHeaders = generateHeadersFromData(tableData)
    headers = [
      selectionHeader,
      ...dataHeaders.filter(
        (h: any) => h.key !== 'id' && h.key !== 'selection',
      ),
    ]
  }

  // Apply filters and ensure IDs are preserved and accessible
  let filteredItems = deps.applyFilters(tableData, tableKey)

  // CRITICAL: Ensure ID is explicitly in each filtered item (not just in Proxy)
  filteredItems = filteredItems.map((item: any) => ({
    id: item.id, // Explicitly add ID first
    ...item, // Then spread the rest
  }))

  return {
    key: tableKey,
    title: title,
    headers: headers,
    items: filteredItems,
    originalItems: tableData,
  }
}
