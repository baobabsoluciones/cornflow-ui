import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import DataComparisonModal from '@cornflow-ui/core/components/project-execution/DataComparisonModal.vue'
import type { DiffSummary } from '@cornflow-ui/core/composables/project-execution/useMasterTableMatch'

const baseSummary = (over: Partial<DiffSummary> = {}): DiffSummary => ({
  onlyInInstance: 0,
  onlyInMaster: 0,
  different: 0,
  identical: 0,
  totalInstance: 0,
  totalMaster: 0,
  ...over,
})

// Render-through stubs for Vuetify overlay/virtual components that crash jsdom
// (visualViewport) or skip slot rendering by default.
const overlayStubs = {
  'v-dialog': {
    props: ['modelValue'],
    template: '<div class="v-dialog-stub"><slot /></div>',
  },
  'v-tooltip': { template: '<div class="v-tooltip-stub"><slot /></div>' },
  'v-virtual-scroll': {
    props: ['items'],
    template:
      '<div class="v-virtual-scroll-stub"><template v-for="(item, index) in items" :key="index"><slot :item="item" :index="index" /></template></div>',
  },
}

const createWrapper = (props: Record<string, unknown> = {}) => {
  const vuetify = createVuetify({ components, directives })
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

  return mount(DataComparisonModal, {
    props: {
      modelValue: true,
      tableName: 'orders',
      masterTableTitle: 'Orders Master',
      instanceData: [],
      masterData: [],
      diffSummary: baseSummary(),
      ...props,
    },
    global: {
      plugins: [vuetify, pinia, i18n],
      stubs: overlayStubs,
    },
  })
}

/** Advance past the 300ms loading timer so content renders. */
const finishLoading = async () => {
  vi.advanceTimersByTime(350)
  await nextTick()
  await nextTick()
}

describe('DataComparisonModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('loading + lifecycle', () => {
    test('shows loading overlay, then content after delay', async () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.data-comparison-modal__loading').exists()).toBe(true)
      await finishLoading()
      expect(wrapper.find('.data-comparison-modal__loading').exists()).toBe(
        false,
      )
      expect(wrapper.find('.data-comparison-modal__tabs').exists()).toBe(true)
    })

    test('watcher re-triggers loading + resets restored indices on reopen', async () => {
      const wrapper = createWrapper({ modelValue: false })
      // immediate watch with false: not loading content path
      await wrapper.setProps({ modelValue: true })
      await nextTick()
      expect((wrapper.vm as any).isLoading).toBe(true)
      ;(wrapper.vm as any).restoredMasterIndices = new Set([1, 2])
      await wrapper.setProps({ modelValue: false })
      await wrapper.setProps({ modelValue: true })
      await nextTick()
      expect((wrapper.vm as any).restoredMasterIndices.size).toBe(0)
      await finishLoading()
    })
  })

  describe('fullscreen toggle', () => {
    test('toggleFullscreen flips state and virtualTableHeight', async () => {
      const wrapper = createWrapper()
      await finishLoading()
      const vm = wrapper.vm as any
      expect(vm.isFullscreen).toBe(false)
      expect(vm.virtualTableHeight).toBe(350)
      vm.toggleFullscreen()
      await nextTick()
      expect(vm.isFullscreen).toBe(true)
      expect(vm.virtualTableHeight).toBe(500)
    })
  })

  describe('summary view counts', () => {
    test('renders diff summary numbers', async () => {
      const wrapper = createWrapper({
        diffSummary: baseSummary({
          totalInstance: 5,
          totalMaster: 4,
          onlyInInstance: 1,
          onlyInMaster: 2,
          different: 1,
          identical: 1,
        }),
        instanceData: [{ id: 1, name: 'a' }],
        masterData: [{ id: 9, name: 'z' }],
      })
      await finishLoading()
      const stats = wrapper.findAll('.data-comparison-modal__stat-value')
      const text = stats.map((s) => s.text())
      expect(text).toContain('1') // onlyInInstance
      expect(text).toContain('2') // onlyInMaster
    })
  })

  describe('tableHeaders computed', () => {
    test('builds headers from data, excludes id/_id and __ markers', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 1, _id: 'x', __pendingCreate: true, name: 'A', qty: 2 }],
        masterData: [{ id: 1, name: 'B', qty: 3 }],
      })
      await finishLoading()
      const headers = (wrapper.vm as any).tableHeaders as any[]
      const keys = headers.map((h) => h.key)
      expect(keys).toContain('name')
      expect(keys).toContain('qty')
      expect(keys).not.toContain('id')
      expect(keys).not.toContain('_id')
    })

    test('empty data yields no headers', async () => {
      const wrapper = createWrapper()
      await finishLoading()
      expect((wrapper.vm as any).tableHeaders).toEqual([])
    })

    test('restricts to instanceSchemaColumns and adds missing schema cols', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 1, name: 'A', extra: 'ignored' }],
        masterData: [{ id: 1, name: 'B' }],
        instanceSchemaColumns: ['name', 'price'],
      })
      await finishLoading()
      const keys = ((wrapper.vm as any).tableHeaders as any[]).map((h) => h.key)
      expect(keys).toContain('name')
      // price declared in schema but absent from data -> still added as header
      expect(keys).toContain('price')
      // extra not in schema -> excluded
      expect(keys).not.toContain('extra')
    })
  })

  describe('detailedDiffs + filteredChanges', () => {
    const setup = async (extra: Record<string, unknown> = {}) => {
      const wrapper = createWrapper({
        instanceData: [
          { id: 1, name: 'Alpha', qty: 10 }, // modified
          { id: 2, name: 'Added', qty: 1 }, // added (no master)
        ],
        masterData: [
          { id: 1, name: 'Alpha', qty: 99 }, // modified counterpart
          { id: 3, name: 'Removed', qty: 5 }, // removed (no instance)
        ],
        diffSummary: baseSummary({
          onlyInInstance: 1,
          onlyInMaster: 1,
          different: 1,
        }),
        ...extra,
      })
      await finishLoading()
      return wrapper
    }

    test('computes added / removed / modified diffs', async () => {
      const wrapper = await setup()
      const diffs = (wrapper.vm as any).detailedDiffs as any[]
      const types = diffs.map((d) => d.type).sort()
      expect(types).toEqual(['added', 'modified', 'removed'])
    })

    test('totalChanges sums diff summary buckets', async () => {
      const wrapper = await setup()
      expect((wrapper.vm as any).totalChanges).toBe(3)
    })

    test('filteredChanges all vs specific filter', async () => {
      const wrapper = await setup()
      const vm = wrapper.vm as any
      expect(vm.filteredChanges.length).toBe(3)
      vm.changeFilter = 'added'
      await nextTick()
      expect(vm.filteredChanges.every((d: any) => d.type === 'added')).toBe(true)
      vm.changeFilter = 'removed'
      await nextTick()
      expect(vm.filteredChanges.every((d: any) => d.type === 'removed')).toBe(
        true,
      )
      vm.changeFilter = 'modified'
      await nextTick()
      expect(vm.filteredChanges.every((d: any) => d.type === 'modified')).toBe(
        true,
      )
    })

    test('changes view renders change items and modified diff segments', async () => {
      const wrapper = await setup()
      const vm = wrapper.vm as any
      vm.viewMode = 'changes'
      await nextTick()
      await nextTick()
      expect(
        wrapper.findAll('.data-comparison-modal__change-item').length,
      ).toBeGreaterThan(0)
      // modified row has a diff segment (qty 99 -> 10)
      expect(wrapper.find('.data-comparison-modal__mod-seg--diff').exists()).toBe(
        true,
      )
    })

    test('empty filter shows empty state', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 1, name: 'A' }],
        masterData: [{ id: 1, name: 'A' }],
        diffSummary: baseSummary({ identical: 1 }),
      })
      await finishLoading()
      const vm = wrapper.vm as any
      vm.viewMode = 'changes'
      await nextTick()
      await nextTick()
      expect(vm.filteredChanges.length).toBe(0)
      expect(wrapper.find('.data-comparison-modal__empty').exists()).toBe(true)
    })
  })

  describe('getModifiedRowDisplayLines', () => {
    test('returns [] for non-modified item', async () => {
      const wrapper = createWrapper()
      await finishLoading()
      const fn = (wrapper.vm as any).getModifiedRowDisplayLines
      expect(fn({ type: 'added', instanceRow: { a: 1 } })).toEqual([])
      expect(fn({ type: 'modified' })).toEqual([]) // missing rows/changes
    })

    test('marks changed and unchanged fields', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 1, name: 'Alpha', qty: 10 }],
        masterData: [{ id: 1, name: 'Alpha', qty: 99 }],
        diffSummary: baseSummary({ different: 1 }),
      })
      await finishLoading()
      const vm = wrapper.vm as any
      const item = vm.detailedDiffs.find((d: any) => d.type === 'modified')
      const lines = vm.getModifiedRowDisplayLines(item)
      const changed = lines.find((l: any) => l.changed)
      const unchanged = lines.find((l: any) => !l.changed)
      expect(changed).toBeTruthy()
      expect(changed.field.toLowerCase()).toBe('qty')
      expect(unchanged).toBeTruthy()
      expect(unchanged.field.toLowerCase()).toBe('name')
    })
  })

  describe('getRowPreviewEntries', () => {
    test('returns [] for falsy row', async () => {
      const wrapper = createWrapper()
      await finishLoading()
      expect((wrapper.vm as any).getRowPreviewEntries(null)).toEqual([])
    })

    test('filters id/_id and honors schema columns', async () => {
      const wrapper = createWrapper({
        instanceSchemaColumns: ['name'],
      })
      await finishLoading()
      const entries = (wrapper.vm as any).getRowPreviewEntries({
        id: 1,
        _id: 'x',
        name: 'Alpha',
        secret: 'hidden',
      })
      const keys = entries.map((e: any) => e.key)
      expect(keys).toContain('name')
      expect(keys).not.toContain('id')
      expect(keys).not.toContain('_id')
      expect(keys).not.toContain('secret')
    })

    test('without schema returns all non-id fields', async () => {
      const wrapper = createWrapper()
      await finishLoading()
      const entries = (wrapper.vm as any).getRowPreviewEntries({
        id: 1,
        name: 'A',
        qty: 2,
      })
      expect(entries.map((e: any) => e.key).sort()).toEqual(['name', 'qty'])
    })
  })

  describe('changeItemKey', () => {
    test('prefixes by type', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 1, name: 'A' }],
        masterData: [{ id: 1, name: 'A' }],
      })
      await finishLoading()
      const fn = (wrapper.vm as any).changeItemKey
      expect(fn({ type: 'modified', instanceRow: { id: 1 } }, 0)).toMatch(/^m-/)
      expect(fn({ type: 'added', instanceRow: { id: 2 } }, 1)).toMatch(/^a-/)
      expect(fn({ type: 'removed', masterRow: { id: 3 } }, 2)).toMatch(/^r-/)
      expect(fn({ type: 'identical' }, 4)).toBe('x-4')
    })
  })

  describe('getRowClass', () => {
    test('instance: pending markers, added, modified', async () => {
      const wrapper = createWrapper({
        instanceData: [
          { id: 1, name: 'Alpha', qty: 1 },
          { id: 2, name: 'New', qty: 2 },
        ],
        masterData: [{ id: 1, name: 'Alpha', qty: 99 }],
      })
      await finishLoading()
      const vm = wrapper.vm as any
      expect(vm.getRowClass({ __pendingDelete: true }, 'instance')).toBe(
        'row-pending-delete',
      )
      expect(vm.getRowClass({ __pendingCreate: true }, 'instance')).toBe(
        'row-pending-create',
      )
      // id 2 has no master -> row-added
      expect(vm.getRowClass({ id: 2, name: 'New', qty: 2 }, 'instance')).toBe(
        'row-added',
      )
      // id 1 differs (qty) -> row-modified
      expect(vm.getRowClass({ id: 1, name: 'Alpha', qty: 1 }, 'instance')).toBe(
        'row-modified',
      )
    })

    test('master: removed and modified', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 1, name: 'Alpha', qty: 1 }],
        masterData: [
          { id: 1, name: 'Alpha', qty: 99 },
          { id: 3, name: 'Gone', qty: 5 },
        ],
      })
      await finishLoading()
      const vm = wrapper.vm as any
      // id 3 has no instance -> row-removed
      expect(vm.getRowClass({ id: 3, name: 'Gone', qty: 5 }, 'master')).toBe(
        'row-removed',
      )
      // id 1 differs -> row-modified
      expect(vm.getRowClass({ id: 1, name: 'Alpha', qty: 99 }, 'master')).toBe(
        'row-modified',
      )
    })

    test('returns empty string for identical instance/master rows', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 1, name: 'A', qty: 1 }],
        masterData: [{ id: 1, name: 'A', qty: 1 }],
      })
      await finishLoading()
      const vm = wrapper.vm as any
      expect(vm.getRowClass({ id: 1, name: 'A', qty: 1 }, 'instance')).toBe('')
      expect(vm.getRowClass({ id: 1, name: 'A', qty: 1 }, 'master')).toBe('')
    })
  })

  describe('getCellValue', () => {
    test('exact, case-insensitive, missing, non-object', async () => {
      const wrapper = createWrapper()
      await finishLoading()
      const fn = (wrapper.vm as any).getCellValue
      expect(fn({ Name: 'A' }, 'Name')).toBe('A') // exact
      expect(fn({ name: 'A' }, 'Name')).toBe('A') // ci fallback
      expect(fn({ other: 1 }, 'missing')).toBeUndefined()
      expect(fn(null, 'x')).toBeUndefined()
      expect(fn('str', 'x')).toBeUndefined()
    })
  })

  describe('formatValue', () => {
    test('null/undefined/object/primitive', async () => {
      const wrapper = createWrapper()
      await finishLoading()
      const fn = (wrapper.vm as any).formatValue
      expect(fn(null)).toBe('-')
      expect(fn(undefined)).toBe('-')
      expect(fn({ a: 1 })).toBe('{"a":1}')
      expect(fn(42)).toBe('42')
      expect(fn('hi')).toBe('hi')
    })
  })

  describe('emits', () => {
    test('close emits update:modelValue false', async () => {
      const wrapper = createWrapper()
      await finishLoading()
      ;(wrapper.vm as any).close()
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    test('restoreMasterRow emits row + tracks index', async () => {
      const masterData = [{ id: 1, name: 'A' }]
      const wrapper = createWrapper({ masterData, allowRowRestore: true })
      await finishLoading()
      ;(wrapper.vm as any).restoreMasterRow(0)
      expect(wrapper.emitted('restore-master-row')?.[0]).toEqual([masterData[0]])
      expect((wrapper.vm as any).restoredMasterIndices.has(0)).toBe(true)
    })

    test('restoreMasterRow no-op for out-of-range index', async () => {
      const wrapper = createWrapper({ masterData: [], allowRowRestore: true })
      await finishLoading()
      ;(wrapper.vm as any).restoreMasterRow(5)
      expect(wrapper.emitted('restore-master-row')).toBeUndefined()
    })

    test('deleteInstanceRow emits row', async () => {
      const instanceData = [{ id: 1, name: 'A' }]
      const wrapper = createWrapper({ instanceData, allowRowDelete: true })
      await finishLoading()
      ;(wrapper.vm as any).deleteInstanceRow(0)
      expect(wrapper.emitted('delete-instance-row')?.[0]).toEqual([
        instanceData[0],
      ])
    })

    test('deleteInstanceRow no-op for out-of-range index', async () => {
      const wrapper = createWrapper({ instanceData: [], allowRowDelete: true })
      await finishLoading()
      ;(wrapper.vm as any).deleteInstanceRow(9)
      expect(wrapper.emitted('delete-instance-row')).toBeUndefined()
    })
  })

  describe('side-by-side view rendering', () => {
    test('renders virtual rows with action/restore columns', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 1, name: 'Alpha', qty: 1 }],
        masterData: [
          { id: 1, name: 'Alpha', qty: 99 },
          { id: 3, name: 'Gone', qty: 5 },
        ],
        allowRowDelete: true,
        allowRowRestore: true,
      })
      await finishLoading()
      const vm = wrapper.vm as any
      vm.viewMode = 'side-by-side'
      await nextTick()
      await nextTick()
      expect(wrapper.findAll('.data-comparison-modal__vtable-row').length).toBeGreaterThan(
        0,
      )
      // restore action cell present
      expect(
        wrapper.find('.data-comparison-modal__vtable-cell--restore').exists(),
      ).toBe(true)
      expect(
        wrapper.find('.data-comparison-modal__vtable-cell--action').exists(),
      ).toBe(true)
    })

    test('displayInstanceData carries __pending markers through normalization', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 1, name: 'A', __pendingDelete: true }],
        masterData: [{ id: 1, name: 'A' }],
      })
      await finishLoading()
      const rows = (wrapper.vm as any).displayInstanceData as any[]
      expect(rows[0].__pendingDelete).toBe(true)
    })
  })

  describe('masterTableConfig excluded keys', () => {
    // A FK field is excluded from compare/preview; columns_to_join display column kept.
    const masterTableConfig = {
      get_list: {
        response_schema: {
          items: {
            properties: {
              factory_id: { isForeignKey: true },
              name: { type: 'string' },
            },
          },
        },
      },
    }

    test('compareExcludedKeys removes FK column from preview entries', async () => {
      const wrapper = createWrapper({
        masterTableConfig,
        instanceData: [{ id: 1, name: 'A', factory_id: 7 }],
        masterData: [{ id: 1, name: 'A', factory_id: 7 }],
      })
      await finishLoading()
      const vm = wrapper.vm as any
      expect(Array.from(vm.compareExcludedKeys)).toContain('factory_id')
      const entries = vm.getRowPreviewEntries({
        id: 1,
        name: 'A',
        factory_id: 7,
      })
      const keys = entries.map((e: any) => e.key)
      expect(keys).toContain('name')
      expect(keys).not.toContain('factory_id')
    })

    test('excluded FK difference does not mark row modified', async () => {
      const wrapper = createWrapper({
        masterTableConfig,
        instanceData: [{ id: 1, name: 'A', factory_id: 7 }],
        masterData: [{ id: 1, name: 'A', factory_id: 99 }],
      })
      await finishLoading()
      // only factory_id differs but it's excluded -> identical
      const diffs = (wrapper.vm as any).detailedDiffs as any[]
      expect(diffs.filter((d) => d.type === 'modified').length).toBe(0)
    })
  })

  describe('getRowChanges both-null normalization branch', () => {
    test('treats empty-string vs null as no change', async () => {
      // Shared code key; qty differs (real change), note is ''/null on each side (both normalize null).
      const wrapper = createWrapper({
        instanceData: [{ id: 1, code: 'K1', qty: 1, note: '' }],
        masterData: [{ id: 1, code: 'K1', qty: 2, note: null }],
        diffSummary: baseSummary({ different: 1 }),
      })
      await finishLoading()
      const vm = wrapper.vm as any
      const item = vm.detailedDiffs.find((d: any) => d.type === 'modified')
      expect(item).toBeTruthy()
      // qty changed, note both-normalize-to-null -> excluded from changes
      const fields = item.changes.map((c: any) => c.field.toLowerCase())
      expect(fields).toContain('qty')
      expect(fields).not.toContain('note')
    })
  })

  describe('schema labels for columns absent from rows', () => {
    test('getModifiedRowDisplayLines includes schema column missing from rows', async () => {
      // Share a stable match key (code) so the row pairs as "modified"; only qty differs.
      const wrapper = createWrapper({
        instanceData: [{ id: 1, code: 'X1', qty: 10 }],
        masterData: [{ id: 1, code: 'X1', qty: 99 }],
        instanceSchemaColumns: ['code', 'qty', 'phantom'],
        diffSummary: baseSummary({ different: 1 }),
      })
      await finishLoading()
      const vm = wrapper.vm as any
      const item = vm.detailedDiffs.find((d: any) => d.type === 'modified')
      expect(item).toBeTruthy()
      const lines = vm.getModifiedRowDisplayLines(item)
      const fields = lines.map((l: any) => l.field.toLowerCase())
      expect(fields).toContain('phantom')
    })
  })

  describe('added/removed preview rows in changes view', () => {
    test('renders added and removed change segments', async () => {
      const wrapper = createWrapper({
        instanceData: [{ id: 2, name: 'Added', qty: 1 }],
        masterData: [{ id: 3, name: 'Removed', qty: 5 }],
        diffSummary: baseSummary({ onlyInInstance: 1, onlyInMaster: 1 }),
      })
      await finishLoading()
      const vm = wrapper.vm as any
      vm.viewMode = 'changes'
      await nextTick()
      await nextTick()
      const items = wrapper.findAll('.data-comparison-modal__change-item')
      expect(items.length).toBe(2)
      expect(
        wrapper.find('.data-comparison-modal__change-item--added').exists(),
      ).toBe(true)
      expect(
        wrapper.find('.data-comparison-modal__change-item--removed').exists(),
      ).toBe(true)
    })
  })
})
