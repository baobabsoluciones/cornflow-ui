import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k, locale: { value: 'en' } }),
}))

let storeState: any
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => storeState,
}))

vi.mock('@cornflow-ui/core/utils/tableFilterUtils', () => ({
  getFilterFieldTypeFromSchemaProperty: vi.fn(() => 'string'),
}))

// schemaUtils — light fakes returning controllable data.
vi.mock('@cornflow-ui/core/utils/schemaUtils', () => ({
  getListResponseRowProperties: vi.fn((config: any) => config?.__rowSchema ?? null),
  normalizeGetListResponseToRows: vi.fn((data: any) =>
    Array.isArray(data) ? data : [],
  ),
  isParameterPropertySchemaVisible: vi.fn((prop: any) => prop?.visible !== false),
  normalizeJsonSchemaPropertyTypeForUi: vi.fn((prop: any) => prop?.type ?? 'string'),
}))

import {
  useExecutionTableData,
  ensureItemIds,
} from '@cornflow-ui/core/composables/section-view/useExecutionTableData'

beforeEach(() => {
  vi.clearAllMocks()
  storeState = { selectedExecution: null }
})

describe('ensureItemIds', () => {
  test('returns input unchanged for empty / non-array', () => {
    expect(ensureItemIds([])).toEqual([])
    expect(ensureItemIds(null as any)).toBeNull()
  })

  test('returns unchanged when all rows already have ids', () => {
    const rows = [{ id: 1 }, { id: 2 }]
    expect(ensureItemIds(rows)).toBe(rows)
  })

  test('assigns deterministic ids to rows missing them', () => {
    const result = ensureItemIds([{ name: 'a' }, { id: 5, name: 'b' }])
    expect(result[0].id).toBe('__row_0')
    expect(result[1].id).toBe(5)
  })
})

describe('useExecutionTableData', () => {
  test('no selectedExecution -> empty items, hasData false', async () => {
    const composable = useExecutionTableData(
      ref('tableA'),
      ref({ title: 'A' }),
      ref('instance'),
    )
    await nextTick()
    expect(composable.items.value).toEqual([])
    expect(composable.hasData.value).toBe(false)
    expect(composable.tableTitle.value).toBe('A')
  })

  test('loads instance data and assigns ids', async () => {
    storeState.selectedExecution = {
      experiment: { instance: { data: { tableA: [{ name: 'x' }] } } },
    }
    const composable = useExecutionTableData(
      ref('tableA'),
      ref({ title: 'A', __rowSchema: null }),
      ref('instance'),
    )
    await nextTick()
    expect(composable.loading.value).toBe(false)
    expect(composable.items.value).toHaveLength(1)
    expect(composable.items.value[0].id).toBe('__row_0')
    expect(composable.hasData.value).toBe(true)
  })

  test('solution data path with experiment fallback', async () => {
    storeState.selectedExecution = {
      solution: { data: { tableB: [{ id: 7 }] } },
    }
    const composable = useExecutionTableData(
      ref('tableB'),
      ref({ title: 'B' }),
      ref('solution'),
    )
    await nextTick()
    expect(composable.items.value[0].id).toBe(7)
  })

  test('validation table reads dataChecks', async () => {
    storeState.selectedExecution = {
      instance: { dataChecks: { vt: [{ id: 1, msg: 'ok' }] } },
    }
    const composable = useExecutionTableData(
      ref('vt'),
      ref({ title: 'V', group: 'validations' }),
      ref('instance'),
    )
    await nextTick()
    expect(composable.items.value).toHaveLength(1)
  })

  test('validation message list normalizes primitive array to {id, message}', async () => {
    storeState.selectedExecution = {
      instance: { dataChecks: { vt: ['error one', 'error two'] } },
    }
    const composable = useExecutionTableData(
      ref('vt'),
      ref({ title: 'V', group: 'Validaciones', isPrimitiveArray: true }),
      ref('instance'),
    )
    await nextTick()
    expect(composable.isValidationMessageList.value).toBe(true)
    expect(composable.isPrimitiveArray.value).toBe(false)
    expect(composable.items.value).toEqual([
      { id: 0, message: 'error one' },
      { id: 1, message: 'error two' },
    ])
    // headers single column
    expect(composable.headers.value).toHaveLength(1)
    expect(composable.headers.value[0].value).toBe('message')
  })

  test('raw kpis source path', async () => {
    storeState.selectedExecution = {
      solution: { rawKpis: { kpiSrc: [{ a: 1 }] } },
    }
    const composable = useExecutionTableData(
      ref('kpiTable'),
      ref({ title: 'K', _isFromRawKpis: true, _rawKpisSourceKey: 'kpiSrc' }),
      ref('solution'),
    )
    await nextTick()
    expect(composable.items.value).toHaveLength(1)
  })

  test('headers built from row schema, filter fields filter out fk/hidden', async () => {
    storeState.selectedExecution = {
      instance: { data: { t: [{ id: 1, name: 'a' }] } },
    }
    const composable = useExecutionTableData(
      ref('t'),
      ref({
        title: 'T',
        __rowSchema: {
          properties: {
            name: { title: 'Name', type: 'string' },
            hiddenCol: { title: 'H', visible: false },
          },
          required: ['name'],
        },
      }),
      ref('instance'),
    )
    await nextTick()
    expect(composable.headers.value.map((h) => h.value)).toEqual(['name'])
    expect(composable.headers.value[0].required).toBe(true)
    expect(composable.availableFilterFields.value).toHaveLength(1)
    expect(composable.availableFilterFields.value[0].key).toBe('name')
  })

  test('no executionData for type returns empty', async () => {
    storeState.selectedExecution = { experiment: {} }
    const composable = useExecutionTableData(
      ref('t'),
      ref({ title: 'T' }),
      ref('instance'),
    )
    await nextTick()
    expect(composable.items.value).toEqual([])
  })

  test('refresh reloads and tableTitle falls back to key then default', async () => {
    storeState.selectedExecution = {
      instance: { data: { t: [{ id: 1 }] } },
    }
    const composable = useExecutionTableData(
      ref('t'),
      ref(null),
      ref('instance'),
    )
    await nextTick()
    await composable.refresh()
    expect(composable.tableTitle.value).toBe('t')
  })
})
