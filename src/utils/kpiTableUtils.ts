import type { TableSchema } from '@/config/views'
import { formatTitle } from '@/utils/schemaUtils'

/** When `rawKpis` reuses a table key already defined in resultsData, we keep the base table and add a KPI copy under this suffix so both groups appear in the drawer. */
export const KPI_DUPLICATE_TABLE_KEY_SUFFIX = '__kpi'

/** Group label for tables built from `solution.rawKpis` (separate from solution `data`). */
const KPI_GROUP_TITLES: Record<string, string> = {
  en: 'KPI tables',
  es: 'Tabla de KPIs',
  fr: 'Tableau de KPI',
}

function resolveKpiGroupTitle(locale: string): string {
  return KPI_GROUP_TITLES[locale] || KPI_GROUP_TITLES.en
}

/**
 * Generates TableSchema configs from raw KPI data by auto-detecting
 * columns from the first row of each table.
 */
export function generateKpiTableConfigs(
  rawKpis: Record<string, any>,
  groupTitle: string,
): TableSchema {
  if (!rawKpis || typeof rawKpis !== 'object') return {}

  const result: TableSchema = {}

  for (const [tableKey, tableData] of Object.entries(rawKpis)) {
    if (!Array.isArray(tableData) || tableData.length === 0) continue

    const firstRow = tableData[0]
    if (!firstRow || typeof firstRow !== 'object') continue

    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const [colKey, colVal] of Object.entries(firstRow)) {
      let colType = 'string'
      if (typeof colVal === 'number') colType = 'number'
      else if (typeof colVal === 'boolean') colType = 'boolean'

      properties[colKey] = {
        title: formatTitle(colKey),
        type: colType,
      }
      required.push(colKey)
    }

    result[tableKey] = {
      group: groupTitle,
      title: formatTitle(tableKey),
      icon: 'mdi-chart-box-outline',
      _isFromRawKpis: true,
      _rawKpisSourceKey: tableKey,
      _originalTitle: formatTitle(tableKey),
      _originalGroup: groupTitle,
      get_list: {
        url: '',
        http_method: 'GET',
        request_schema: null,
        response_schema: {
          type: 'array',
          items: {
            type: 'object',
            properties,
            required,
          },
        },
      },
    }
  }

  return result
}

/**
 * Applies the kpiTablesDisplayMode policy to a base resultsData config.
 *
 * - 'disabled': returns baseConfig unchanged.
 * - 'separate': returns baseConfig + KPI tables in a separate group (after solution tables in config order).
 */
export function applyKpiDisplayMode(
  baseConfig: TableSchema,
  rawKpis: Record<string, any> | null | undefined,
  mode: 'disabled' | 'separate',
  locale: string = 'en',
): TableSchema {
  if (mode === 'disabled' || !rawKpis || Object.keys(rawKpis).length === 0) {
    return baseConfig
  }

  const groupTitle = resolveKpiGroupTitle(locale)
  const kpiConfigs = generateKpiTableConfigs(rawKpis, groupTitle)

  // Never overwrite base resultsData entries: overlapping keys would move tables out of "Datos de
  // salida" into the KPI group. Keep schema tables and add a suffixed KPI-only copy instead.
  const merged: TableSchema = { ...baseConfig }
  for (const [key, cfg] of Object.entries(kpiConfigs)) {
    const tableCfg = cfg
    if (key in baseConfig) {
      const aliasKey = `${key}${KPI_DUPLICATE_TABLE_KEY_SUFFIX}`
      merged[aliasKey] = {
        ...tableCfg,
        _rawKpisSourceKey: key,
      }
    } else {
      merged[key] = tableCfg
    }
  }
  return merged
}
