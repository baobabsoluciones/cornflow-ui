import { describe, test, expect, vi, afterEach } from 'vitest'
import {
  cloneConfigValue,
  resolveSchemaParameters,
} from '@cornflow-ui/core/utils/schemaOverrides'

class Adapter {
  constructor(public name: string) {}
}

function appParameters() {
  return {
    valuesJsonPath: '/values.json',
    enableRecalculationOnMasterEdit: true,
    etl: { useEtlBackend: false, sendSchema: false, sendInstanceFilesAsZip: false },
    executionSolvers: ['solver_a', 'solver_b'],
    showExtraProjectExecutionColumns: { showSolver: true, showUserName: false },
    agent: { enabled: false, runtime: { adapter: new Adapter('list') } },
  }
}

describe('schemaOverrides', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('cloneConfigValue', () => {
    test('copies plain objects and arrays, and keeps functions and class instances', () => {
      const format = (value: string) => value.toUpperCase()
      const adapter = new Adapter('list')
      const value = { fields: [{ key: 'a' }], format, adapter }

      const copy = cloneConfigValue(value)

      expect(copy).toEqual(value)
      expect(copy).not.toBe(value)
      expect(copy.fields).not.toBe(value.fields)
      expect(copy.fields[0]).not.toBe(value.fields[0])
      expect(copy.format).toBe(format)
      expect(copy.adapter).toBe(adapter)
    })
  })

  describe('resolveSchemaParameters', () => {
    test('without an entry, the DAG gets a copy of the app settings', () => {
      const base = appParameters()

      const resolved = resolveSchemaParameters(base, 'planning_dag', undefined)

      expect(resolved).toEqual(base)
      expect(resolved.etl).not.toBe(base.etl)
    })

    test('merges plain objects key by key and replaces any other value', () => {
      const base = appParameters()

      const resolved = resolveSchemaParameters(base, 'stock_dag', {
        enableRecalculationOnMasterEdit: false,
        etl: { useEtlBackend: true },
        executionSolvers: ['solver_c'],
      })

      expect(resolved.enableRecalculationOnMasterEdit).toBe(false)
      expect(resolved.etl).toEqual({
        useEtlBackend: true,
        sendSchema: false,
        sendInstanceFilesAsZip: false,
      })
      expect(resolved.executionSolvers).toEqual(['solver_c'])
      expect(resolved.showExtraProjectExecutionColumns).toEqual(
        base.showExtraProjectExecutionColumns,
      )
    })

    test('keeps the class instances of the app settings it merges into', () => {
      const base = appParameters()

      const resolved = resolveSchemaParameters(base, 'stock_dag', {
        agent: { enabled: true },
      })

      expect(resolved.agent.enabled).toBe(true)
      expect(resolved.agent.runtime.adapter).toBe(base.agent.runtime.adapter)
    })

    test('leaves the app settings untouched', () => {
      const base = appParameters()

      resolveSchemaParameters(base, 'stock_dag', {
        etl: { useEtlBackend: true },
        executionSolvers: ['solver_c'],
      })

      expect(base).toEqual(appParameters())
    })

    test('ignores, with a warning, the settings of the whole application', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const resolved = resolveSchemaParameters(appParameters(), 'stock_dag', {
        valuesJsonPath: '/other.json',
      })

      expect(resolved.valuesJsonPath).toBe('/values.json')
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('schemaOverrides.stock_dag.parameters.valuesJsonPath'),
      )
    })

    test('ignores, with a warning, a key the app does not declare', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const resolved = resolveSchemaParameters(appParameters(), 'stock_dag', {
        enableRecalculation: false,
      })

      expect(resolved).not.toHaveProperty('enableRecalculation')
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('schemaOverrides.stock_dag.parameters.enableRecalculation'),
      )
    })
  })
})
