/**
 * Values of the execution parameters (`configFields`) that come from the loaded instance.
 *
 * A field with a `source` reads its value from that instance table: `param` is the key of an
 * object table, or, with `lookupType: 'arrayByValue'`, the row whose `lookupParam` column equals
 * `param`, taking its `lookupValue` column.
 */
import type { ExecutionConfigField } from '@cornflow-ui/core/utils/schemaUtils'

type Field = ExecutionConfigField & Record<string, any>

export function hasValidDataSource(
  field: Field,
  instanceData: Record<string, any> | null | undefined,
): boolean {
  return Boolean(field.source && instanceData && instanceData[field.source])
}

function lookupArrayByValue(field: Field, rows: any[]): unknown {
  const found = rows.find(
    (item) => item && item[field.lookupParam as string] === field.param,
  )
  return found ? found[field.lookupValue as string] : undefined
}

/** The raw value the instance has for the field, or undefined when it has none. */
export function getValueFromSource(field: Field, sourceData: any): unknown {
  if (field.lookupType === 'arrayByValue') {
    return Array.isArray(sourceData)
      ? lookupArrayByValue(field, sourceData)
      : undefined
  }
  if (Array.isArray(sourceData)) return undefined
  return sourceData?.[field.param as string]
}

export function convertValueByType(value: unknown, type: string): unknown {
  if (type === 'float') return Number.parseFloat(value as string)
  if (type === 'number') return Number.parseInt(value as string)
  return value
}

/**
 * The value the instance gives the field, converted to its type, or undefined. A field with a
 * `source` that finds nothing is left to its default, and the solver then runs on its own
 * defaults; the console says so.
 */
export function sourceValueOf(
  field: Field,
  instanceData: Record<string, any> | null | undefined,
): unknown {
  if (!hasValidDataSource(field, instanceData)) {
    if (field.source && instanceData) warnUnresolved(field)
    return undefined
  }
  const value = getValueFromSource(field, instanceData![field.source as string])
  if (value === undefined) {
    warnUnresolved(field)
    return undefined
  }
  return convertValueByType(value, field.type)
}

function warnUnresolved(field: Field) {
  console.warn(
    `Config field "${field.key}" found no value for "${field.param}" in instance table "${field.source}".`,
  )
}

/**
 * Config with every field settled: the instance value for the fields with a `source`, else the
 * field's default. Used when the parameters are not shown (`autoLoadValues`).
 */
export function resolveAllConfigFieldValues(
  fields: Field[],
  config: Record<string, any>,
  instanceData: Record<string, any> | null | undefined,
): Record<string, any> {
  const next = { ...config }
  for (const field of fields) {
    const value = sourceValueOf(field, instanceData)
    if (value !== undefined) next[field.key] = value
    else if (field.default !== undefined) next[field.key] = field.default
  }
  return next
}

/**
 * Config with the fields that have a `source` set to what the instance says; the rest is kept.
 * Returns the keys that took a value, so the form can mark them as read from the file.
 */
export function applySourceConfigFieldValues(
  fields: Field[],
  config: Record<string, any>,
  instanceData: Record<string, any> | null | undefined,
): { config: Record<string, any>; fromData: string[] } {
  const next = { ...config }
  const fromData: string[] = []
  for (const field of fields) {
    if (!field.source) continue
    const value = sourceValueOf(field, instanceData)
    if (value === undefined) continue
    next[field.key] = value
    fromData.push(field.key)
  }
  return { config: next, fromData }
}

/** Defaults of the fields that have no value yet. */
export function seedConfigFieldDefaults(
  fields: Field[],
  config: Record<string, any>,
): Record<string, any> {
  const next = { ...config }
  for (const field of fields) {
    if (next[field.key] === undefined && field.default !== undefined) {
      next[field.key] = field.default
    }
  }
  return next
}

export function isEmptyConfigValue(field: Field, value: unknown): boolean {
  if (field.type === 'boolean') return typeof value !== 'boolean'
  if (Array.isArray(value)) return value.length === 0
  return value === null || value === undefined || value === ''
}
