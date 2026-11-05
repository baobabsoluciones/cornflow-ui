import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { parseSolutionFile } from '@cornflow-ui/core/composables/create-execution/solutionFile'

const { solution, MockSolution } = vi.hoisted(() => {
  const solution = { data: { plan: [] } }
  const MockSolution = vi.fn(function () {
    return solution
  }) as any
  MockSolution.fromExcel = vi.fn().mockResolvedValue(solution)
  MockSolution.fromCsv = vi.fn().mockResolvedValue(solution)
  return { solution, MockSolution }
})

vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => ({
    appConfig: { Solution: MockSolution },
    getSchemaConfig: { solutionSchema: 'solution', solutionChecksSchema: 'checks' },
    getSchemaName: 'dag',
  }),
}))

const t = (key: string) => key

function installFileReader(result: unknown = '{}') {
  const reader: any = {
    result,
    readAsText: vi.fn(),
    readAsArrayBuffer: vi.fn(),
  }
  vi.stubGlobal(
    'FileReader',
    vi.fn(function () {
      return reader
    }),
  )
  return reader
}

describe('parseSolutionFile', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  test('reads a JSON file as text into a Solution', async () => {
    const reader = installFileReader('{"plan": []}')
    const promise = parseSolutionFile(new File(['{}'], 'solution.json'), t)
    await reader.onload()
    await flushPromises()
    await expect(promise).resolves.toBe(solution)
    expect(reader.readAsText).toHaveBeenCalled()
    expect(MockSolution).toHaveBeenCalledWith(null, { plan: [] }, 'solution', 'checks', 'dag')
  })

  test('reads an Excel file as a buffer', async () => {
    const reader = installFileReader(new ArrayBuffer(8))
    const promise = parseSolutionFile(new File([''], 'solution.xlsx'), t)
    await reader.onload()
    await expect(promise).resolves.toBe(solution)
    expect(reader.readAsArrayBuffer).toHaveBeenCalled()
    expect(MockSolution.fromExcel).toHaveBeenCalled()
  })

  test('reads a CSV file', async () => {
    const reader = installFileReader('a,b')
    const promise = parseSolutionFile(new File([''], 'solution.csv'), t)
    await reader.onload()
    await expect(promise).resolves.toBe(solution)
    expect(MockSolution.fromCsv).toHaveBeenCalled()
  })

  test('rejects a format it does not read', async () => {
    const reader = installFileReader('x')
    const promise = parseSolutionFile(new File([''], 'solution.txt'), t)
    await reader.onload()
    await expect(promise).rejects.toThrow(
      'projectExecution.steps.step8.developerMode.unsupportedFileFormat',
    )
  })

  test('rejects when the file cannot be read', async () => {
    const reader = installFileReader()
    const promise = parseSolutionFile(new File([''], 'solution.json'), t)
    reader.onerror()
    await expect(promise).rejects.toThrow('projectExecution.steps.step8.developerMode.fileReadError')
  })
})
