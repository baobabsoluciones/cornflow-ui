import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed, defineComponent, h, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'

// ─── Mocks ───────────────────────────────────────────────────────────────────

// `route` must be reactive so the composable's route.params watchers fire when
// the test mutates params. vi.hoisted runs before vue import, so build it lazily.
const routeHolder = vi.hoisted(() => ({ value: null as any }))
const routerPush = vi.hoisted(() => vi.fn())
const routerReplace = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  useRoute: () => routeHolder.value,
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}))

const route = reactive({
  path: '/configuration/group/demand',
  params: {} as Record<string, any>,
})
routeHolder.value = route

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ locale: { value: 'en' } }),
}))

let storeState: any
vi.mock('@/stores/general', () => ({
  useGeneralStore: () => storeState,
}))

// FrontendAutomationService helpers — predictable transforms
vi.mock('@/services/FrontendAutomationService', () => ({
  fromUrlFriendly: vi.fn((key: string) => key.replace(/-/g, '_')),
  toUrlFriendly: vi.fn((key: string) => String(key).replace(/_/g, '-')),
  getMasterDataTableRankByDrawerHierarchy: vi.fn(
    () => new Map<string, number>([['table_a', 1]]),
  ),
  normalizeTableKeyForHierarchyMatch: vi.fn((k: string) =>
    k.toLowerCase().replace(/-/g, '_'),
  ),
}))

vi.mock('@/utils/i18nUtils', () => ({
  resolveTitle: vi.fn((raw: any, fallback: string) =>
    typeof raw === 'string' ? raw : fallback,
  ),
}))

vi.mock('@/utils/schemaUtils', () => ({
  formatTitle: vi.fn((k: string) => `FMT:${k}`),
}))

import { useGroupTables } from '@/composables/section-view/useGroupTables'

// Mount helper so onMounted lifecycle runs. Returns the composable result.
function mountComposable(config: any, sectionType = 'configuration') {
  let api: ReturnType<typeof useGroupTables>
  const Comp = defineComponent({
    setup() {
      api = useGroupTables(
        computed(() => config),
        ref(sectionType),
      )
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { api: api!, wrapper }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  route.path = '/configuration/group/demand'
  route.params = {}
  storeState = {
    getConfigurations: { masterData: { table_a: {}, table_b: {} } },
    masterDataSections: null,
    masterDataGroups: null,
  }
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('useGroupTables', () => {
  test('group view: groupTables filters and sorts by group', async () => {
    route.params = { groupName: 'demand' }
    const config = {
      table_a: { group: 'demand', order: 2 },
      table_b: { group: 'demand', order: 1 },
      table_c: { group: 'other' },
    }
    const { api } = mountComposable(config)
    await nextTick()
    expect(api.isGroupView.value).toBe(true)
    // sorted by order: table_b (1) before table_a (2)
    expect(Object.keys(api.groupTables.value)).toEqual(['table_b', 'table_a'])
  })

  test('group matched by _groupKey (url-friendly)', async () => {
    route.params = { groupName: 'demand' }
    const config = {
      t1: { group: 'Demand Group', _groupKey: 'demand' },
    }
    const { api } = mountComposable(config)
    await nextTick()
    expect(Object.keys(api.groupTables.value)).toContain('t1')
  })

  test('tabsData maps keys to titles with fallback', async () => {
    route.params = { groupName: 'demand' }
    const config = {
      table_a: { group: 'demand', title: 'Table A' },
      table_b: { group: 'demand' }, // no title -> fallback
    }
    const { api } = mountComposable(config)
    await nextTick()
    const tabs = api.tabsData.value
    expect(tabs.find((t) => t.value === 'table_a')?.text).toBe('Table A')
    expect(tabs.find((t) => t.value === 'table_b')?.text).toBe('FMT:table_b')
  })

  test('selectedTableConfig auto-selects first table in group', async () => {
    route.params = { groupName: 'demand' }
    const config = {
      table_a: { group: 'demand', title: 'A' },
    }
    const { api } = mountComposable(config)
    await nextTick()
    expect(api.selectedTable.value).toBe('table_a')
    expect(api.selectedTableConfig.value).toEqual({ group: 'demand', title: 'A' })
  })

  test('single table view resolves tableConfig via findTableKeyInConfig', async () => {
    route.path = '/configuration/table_a'
    route.params = { tableKey: 'table-a' }
    const config = { table_a: { title: 'A' } }
    const { api } = mountComposable(config)
    await nextTick()
    expect(api.isGroupView.value).toBe(false)
    expect(api.tableConfig.value).toEqual({ title: 'A' })
    expect(api.resolvedTableKey.value).toBe('table_a')
  })

  test('findTableKeyInConfig handles direct, url-friendly and case variations', () => {
    route.params = { groupName: 'demand' }
    const { api } = mountComposable({ Table_A: {}, table_b: {} })
    expect(api.findTableKeyInConfig('Table_A', { Table_A: {} })).toBe('Table_A')
    expect(api.findTableKeyInConfig('table-b', { table_b: {} })).toBe('table_b')
    expect(api.findTableKeyInConfig('', {})).toBeNull()
    expect(api.findTableKeyInConfig('missing', { x: {} })).toBeNull()
  })

  test('handleTabChange sets switching, pushes route after timers', async () => {
    route.params = { groupName: 'demand' }
    const config = {
      table_a: { group: 'demand' },
      table_b: { group: 'demand' },
    }
    const { api } = mountComposable(config)
    await nextTick()
    api.handleTabChange(1) // table_b
    expect(api.tableSwitching.value).toBe(true)
    expect(api.selectedTabIndex.value).toBe(1)
    // setTimeout(0) performs the switch + router.push
    vi.advanceTimersByTime(1)
    expect(api.selectedTable.value).toBe('table_b')
    expect(routerPush).toHaveBeenCalled()
  })

  test('handleTabChange no-op when same table selected', async () => {
    route.params = { groupName: 'demand' }
    const config = { table_a: { group: 'demand' } }
    const { api } = mountComposable(config)
    await nextTick()
    routerPush.mockClear()
    api.handleTabChange(0) // already table_a
    vi.advanceTimersByTime(1)
    expect(routerPush).not.toHaveBeenCalled()
  })

  test('initializeSelectedTable navigates when no tableKey in route', async () => {
    route.path = '/configuration/group/demand'
    route.params = { groupName: 'demand' }
    const config = { table_a: { group: 'demand' } }
    const { api } = mountComposable(config)
    await api.initializeSelectedTable()
    expect(routerReplace).toHaveBeenCalled()
  })

  test('route tableKey watcher updates selectedTable and tab index in group view', async () => {
    route.params = { groupName: 'demand' }
    const config = {
      table_a: { group: 'demand' },
      table_b: { group: 'demand' },
    }
    const { api } = mountComposable(config)
    await nextTick()
    route.params = { ...route.params, tableKey: 'table-b' }
    await nextTick()
    expect(api.tableKey.value).toBe('table_b')
    expect(api.selectedTable.value).toBe('table_b')
  })

  test('route groupName watcher resolves group from config', async () => {
    const config = { table_a: { group: 'Demand', _groupKey: 'demand' } }
    const { api } = mountComposable(config)
    await nextTick()
    route.params = { ...route.params, groupName: 'demand' }
    await nextTick()
    expect(api.groupName.value).toBe('Demand')
  })

  test('input-data ranking via master hierarchy when no local order', async () => {
    route.params = { groupName: 'grp' }
    const config = {
      table_a: { group: 'grp' }, // no order -> use rank map (1)
      table_z: { group: 'grp' }, // no rank -> infinity
    }
    const { api } = mountComposable(config, 'input-data')
    await nextTick()
    expect(Object.keys(api.groupTables.value)[0]).toBe('table_a')
  })
})
