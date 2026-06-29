import { describe, test, expect, vi, beforeEach } from 'vitest'

/**
 * Complements useInstanceProcessing.unwrapEtlResponse.spec.ts.
 *
 * Covers the exported `buildInstanceDataFromAlternativeFields` helper and the
 * `useInstanceProcessing` composable (processFiles, processInstanceData,
 * processFromDb, resetState + state/computeds). All heavy dependencies (store,
 * file processors, Instance model, excel/schema utils) are mocked so the tests
 * exercise the composable's own branching logic without real I/O.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockT = vi.fn((key: string) => key)
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT,
    locale: { value: 'en' },
  }),
}))

// useFileProcessors
const mockProcessFileByPrefix = vi.fn()
const mockNeedsSpecialProcessing = vi.fn()
vi.mock('@/app/composables/useFileProcessors', () => ({
  useFileProcessors: () => ({
    processFileByPrefix: mockProcessFileByPrefix,
    needsSpecialProcessing: mockNeedsSpecialProcessing,
  }),
}))

// Instance model — a light fake with a controllable checkSchema().
// `ctrl` is hoisted so the vi.mock factory (also hoisted) can reference it.
const ctrl = vi.hoisted(() => ({
  nextCheckSchemaResult: [] as any[],
  checkSchemaThrows: false,
}))

const FakeInstance = vi.hoisted(() => {
  class FakeInstance {
    data: any
    schema: any
    checksSchema: any
    schemaName: any
    constructor(
      _id: any,
      data: any,
      schema?: any,
      checksSchema?: any,
      name?: any,
    ) {
      this.data = data
      this.schema = schema
      this.checksSchema = checksSchema
      this.schemaName = name
    }
    async checkSchema() {
      // read controls lazily so per-test mutations are honoured
      const g = (globalThis as any).__instanceCtrl
      if (g.checkSchemaThrows) {
        throw new Error('boom-validate')
      }
      return g.nextCheckSchemaResult
    }
    static fromExcel = (..._a: any[]) => undefined
    static fromCsv = (..._a: any[]) => undefined
  }
  return FakeInstance
})
;(globalThis as any).__instanceCtrl = ctrl

vi.mock('@/app/models/Instance', () => ({
  Instance: FakeInstance,
}))

// data_io.buildExcelBuffer
const mockBuildExcelBuffer = vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]) }))
vi.mock('@cornflow-ui/core/utils/data_io', () => ({
  buildExcelBuffer: (...args: any[]) => mockBuildExcelBuffer(...args),
}))

// schemaUtils
const mockBuildAlternative = vi.fn(() => ({ built: true }))
vi.mock('@cornflow-ui/core/utils/schemaUtils', () => ({
  buildAlternativeParameterInstanceData: (...args: any[]) =>
    mockBuildAlternative(...args),
  convertParameterNameValueArraysToObjectsForInstance: vi.fn((data: any) => data),
  getInstanceSchemaRootForTables: vi.fn(() => null),
  patchInstanceSchemaRootForParameterTableEtlExport: vi.fn(() => null),
}))

// errorFormatting — keep simple, identifiable strings
vi.mock('@cornflow-ui/core/utils/errorFormatting', () => ({
  formatValidationErrorsWithTitle: (title: string) => `VALIDATION:${title}`,
  formatErrorDetails: (title: string, _details: any, message: string) =>
    `DETAILS:${title}:${message}`,
  ValidationError: class ValidationError {},
}))

// Pinia store
const mockUseEtlBackend = vi.fn()
const mockUseEtlBackendFromDb = vi.fn()
let storeState: any
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => storeState,
}))

// The composable now consumes the ETL backend via the premium-capability registry
// (getPremiumEtlBackend) instead of importing useEtlStore directly.
vi.mock('@cornflow-ui/core/plugins/extensions', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  getPremiumEtlBackend: () => ({
    useEtlBackend: mockUseEtlBackend,
    useEtlBackendFromDb: mockUseEtlBackendFromDb,
  }),
}))

import {
  useInstanceProcessing,
  buildInstanceDataFromAlternativeFields,
} from '@cornflow-ui/core/composables/useInstanceProcessing'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeStore(overrides: any = {}) {
  return {
    appConfig: {
      Instance: FakeInstance,
      parameters: {
        schema: 'demo',
        etl: {
          enableEtlMetadataAndReview: false,
          useEtlBackend: false,
          enableLoadFromDb: false,
        },
        fileProcessors: {},
        ...(overrides.parameters || {}),
      },
    },
    getSchemaConfig: {
      instanceSchema: { type: 'object' },
      instanceChecksSchema: {},
    },
    getSchemaName: 'demo',
    useEtlBackend: mockUseEtlBackend,
    useEtlBackendFromDb: mockUseEtlBackendFromDb,
  }
}

function makeFile(name: string, content = 'x') {
  return new File([content], name, { type: 'text/plain' })
}

beforeEach(() => {
  vi.clearAllMocks()
  ctrl.nextCheckSchemaResult = []
  ctrl.checkSchemaThrows = false
  mockBuildExcelBuffer.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]) })
  mockBuildAlternative.mockReturnValue({ built: true })
  storeState = makeStore()
})

// ─── buildInstanceDataFromAlternativeFields ─────────────────────────────────────

describe('buildInstanceDataFromAlternativeFields', () => {
  test('delegates to buildAlternativeParameterInstanceData with provided masterDataTables', () => {
    const fields: any = [{ table: 't', key: 'k' }]
    const values = { k: 1 }
    const ctx = { instanceSchema: { s: 1 }, masterDataTables: { md: 2 } }

    const out = buildInstanceDataFromAlternativeFields(fields, values, ctx)

    expect(out).toEqual({ built: true })
    expect(mockBuildAlternative).toHaveBeenCalledWith(
      fields,
      values,
      ctx.instanceSchema,
      ctx.masterDataTables,
    )
  })

  test('passes null when masterDataTables is omitted', () => {
    buildInstanceDataFromAlternativeFields([], {}, { instanceSchema: {} })
    expect(mockBuildAlternative).toHaveBeenCalledWith([], {}, {}, null)
  })
})

// ─── composable: initial state & computeds ───────────────────────────────────────

describe('useInstanceProcessing - state & computeds', () => {
  test('exposes supported extensions and initial idle state', () => {
    const { state, supportedExtensions, canProcessFiles } =
      useInstanceProcessing()

    expect(supportedExtensions.value).toEqual(['json', 'xlsx', 'csv'])
    expect(canProcessFiles.value).toBe(true)
    expect(state.value).toEqual({
      isProcessing: false,
      processedInstances: [],
      errors: null,
    })
  })

  test('resetState clears errors, instances and processing flag', async () => {
    const { state, resetState, processFiles } = useInstanceProcessing()
    // Provoke an error to populate state.errors
    await processFiles([])
    expect(state.value.errors).toBeTruthy()

    resetState()
    expect(state.value.errors).toBeNull()
    expect(state.value.processedInstances).toEqual([])
    expect(state.value.isProcessing).toBe(false)
  })
})

// ─── composable: processFiles (frontend path) ────────────────────────────────────

describe('useInstanceProcessing - processFiles (frontend)', () => {
  test('returns error when no files are selected', async () => {
    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([])

    expect(result.success).toBe(false)
    expect(result.instance).toBeNull()
    expect(result.errors).toContain('noFilesSelectedError')
  })

  test('processes a single JSON file successfully (standard path)', async () => {
    mockNeedsSpecialProcessing.mockReturnValue(false)
    const { processFiles } = useInstanceProcessing()

    const result = await processFiles([makeFile('a.json', '{"t":[]}')])

    expect(result.success).toBe(true)
    expect(result.instance).toBeInstanceOf(FakeInstance)
    expect((result.instance as any).data).toEqual({ t: [] })
  })

  test('uses special processing instance when needsSpecialProcessing is true', async () => {
    mockNeedsSpecialProcessing.mockReturnValue(true)
    const special = new FakeInstance(null, { special: true })
    mockProcessFileByPrefix.mockResolvedValue(special)

    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([makeFile('a.json', '{}')])

    expect(result.success).toBe(true)
    expect(result.instance).toBeInstanceOf(FakeInstance)
    expect((result.instance as any).data).toEqual({ special: true })
    expect(mockProcessFileByPrefix).toHaveBeenCalled()
  })

  test('merges multiple instances (arrays flattened, objects assigned)', async () => {
    mockNeedsSpecialProcessing.mockReturnValue(false)
    const { processFiles } = useInstanceProcessing()

    const f1 = makeFile('a.json', JSON.stringify({ rows: [1], obj: { a: 1 } }))
    const f2 = makeFile('b.json', JSON.stringify({ rows: [2], obj: { b: 2 } }))
    const result = await processFiles([f1, f2])

    expect(result.success).toBe(true)
    expect((result.instance as any).data.rows).toEqual([1, 2])
    expect((result.instance as any).data.obj).toEqual({ a: 1, b: 2 })
  })

  test('returns validation error when checkSchema reports problems', async () => {
    mockNeedsSpecialProcessing.mockReturnValue(false)
    ctrl.nextCheckSchemaResult = [{ instancePath: '/x', message: 'bad' }]

    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([makeFile('a.json', '{}')])

    expect(result.success).toBe(false)
    expect(result.errors).toContain('VALIDATION:')
    expect(result.rawErrors).toHaveLength(1)
  })

  test('returns formatted error for unsupported file extension', async () => {
    mockNeedsSpecialProcessing.mockReturnValue(false)
    const { processFiles } = useInstanceProcessing()

    const result = await processFiles([makeFile('a.txt', 'plain')])

    expect(result.success).toBe(false)
    expect(result.errors).toContain('DETAILS:a.txt')
  })

  test('returns error when validation throws', async () => {
    mockNeedsSpecialProcessing.mockReturnValue(false)
    ctrl.checkSchemaThrows = true

    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([makeFile('a.json', '{}')])

    expect(result.success).toBe(false)
    expect(result.errors).toContain('DETAILS:')
  })
})

// ─── composable: processFiles (ETL path) ─────────────────────────────────────────

describe('useInstanceProcessing - processFiles (ETL backend)', () => {
  function etlStore(extra: any = {}) {
    storeState = makeStore({
      parameters: {
        etl: {
          enableEtlMetadataAndReview: false,
          useEtlBackend: true,
          enableLoadFromDb: false,
        },
        fileProcessors: {},
        ...extra,
      },
    })
  }

  test('sends files to ETL backend and returns instance on success', async () => {
    etlStore()
    mockUseEtlBackend.mockResolvedValue({ data: { table_a: [{ id: 1 }] } })

    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([makeFile('a.xlsx')])

    expect(result.success).toBe(true)
    expect(mockUseEtlBackend).toHaveBeenCalled()
    expect((result.instance as any).data).toEqual({ table_a: [{ id: 1 }] })
  })

  test('strips __metadata__ and exposes rawData when review enabled', async () => {
    etlStore({
      etl: {
        enableEtlMetadataAndReview: true,
        useEtlBackend: false,
        enableLoadFromDb: false,
      },
      fileProcessors: {},
    })
    const raw = { __metadata__: { m: 1 }, table_a: [] }
    mockUseEtlBackend.mockResolvedValue(raw)

    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([makeFile('a.xlsx')])

    expect(result.success).toBe(true)
    expect((result.instance as any).data).not.toHaveProperty('__metadata__')
    expect(result.rawData).toEqual(raw)
  })

  test('strips __metadata__ without rawData when review disabled', async () => {
    etlStore()
    mockUseEtlBackend.mockResolvedValue({ __metadata__: { m: 1 }, table_a: [] })

    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([makeFile('a.xlsx')])

    expect(result.success).toBe(true)
    expect((result.instance as any).data).not.toHaveProperty('__metadata__')
    expect(result.rawData).toBeUndefined()
  })

  test('surfaces a warning from the ETL envelope', async () => {
    etlStore()
    mockUseEtlBackend.mockResolvedValue({
      data: { table_a: [] },
      warning: 'careful',
    })

    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([makeFile('a.xlsx')])

    expect(result.success).toBe(true)
    expect(result.warning).toBe('careful')
  })

  test('returns formatted error when ETL backend rejects', async () => {
    etlStore()
    mockUseEtlBackend.mockRejectedValue(new Error('backend-down'))

    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([makeFile('a.xlsx')])

    expect(result.success).toBe(false)
    expect(result.errors).toContain('backend-down')
  })

  test('pre-processes files when fileProcessors are configured', async () => {
    etlStore({
      etl: {
        enableEtlMetadataAndReview: false,
        useEtlBackend: true,
        enableLoadFromDb: false,
      },
      fileProcessors: { somePrefix: {} },
    })
    // needsSpecialProcessing false → preProcessSingleFileForEtl returns file as-is
    mockNeedsSpecialProcessing.mockReturnValue(false)
    mockUseEtlBackend.mockResolvedValue({ data: { table_a: [] } })

    const { processFiles } = useInstanceProcessing()
    const result = await processFiles([makeFile('a.xlsx')])

    expect(result.success).toBe(true)
    expect(mockNeedsSpecialProcessing).toHaveBeenCalled()
    expect(mockUseEtlBackend).toHaveBeenCalled()
  })
})

// ─── composable: processInstanceData ─────────────────────────────────────────────

describe('useInstanceProcessing - processInstanceData', () => {
  test('returns error for empty data object', async () => {
    const { processInstanceData } = useInstanceProcessing()
    const result = await processInstanceData({})

    expect(result.success).toBe(false)
    expect(result.errors).toContain('noParametersDataError')
  })

  test('returns error for null data', async () => {
    const { processInstanceData } = useInstanceProcessing()
    const result = await processInstanceData(null as any)

    expect(result.success).toBe(false)
    expect(result.errors).toContain('noParametersDataError')
  })

  test('builds an Instance directly when ETL is disabled (frontend path)', async () => {
    const { processInstanceData } = useInstanceProcessing()
    const result = await processInstanceData({ table_a: [{ id: 1 }] })

    expect(result.success).toBe(true)
    expect(result.instance).toBeInstanceOf(FakeInstance)
  })

  test('frontend path returns validation error when checkSchema fails', async () => {
    ctrl.nextCheckSchemaResult = [{ instancePath: '/y', message: 'nope' }]
    const { processInstanceData } = useInstanceProcessing()
    const result = await processInstanceData({ table_a: [{ id: 1 }] })

    expect(result.success).toBe(false)
    expect(result.errors).toContain('VALIDATION:')
  })

  test('ETL path: error when no visible sheets', async () => {
    storeState = makeStore({
      parameters: {
        etl: {
          enableEtlMetadataAndReview: false,
          useEtlBackend: true,
          enableLoadFromDb: false,
        },
        fileProcessors: {},
      },
    })
    // empty data passes the initial non-empty guard via a hidden-only object?
    // Use a key whose normalized value is an empty array with no required headers.
    const { processInstanceData } = useInstanceProcessing()
    const result = await processInstanceData({ emptyTable: [] })

    expect(result.success).toBe(false)
    expect(result.errors).toContain('noParametersSheetsError')
  })

  test('ETL path: builds xlsx and sends to backend on success', async () => {
    storeState = makeStore({
      parameters: {
        etl: {
          enableEtlMetadataAndReview: false,
          useEtlBackend: true,
          enableLoadFromDb: false,
        },
        fileProcessors: {},
      },
    })
    mockUseEtlBackend.mockResolvedValue({ data: { table_a: [{ id: 1 }] } })

    const { processInstanceData } = useInstanceProcessing()
    const result = await processInstanceData({ table_a: [{ id: 1 }] })

    expect(result.success).toBe(true)
    expect(mockBuildExcelBuffer).toHaveBeenCalled()
    expect(mockUseEtlBackend).toHaveBeenCalled()
  })

  test('ETL path: error when built xlsx file is empty', async () => {
    storeState = makeStore({
      parameters: {
        etl: {
          enableEtlMetadataAndReview: false,
          useEtlBackend: true,
          enableLoadFromDb: false,
        },
        fileProcessors: {},
      },
    })
    mockBuildExcelBuffer.mockResolvedValue({ bytes: new Uint8Array([]) })

    const { processInstanceData } = useInstanceProcessing()
    const result = await processInstanceData({ table_a: [{ id: 1 }] })

    expect(result.success).toBe(false)
    expect(result.errors).toContain('noParametersSheetsError')
  })
})

// ─── composable: processFromDb ───────────────────────────────────────────────────

describe('useInstanceProcessing - processFromDb', () => {
  test('loads instance from DB backend on success', async () => {
    mockUseEtlBackendFromDb.mockResolvedValue({ data: { table_a: [{ id: 1 }] } })

    const { processFromDb } = useInstanceProcessing()
    const result = await processFromDb()

    expect(result.success).toBe(true)
    expect(mockUseEtlBackendFromDb).toHaveBeenCalled()
    expect((result.instance as any).data).toEqual({ table_a: [{ id: 1 }] })
  })

  test('exposes rawData when review enabled and __metadata__ present', async () => {
    storeState = makeStore({
      parameters: {
        etl: {
          enableEtlMetadataAndReview: true,
          useEtlBackend: false,
          enableLoadFromDb: true,
        },
        fileProcessors: {},
      },
    })
    const raw = { __metadata__: { m: 1 }, table_a: [] }
    mockUseEtlBackendFromDb.mockResolvedValue(raw)

    const { processFromDb } = useInstanceProcessing()
    const result = await processFromDb()

    expect(result.success).toBe(true)
    expect((result.instance as any).data).not.toHaveProperty('__metadata__')
    expect(result.rawData).toEqual(raw)
  })

  test('returns formatted error when DB backend rejects', async () => {
    mockUseEtlBackendFromDb.mockRejectedValue(new Error('db-down'))

    const { processFromDb } = useInstanceProcessing()
    const result = await processFromDb()

    expect(result.success).toBe(false)
    expect(result.errors).toContain('db-down')
  })

  test('returns validation error when DB instance fails schema check', async () => {
    mockUseEtlBackendFromDb.mockResolvedValue({ data: { table_a: [] } })
    ctrl.nextCheckSchemaResult = [{ instancePath: '', message: 'invalid' }]

    const { processFromDb } = useInstanceProcessing()
    const result = await processFromDb()

    expect(result.success).toBe(false)
    expect(result.errors).toContain('VALIDATION:')
  })
})
