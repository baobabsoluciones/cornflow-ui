import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
  createI18n: () => ({
    install: () => {},
    global: { t: (k: string) => k, locale: { value: 'en' } },
  }),
}))

const storeState = vi.hoisted(() => ({
  appConfig: { parameters: { fileProcessors: {} as Record<string, string> } },
  getSchemaConfig: { instanceSchema: { properties: {} } },
}))
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => storeState,
}))

const processorsCtrl = vi.hoisted(() => ({
  needsSpecialProcessing: vi.fn((_name: string) => true),
  processFileByPrefix: vi.fn(async (_f: any, _c: any, _e: any, _s: any) => null),
}))
vi.mock('@/app/composables/useFileProcessors', () => ({
  useFileProcessors: () => processorsCtrl,
}))

const buildExcelBuffer = vi.hoisted(() =>
  vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]) })),
)
vi.mock('@cornflow-ui/core/utils/data_io', () => ({ buildExcelBuffer }))
vi.mock('@cornflow-ui/core/utils/schemaUtils', () => ({
  getInstanceSchemaRootForTables: () => null,
}))

import { useFilePreProcessing } from '@cornflow-ui/core/composables/useFilePreProcessing'

const xlsx = (name = 'c_prop_alm_estanteria.xlsx') =>
  new File([new Uint8Array([1])], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

beforeEach(() => {
  vi.clearAllMocks()
  storeState.appConfig.parameters.fileProcessors = {}
  processorsCtrl.needsSpecialProcessing.mockReturnValue(true)
  processorsCtrl.processFileByPrefix.mockResolvedValue(null)
  buildExcelBuffer.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]) })
})

describe('useFilePreProcessing', () => {
  test('a deployment with no processors never reads the file', async () => {
    const { preProcessFile } = useFilePreProcessing()
    const file = xlsx()

    expect(await preProcessFile(file)).toBe(file)
    // Not even asked: the common case must not pay for the check.
    expect(processorsCtrl.needsSpecialProcessing).not.toHaveBeenCalled()
    expect(processorsCtrl.processFileByPrefix).not.toHaveBeenCalled()
  })

  test('preProcessFiles reports "nothing configured" as null', async () => {
    const { preProcessFiles } = useFilePreProcessing()
    expect(await preProcessFiles([xlsx()])).toBeNull()
  })

  test('returns the file untouched when no processor matches it', async () => {
    storeState.appConfig.parameters.fileProcessors = { t_x: 'processX' }
    processorsCtrl.needsSpecialProcessing.mockReturnValue(false)

    const { preProcessFile } = useFilePreProcessing()
    const file = xlsx('unrelated.xlsx')

    expect(await preProcessFile(file)).toBe(file)
    expect(processorsCtrl.processFileByPrefix).not.toHaveBeenCalled()
  })

  test('rebuilds the file from what the processor returned', async () => {
    storeState.appConfig.parameters.fileProcessors = {
      c_prop_alm_estanteria: 'processShelfAllocationFile',
    }
    const flattened = { c_prop_alm_estanteria: [{ canal: 'A', valor: 1 }] }
    processorsCtrl.processFileByPrefix.mockResolvedValue({ data: flattened })

    const { preProcessFile } = useFilePreProcessing()
    const result = await preProcessFile(xlsx())

    // What reaches the backend is the processed data, not the uploaded matrix. The
    // workbook is written against the instance schema root, falling back to the schema
    // itself when the table root cannot be resolved.
    expect(buildExcelBuffer).toHaveBeenCalledWith(
      flattened,
      storeState.getSchemaConfig.instanceSchema,
    )
    expect(result.name).toBe('c_prop_alm_estanteria.xlsx')
    expect(result).not.toBe(xlsx())
  })

  test('hands the schema config to the processor to decide with', async () => {
    storeState.appConfig.parameters.fileProcessors = { a: 'p' }
    processorsCtrl.processFileByPrefix.mockResolvedValue({ data: { a: [] } })

    const { preProcessFile } = useFilePreProcessing()
    await preProcessFile(xlsx('a.xlsx'))

    // A processed table is not necessarily declared in the instance schema; what to do
    // about that belongs to the deployment's processor, so it gets the whole config.
    expect(processorsCtrl.processFileByPrefix).toHaveBeenCalledWith(
      expect.any(File),
      expect.anything(),
      'xlsx',
      storeState.getSchemaConfig,
    )
  })

  test('keeps a csv a csv, serialising the processed rows', async () => {
    storeState.appConfig.parameters.fileProcessors = { t_rows: 'p' }
    processorsCtrl.processFileByPrefix.mockResolvedValue({
      data: { t_rows: [{ a: 1, b: 'x,y' }] },
    })

    const { preProcessFile } = useFilePreProcessing()
    const result = await preProcessFile(
      new File(['raw'], 't_rows.csv', { type: 'text/csv' }),
    )

    expect(result.name).toBe('t_rows.csv')
    expect(result.type).toBe('text/csv')
    // A value holding the separator must come back quoted.
    expect(await result.text()).toBe('a,b\n1,"x,y"')
    expect(buildExcelBuffer).not.toHaveBeenCalled()
  })

  test('re-serialises anything else to xlsx', async () => {
    storeState.appConfig.parameters.fileProcessors = { t_j: 'p' }
    processorsCtrl.processFileByPrefix.mockResolvedValue({ data: { t_j: [] } })

    const { preProcessFile } = useFilePreProcessing()
    const result = await preProcessFile(
      new File(['{}'], 't_j.json', { type: 'application/json' }),
    )

    expect(result.name).toBe('t_j.xlsx')
  })

  test('a processor that declines leaves the file alone', async () => {
    storeState.appConfig.parameters.fileProcessors = { a: 'p' }
    processorsCtrl.processFileByPrefix.mockResolvedValue(null)

    const { preProcessFile } = useFilePreProcessing()
    const file = xlsx('a.xlsx')

    expect(await preProcessFile(file)).toBe(file)
  })

  test('processes every file of a list, in order', async () => {
    storeState.appConfig.parameters.fileProcessors = { a: 'p' }
    processorsCtrl.processFileByPrefix.mockResolvedValue({ data: { a: [] } })

    const { preProcessFiles } = useFilePreProcessing()
    const result = await preProcessFiles([xlsx('a.xlsx'), xlsx('b.xlsx')])

    expect(result).toHaveLength(2)
    expect(result!.map((f) => f.name)).toEqual(['a.xlsx', 'b.xlsx'])
    expect(processorsCtrl.processFileByPrefix).toHaveBeenCalledTimes(2)
  })
})
