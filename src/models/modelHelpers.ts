/**
 * Shared helpers for core model classes (InstanceCore, SolutionCore).
 */

import { loadExcel } from '../utils/data_io'
import { parseCsvToData } from '../utils/csvUtils'

/**
 * Returns true when `data` is a non-empty object (defined, non-null, with own keys).
 * Used by InstanceCore.hasInstance() and SolutionCore.hasSolution().
 */
export function hasData(data: unknown): boolean {
  return (
    data !== undefined &&
    data !== null &&
    Object.keys(data as object).length > 0
  )
}

/**
 * Constructor signature shared by InstanceCore / SolutionCore (and their subclasses).
 * Accepts `(id, data, schema, schemaChecks, schemaName)` plus any extra trailing args.
 */
type ModelCtor<T> = new (
  id: string | null,
  data: any,
  schema: object,
  schemaChecks: object,
  schemaName: string,
  ...rest: any[]
) => T

/**
 * Builds a model instance from an Excel file. `ctor` is the concrete (possibly subclass)
 * constructor — pass `this` from the static factory to preserve subclass construction.
 * Used by InstanceCore.fromExcel() and SolutionCore.fromExcel().
 */
export function buildModelFromExcel<T>(
  ctor: ModelCtor<T>,
  file: any,
  schema: { properties: Record<string, any>; required?: string[] },
  schemaName: string,
): Promise<T> {
  return loadExcel(file, schema).then(
    (data) => new ctor(null, data, schema, {}, schemaName),
  )
}

/**
 * Builds a model instance from CSV text. `ctor` is the concrete (possibly subclass)
 * constructor — pass `this` from the static factory to preserve subclass construction.
 * Used by InstanceCore.fromCsv() and SolutionCore.fromCsv().
 */
export function buildModelFromCsv<T>(
  ctor: ModelCtor<T>,
  csvText: string,
  fileName: string,
  schema: object,
  schemaChecks: object,
  schemaName: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      const { data } = parseCsvToData(csvText, fileName)
      resolve(new ctor(null, data, schema, schemaChecks, schemaName))
    } catch (error) {
      reject(error)
    }
  })
}
