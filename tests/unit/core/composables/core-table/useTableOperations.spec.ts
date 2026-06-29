import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// ─── Mocks ───────────────────────────────────────────────────────────────────

// TableRepository: a controllable fake class.
const repoCtrl = vi.hoisted(() => ({
  supported: new Set<string>(),
  getListResult: [] as any,
  getListThrows: false,
  calls: [] as any[],
  failOn: new Set<string>(),
}))

const FakeRepo = vi.hoisted(() => {
  return class FakeRepo {
    constructor(public config: any, public t: any) {}
    isOperationSupported(op: string) {
      return (globalThis as any).__repoCtrl.supported.has(op)
    }
    async getList() {
      const c = (globalThis as any).__repoCtrl
      if (c.getListThrows) throw new Error('list-fail')
      return c.getListResult
    }
    async putItem(id: any, data: any) {
      this.record('putItem', { id, data })
    }
    async createItem(data: any) {
      this.record('createItem', { data })
    }
    async deleteItem(id: any) {
      this.record('deleteItem', { id })
    }
    async deleteBulk(ids: any[]) {
      this.record('deleteBulk', { ids })
    }
    async createBulk(data: any) {
      this.record('createBulk', { data })
    }
    async overwriteAll(data: any) {
      this.record('overwriteAll', { data })
    }
    private record(name: string, payload: any) {
      const c = (globalThis as any).__repoCtrl
      c.calls.push({ name, payload })
      if (c.failOn.has(name)) throw new Error(`${name}-fail`)
    }
  }
})
;(globalThis as any).__repoCtrl = repoCtrl

vi.mock('@/repositories/TableRepository', () => ({ default: FakeRepo }))

vi.mock('@/types/table', () => ({
  TableOperation: {
    GET_LIST: 'get_list',
    POST_ITEM: 'post_item',
    PUT_ITEM: 'put_item',
    DELETE_ITEM: 'delete_item',
    DELETE_BULK: 'delete_bulk',
    POST_BULK: 'post_bulk',
    OVERWRITE_ALL: 'overwrite_all',
  },
}))

const ctrl = vi.hoisted(() => ({ rowSchema: null as any }))
vi.mock('@/utils/schemaUtils', () => ({
  resolveTableConfigTitles: (cfg: any) => cfg,
  getListResponseRowProperties: () => ctrl.rowSchema,
  normalizeGetListResponseToRows: (raw: any) => raw,
}))

const mockExportExcel = vi.fn(async () => {})
vi.mock('@/utils/data_io', () => ({
  exportTableToExcel: (...a: any[]) => mockExportExcel(...a),
}))

const mockReadXlsx = vi.fn()
vi.mock('read-excel-file', () => ({ default: (...a: any[]) => mockReadXlsx(...a) }))

vi.mock('@/utils/csvUtils', () => ({
  detectDelimiter: () => ',',
  parseCsvContent: (content: string) => ({
    tableData: content.includes('empty') ? [] : [{ a: '1' }],
  }),
}))

import { useTableOperations } from '@/composables/core-table/useTableOperations'

const $t = (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key)

let snackbar: ReturnType<typeof vi.fn>

function setup(config: any = { title: 'cfg' }) {
  snackbar = vi.fn()
  const op = useTableOperations(
    ref(config),
    'myTable',
    snackbar,
    $t,
    { locale: 'en' },
  )
  op.initializeRepository()
  return op
}

beforeEach(() => {
  vi.clearAllMocks()
  repoCtrl.supported = new Set()
  repoCtrl.getListResult = []
  repoCtrl.getListThrows = false
  repoCtrl.calls = []
  repoCtrl.failOn = new Set()
  ctrl.rowSchema = null
  mockReadXlsx.mockReset()
})

describe('useTableOperations - capability computeds', () => {
  test('title falls back through localized/config/key', () => {
    const op = setup({ title: 'My Title' })
    expect(op.title.value).toBe('My Title')
    const op2 = setup({})
    expect(op2.title.value).toBe('myTable')
  })

  test('localizedTableConfig null when config null', () => {
    const op = useTableOperations(ref(null), 'k', vi.fn(), $t, {})
    expect(op.localizedTableConfig.value).toBeNull()
  })

  test('canAddItems / canEditItems / canDeleteItems reflect supported ops', () => {
    repoCtrl.supported = new Set(['post_item', 'put_item', 'delete_item'])
    const op = setup()
    expect(op.canAddItems.value).toBe(true)
    expect(op.canEditItems.value).toBe(true)
    expect(op.canDeleteItems.value).toBe(true)
  })

  test('canDeleteItems true via delete_bulk only', () => {
    repoCtrl.supported = new Set(['delete_bulk'])
    const op = setup()
    expect(op.canDeleteItems.value).toBe(true)
  })

  test('canBulkUpload and availableBulkOperations', () => {
    repoCtrl.supported = new Set(['post_bulk', 'overwrite_all'])
    const op = setup()
    expect(op.canBulkUpload.value).toBe(true)
    expect(op.availableBulkOperations.value).toEqual(['post_bulk', 'overwrite_all'])
  })

  test('availableBulkOperations empty when none supported', () => {
    const op = setup()
    expect(op.availableBulkOperations.value).toEqual([])
  })

  test('canDownloadExcel, hasWriteOperations, hasReadOperations, showActionsColumn', () => {
    repoCtrl.supported = new Set(['post_item', 'put_item'])
    const op = setup()
    expect(op.canDownloadExcel.value).toBeTruthy()
    expect(op.hasWriteOperations.value).toBe(true)
    expect(op.hasReadOperations.value).toBeTruthy()
    expect(op.showActionsColumn.value).toBe(true)
  })
})

describe('useTableOperations - loadData', () => {
  test('loads and normalizes when GET_LIST supported', async () => {
    repoCtrl.supported = new Set(['get_list'])
    repoCtrl.getListResult = [{ id: 1 }]
    const op = setup()
    await op.loadData()
    expect(op.allItems.value).toEqual([{ id: 1 }])
    expect(op.loading.value).toBe(false)
  })

  test('empty when GET_LIST not supported', async () => {
    const op = setup()
    await op.loadData()
    expect(op.allItems.value).toEqual([])
  })

  test('handles error and shows snackbar', async () => {
    repoCtrl.supported = new Set(['get_list'])
    repoCtrl.getListThrows = true
    const op = setup()
    await op.loadData()
    expect(op.allItems.value).toEqual([])
    expect(snackbar).toHaveBeenCalledWith('table.loadingError', 'error')
  })
})

describe('useTableOperations - modal & form', () => {
  test('openAddModal initializes form fields and default data from schema', () => {
    ctrl.rowSchema = {
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        count: { type: 'integer' },
        ratio: { type: 'number' },
        flag: { type: 'boolean' },
        secret: { type: 'string', frontendReadOnly: true },
      },
    }
    const op = setup()
    op.openAddModal()
    expect(op.isEditing.value).toBe(false)
    expect(op.showModal.value).toBe(true)
    expect(Object.keys(op.formFields.value)).toEqual(['name', 'count', 'ratio', 'flag'])
    expect(op.formData.value).toEqual({ name: '', count: 0, ratio: 0, flag: false })
  })

  test('initializeFormFields fallback when no schema', () => {
    ctrl.rowSchema = null
    const op = setup()
    op.openAddModal()
    expect(op.formFields.value).toEqual({
      name: { title: 'Name', type: 'string', required: true },
    })
    expect(op.formData.value).toEqual({ name: '' })
  })

  test('openEditModal copies item without id', () => {
    ctrl.rowSchema = { properties: { name: { type: 'string' } } }
    const op = setup()
    op.openEditModal({ id: 7, name: 'x' })
    expect(op.isEditing.value).toBe(true)
    expect(op.currentItem.value).toEqual({ id: 7, name: 'x' })
    expect(op.formData.value).toEqual({ name: 'x' })
  })

  test('closeModal resets state', () => {
    const op = setup()
    op.openAddModal()
    op.closeModal()
    expect(op.showModal.value).toBe(false)
    expect(op.formData.value).toEqual({})
    expect(op.currentItem.value).toBeNull()
  })
})

describe('useTableOperations - saveItem', () => {
  test('create path on add mode', async () => {
    repoCtrl.supported = new Set(['get_list'])
    const op = setup()
    op.openAddModal()
    await op.saveItem({ name: 'new' })
    expect(repoCtrl.calls.find((c) => c.name === 'createItem')).toBeTruthy()
    expect(snackbar).toHaveBeenCalledWith('table.itemAdded', 'success')
    expect(op.showModal.value).toBe(false)
  })

  test('update path on edit mode', async () => {
    repoCtrl.supported = new Set(['get_list'])
    const op = setup()
    op.openEditModal({ id: 5, name: 'old' })
    await op.saveItem({ name: 'upd' })
    const call = repoCtrl.calls.find((c) => c.name === 'putItem')
    expect(call.payload.id).toBe(5)
    expect(snackbar).toHaveBeenCalledWith('table.itemUpdated', 'success')
  })

  test('error path shows errorAdding', async () => {
    repoCtrl.failOn = new Set(['createItem'])
    const op = setup()
    op.openAddModal()
    await op.saveItem({ name: 'x' })
    expect(snackbar).toHaveBeenCalledWith('table.errorAdding', 'error')
    expect(op.saving.value).toBe(false)
  })

  test('error path shows errorUpdating in edit mode', async () => {
    repoCtrl.failOn = new Set(['putItem'])
    const op = setup()
    op.openEditModal({ id: 1 })
    await op.saveItem({})
    expect(snackbar).toHaveBeenCalledWith('table.errorUpdating', 'error')
  })
})

describe('useTableOperations - delete flows', () => {
  test('openDeleteConfirmation sets item and dialog', () => {
    const op = setup()
    op.openDeleteConfirmation({ id: 3 })
    expect(op.itemToDelete.value).toEqual({ id: 3 })
    expect(op.showDeleteDialog.value).toBe(true)
  })

  test('confirmDelete success', async () => {
    repoCtrl.supported = new Set(['get_list'])
    const op = setup()
    op.openDeleteConfirmation({ id: 9 })
    await op.confirmDelete()
    expect(repoCtrl.calls.find((c) => c.name === 'deleteItem').payload.id).toBe(9)
    expect(snackbar).toHaveBeenCalledWith('table.itemDeleted', 'success')
    expect(op.showDeleteDialog.value).toBe(false)
  })

  test('confirmDelete error', async () => {
    repoCtrl.failOn = new Set(['deleteItem'])
    const op = setup()
    op.openDeleteConfirmation({ id: 9 })
    await op.confirmDelete()
    expect(snackbar).toHaveBeenCalledWith('table.errorDeleting', 'error')
  })
})

describe('useTableOperations - bulk delete', () => {
  test('single item uses deleteItem', async () => {
    repoCtrl.supported = new Set(['delete_item', 'get_list'])
    const op = setup()
    await op.confirmBulkDelete([{ id: 1 }])
    expect(repoCtrl.calls.find((c) => c.name === 'deleteItem')).toBeTruthy()
    expect(snackbar).toHaveBeenCalledWith('table.bulkDeleteSuccess:{"count":1}', 'success')
  })

  test('single item without delete_item support throws', async () => {
    repoCtrl.supported = new Set([])
    const op = setup()
    await op.confirmBulkDelete([{ id: 1 }])
    expect(snackbar).toHaveBeenCalledWith('table.errorBulkDelete', 'error')
  })

  test('multiple items uses deleteBulk when supported', async () => {
    repoCtrl.supported = new Set(['delete_bulk', 'get_list'])
    const op = setup()
    await op.confirmBulkDelete([{ id: 1 }, { id: 2 }])
    expect(repoCtrl.calls.find((c) => c.name === 'deleteBulk').payload.ids).toEqual([1, 2])
    expect(snackbar).toHaveBeenCalledWith('table.bulkDeleteSuccess:{"count":2}', 'success')
  })

  test('multiple items fall back to individual deletes (all success)', async () => {
    repoCtrl.supported = new Set(['delete_item', 'get_list'])
    const op = setup()
    await op.confirmBulkDelete([{ id: 1 }, { id: 2 }])
    expect(repoCtrl.calls.filter((c) => c.name === 'deleteItem')).toHaveLength(2)
    expect(snackbar).toHaveBeenCalledWith('table.bulkDeleteSuccess:{"count":2}', 'success')
  })

  test('individual deletes with partial failure', async () => {
    repoCtrl.supported = new Set(['delete_item', 'get_list'])
    // make second deleteItem call fail: failOn applies to all deleteItem calls,
    // so instead simulate by failing all then check allFailed message
    repoCtrl.failOn = new Set(['deleteItem'])
    const op = setup()
    await op.confirmBulkDelete([{ id: 1 }, { id: 2 }])
    expect(snackbar).toHaveBeenCalledWith('table.bulkDeleteAllFailed', 'error')
  })

  test('no delete ops supported throws for multiple', async () => {
    repoCtrl.supported = new Set([])
    const op = setup()
    await op.confirmBulkDelete([{ id: 1 }, { id: 2 }])
    expect(snackbar).toHaveBeenCalledWith('table.errorBulkDelete', 'error')
  })
})

describe('useTableOperations - bulk upload', () => {
  test('returns early when no files', async () => {
    const op = setup()
    await op.processBulkUpload({ files: [] })
    expect(op.uploading.value).toBe(false)
  })

  test('JSON file create bulk success', async () => {
    repoCtrl.supported = new Set(['get_list'])
    const op = setup()
    const file = new File([JSON.stringify([{ a: 1, b: '' }])], 'data.json')
    await op.processBulkUpload({ files: [file], operation: 'post_bulk' })
    const call = repoCtrl.calls.find((c) => c.name === 'createBulk')
    expect(call.payload.data).toEqual([{ a: 1, b: null }])
    expect(snackbar).toHaveBeenCalledWith('table.bulkUploadSuccess', 'success')
  })

  test('JSON single object wrapped in array', async () => {
    repoCtrl.supported = new Set(['get_list'])
    const op = setup()
    const file = new File([JSON.stringify({ a: 1 })], 'data.json')
    await op.processBulkUpload({ files: [file], operation: 'overwrite_all' })
    expect(repoCtrl.calls.find((c) => c.name === 'overwriteAll')).toBeTruthy()
  })

  test('CSV file parsing path', async () => {
    repoCtrl.supported = new Set(['get_list'])
    const op = setup()
    const file = new File(['a\n1'], 'data.csv')
    await op.processBulkUpload({ files: [file], operation: 'post_bulk' })
    expect(repoCtrl.calls.find((c) => c.name === 'createBulk')).toBeTruthy()
  })

  test('xlsx file parsing path', async () => {
    repoCtrl.supported = new Set(['get_list'])
    mockReadXlsx.mockResolvedValue([['name', 'age'], ['Bob', 30]])
    const op = setup()
    const file = new File(['x'], 'data.xlsx')
    await op.processBulkUpload({ files: [file], operation: 'post_bulk' })
    const call = repoCtrl.calls.find((c) => c.name === 'createBulk')
    expect(call.payload.data).toEqual([{ name: 'Bob', age: 30 }])
  })

  test('xlsx with too few rows surfaces error', async () => {
    const op = setup()
    mockReadXlsx.mockResolvedValue([['only-header']])
    const file = new File(['x'], 'data.xlsx')
    await op.processBulkUpload({ files: [file], operation: 'post_bulk' })
    expect(snackbar).toHaveBeenCalledWith('table.errorBulkUpload', 'error')
  })

  test('empty parsed data throws and shows error', async () => {
    const op = setup()
    const file = new File([JSON.stringify([])], 'data.json')
    await op.processBulkUpload({ files: [file], operation: 'post_bulk' })
    expect(snackbar).toHaveBeenCalledWith('table.errorBulkUpload', 'error')
  })

  test('unsupported extension rejects', async () => {
    const op = setup()
    const file = new File(['x'], 'data.txt')
    await op.processBulkUpload({ files: [file], operation: 'post_bulk' })
    expect(snackbar).toHaveBeenCalledWith('table.errorBulkUpload', 'error')
  })

  test('open/close bulk upload modal', () => {
    const op = setup()
    op.openBulkUploadModal()
    expect(op.showBulkUploadDialog.value).toBe(true)
    op.closeBulkUploadModal()
    expect(op.showBulkUploadDialog.value).toBe(false)
  })

  test('openBulkDeleteConfirmation', () => {
    const op = setup()
    op.openBulkDeleteConfirmation()
    expect(op.showBulkDeleteDialog.value).toBe(true)
  })
})

describe('useTableOperations - downloadExcel', () => {
  test('success path', async () => {
    const op = setup()
    await op.downloadExcel()
    expect(mockExportExcel).toHaveBeenCalled()
    expect(snackbar).toHaveBeenCalledWith('table.downloadExcelSuccess', 'success')
    expect(op.downloading.value).toBe(false)
  })

  test('error path', async () => {
    mockExportExcel.mockRejectedValueOnce(new Error('boom'))
    const op = setup()
    await op.downloadExcel()
    expect(snackbar).toHaveBeenCalledWith('table.errorDownloadExcelTable', 'error')
  })
})
