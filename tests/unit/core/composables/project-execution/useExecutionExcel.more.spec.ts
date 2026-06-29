import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

/**
 * Covers useExecutionExcel: downloadExcel (no-data error, success, download
 * failure) and handleFileUpload (no file, duplicate-while-uploading guard,
 * validation failure, validation success → onInstanceUpdate, and thrown error).
 * The i18n, store, models and the injected showSnackbar are all mocked.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockT = vi.fn((key: string) => key)
const mockShowSnackbar = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: mockT, locale: { value: 'en' } }),
}))

// inject('showSnackbar') → our spy
vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    inject: vi.fn(() => mockShowSnackbar),
  }
})

const ctrl = vi.hoisted(() => ({
  downloadExcelThrows: false,
  nextValidationErrors: [] as any[],
  fromExcelThrows: false,
}))

const downloadExcelSpy = vi.fn()

const FakeExperiment = vi.hoisted(() => {
  return class FakeExperiment {
    instance: any
    solution: any
    constructor(instance: any, solution: any) {
      this.instance = instance
      this.solution = solution
    }
    async downloadExcel(...args: any[]) {
      const g = (globalThis as any).__excelCtrl
      ;(globalThis as any).__downloadExcelSpy(...args)
      if (g.downloadExcelThrows) throw new Error('download-boom')
    }
  }
})
;(globalThis as any).__excelCtrl = ctrl
;(globalThis as any).__downloadExcelSpy = downloadExcelSpy

vi.mock('@/app/models/Experiment', () => ({ Experiment: FakeExperiment }))

const FakeSolution = vi.hoisted(
  () =>
    class FakeSolution {
      constructor(..._args: any[]) {}
    },
)
vi.mock('@/app/models/Solution', () => ({ Solution: FakeSolution }))

const FakeInstance = vi.hoisted(
  () =>
    class FakeInstance {
      data: any
      constructor(data?: any) {
        this.data = data
      }
      async checkSchema() {
        return (globalThis as any).__excelCtrl.nextValidationErrors
      }
      static async fromExcel(..._args: any[]) {
        if ((globalThis as any).__excelCtrl.fromExcelThrows) {
          throw new Error('parse-boom')
        }
        return new FakeInstance({ table_a: [] })
      }
    },
)
vi.mock('@/app/models/Instance', () => ({ Instance: FakeInstance }))

vi.mock('@/utils/errorFormatting', () => ({
  formatErrorDetails: (title: string, _d: any, message: string) =>
    `DETAILS:${title}:${message}`,
}))

const storeState = {
  getSchemaConfig: {
    solutionSchema: {},
    solutionChecksSchema: {},
    instanceSchema: {},
  },
  getSchemaName: 'demo',
  appConfig: { Instance: FakeInstance },
}
vi.mock('@/stores/general', () => ({
  useGeneralStore: () => storeState,
}))

import { useExecutionExcel } from '@/composables/project-execution/useExecutionExcel'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeFileEvent(file: File | null) {
  const input = { files: file ? [file] : [], value: 'preset' } as any
  return { target: input } as unknown as Event
}

beforeEach(() => {
  vi.clearAllMocks()
  ctrl.downloadExcelThrows = false
  ctrl.nextValidationErrors = []
  ctrl.fromExcelThrows = false
})

// ─── downloadExcel ───────────────────────────────────────────────────────────

describe('useExecutionExcel.downloadExcel', () => {
  test('shows an error and bails when there is no instance data', async () => {
    const execution = ref<any>({ name: 'x', instance: null })
    const { downloadExcel } = useExecutionExcel(execution)

    await downloadExcel()

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'projectExecution.downloadExcelMessages.noDataError',
      'error',
    )
    expect(downloadExcelSpy).not.toHaveBeenCalled()
  })

  test('builds an Experiment and downloads on success', async () => {
    const execution = ref<any>({
      name: 'my.exec.name',
      instance: { data: { table_a: [] } },
    })
    const { downloadExcel } = useExecutionExcel(execution)

    await downloadExcel()

    // filename has dots replaced by dashes, saveSolution=false
    expect(downloadExcelSpy).toHaveBeenCalledWith('my-exec-name', true, false)
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'projectExecution.downloadExcelMessages.success',
      'success',
    )
  })

  test('falls back to "execution" filename when name is empty', async () => {
    const execution = ref<any>({
      name: '',
      instance: { data: { table_a: [] } },
    })
    const { downloadExcel } = useExecutionExcel(execution)

    await downloadExcel()

    expect(downloadExcelSpy).toHaveBeenCalledWith('execution', true, false)
  })

  test('surfaces an error snackbar when downloadExcel throws', async () => {
    ctrl.downloadExcelThrows = true
    const execution = ref<any>({
      name: 'x',
      instance: { data: { table_a: [] } },
    })
    const { downloadExcel } = useExecutionExcel(execution)

    await downloadExcel()

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'projectExecution.downloadExcelMessages.error',
      'error',
    )
  })
})

// ─── handleFileUpload ──────────────────────────────────────────────────────────

describe('useExecutionExcel.handleFileUpload', () => {
  test('does nothing when no file is selected', async () => {
    const execution = ref<any>({})
    const { handleFileUpload, isUploading } = useExecutionExcel(execution)

    await handleFileUpload(makeFileEvent(null))

    expect(isUploading.value).toBe(false)
    expect(mockShowSnackbar).not.toHaveBeenCalled()
  })

  test('skips processing when an upload is already in progress', async () => {
    const execution = ref<any>({})
    const onUpdate = vi.fn()
    const { handleFileUpload } = useExecutionExcel(execution, onUpdate)

    // First call leaves isUploading true while fromExcel resolves; trigger the
    // guard by re-entering with a second event before the first resolves.
    const file = new File(['x'], 'a.xlsx')
    const event = makeFileEvent(file)
    const p1 = handleFileUpload(event)
    const p2 = handleFileUpload(makeFileEvent(file))
    await Promise.all([p1, p2])

    // onInstanceUpdate should only have fired once (the second was guarded)
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  test('reports a validation failure without calling onInstanceUpdate', async () => {
    ctrl.nextValidationErrors = [{ message: 'bad' }]
    const execution = ref<any>({})
    const onUpdate = vi.fn()
    const { handleFileUpload, isUploading } = useExecutionExcel(
      execution,
      onUpdate,
    )

    await handleFileUpload(makeFileEvent(new File(['x'], 'a.xlsx')))

    expect(onUpdate).not.toHaveBeenCalled()
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'projectExecution.uploadExcelMessages.validationFailed',
      'error',
    )
    expect(isUploading.value).toBe(false)
  })

  test('calls onInstanceUpdate and shows success when validation passes', async () => {
    const execution = ref<any>({})
    const onUpdate = vi.fn()
    const { handleFileUpload, isUploading } = useExecutionExcel(
      execution,
      onUpdate,
    )

    await handleFileUpload(makeFileEvent(new File(['x'], 'a.xlsx')))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'projectExecution.uploadExcelMessages.success',
      'success',
    )
    expect(isUploading.value).toBe(false)
  })

  test('succeeds even without an onInstanceUpdate callback', async () => {
    const execution = ref<any>({})
    const { handleFileUpload } = useExecutionExcel(execution)

    await handleFileUpload(makeFileEvent(new File(['x'], 'a.xlsx')))

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'projectExecution.uploadExcelMessages.success',
      'success',
    )
  })

  test('shows an error snackbar and resets the flag when parsing throws', async () => {
    ctrl.fromExcelThrows = true
    const execution = ref<any>({})
    const { handleFileUpload, isUploading } = useExecutionExcel(execution)

    await handleFileUpload(makeFileEvent(new File(['x'], 'a.xlsx')))

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('projectExecution.uploadExcelMessages.error'),
      'error',
    )
    expect(isUploading.value).toBe(false)
  })
})
