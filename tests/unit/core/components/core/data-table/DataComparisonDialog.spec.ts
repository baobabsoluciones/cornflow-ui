import { describe, expect, test } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import DataComparisonDialog from '@cornflow-ui/core/components/core/data-table/DataComparisonDialog.vue'
import type { DataColumn } from '@cornflow-ui/core/components/core/data-table/types'
import type { ComparisonLine } from '@cornflow-ui/core/utils/dataComparison'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      common: { close: 'Close' },
      table: { yes: 'Yes', no: 'No' },
      dataTable: {
        comparison: {
          title: 'Data comparison: {table}',
          views: { summary: 'Summary', side: 'Side by side', changes: 'Changes' },
          filters: { all: 'All', added: 'Added', removed: 'Removed', modified: 'Modified' },
          status: { modified: 'Modified', removed: 'Only in the master' },
          rowLabel: '{column} {value}',
          emptyValue: 'empty',
          pending:
            'No pending changes in {table} | 1 pending change in {table} | {count} pending changes in {table}',
        },
      },
    },
  },
})

const columns: DataColumn[] = [
  { key: 'code', title: 'Code', type: 'text' },
  { key: 'name', title: 'Name', type: 'text' },
  { key: 'family', title: 'Family', type: 'text' },
  { key: 'weight', title: 'Weight', unit: 'kg', type: 'number', decimals: 2 },
  { key: 'active', title: 'Active', type: 'boolean' },
  { key: 'since', title: 'Since', type: 'date' },
]

const row = (code: string, weight: number, extra: Record<string, unknown> = {}) => ({
  code,
  name: `Product ${code}`,
  family: 'Drinks',
  weight,
  active: true,
  since: '2026-01-10',
  ...extra,
})

const lines: ComparisonLine[] = [
  { key: 'P-1', status: 'identical', loaded: row('P-1', 1), master: row('P-1', 1), changedKeys: [] },
  {
    key: 'P-2',
    status: 'modified',
    loaded: row('P-2', 0.89),
    master: row('P-2', 0.75),
    changedKeys: ['weight'],
  },
  { key: 'P-3', status: 'removed', master: row('P-3', 2), changedKeys: [] },
  { key: 'P-4', status: 'added', loaded: row('P-4', 3), changedKeys: [] },
  {
    key: 'P-5',
    status: 'pendingDelete',
    loaded: row('P-5', 4),
    master: row('P-5', 4),
    changedKeys: [],
  },
]

const mountDialog = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(DataComparisonDialog, {
    props: {
      open: true,
      tableTitle: 'Products',
      columns,
      lines,
      loadedCount: 4,
      masterCount: 4,
      allowRestore: true,
      allowDelete: true,
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const byTestId = (id: string) => document.body.querySelector(`[data-testid="${id}"]`)
const all = (selector: string) => Array.from(document.body.querySelectorAll<HTMLElement>(selector))
const radio = (label: string) =>
  all('[role="radio"]').find((el) => el.textContent?.includes(label)) as HTMLElement

describe('DataComparisonDialog', () => {
  test('summarises the rows by kind, counting a pending delete as removed', async () => {
    await mountDialog()

    expect(byTestId('comparison-card-added')?.textContent).toContain('1')
    expect(byTestId('comparison-card-removed')?.textContent).toContain('2')
    expect(byTestId('comparison-card-modified')?.textContent).toContain('1')
    expect(byTestId('comparison-card-identical')?.textContent).toContain('1')
  })

  test('a card opens the changes it counts', async () => {
    await mountDialog()

    ;(byTestId('comparison-card-removed') as HTMLElement).click()
    await flushPromises()

    const cards = all('[data-testid^="comparison-change-"]').map((el) => el.dataset.testid)
    expect(cards).toEqual(['comparison-change-P-3', 'comparison-change-P-5'])
  })

  test('side by side aligns both rows on one line and tints what differs', async () => {
    await mountDialog()
    radio('Side by side').click()
    await flushPromises()

    const line = byTestId('comparison-line-P-2') as HTMLElement
    const changed = Array.from(line.querySelectorAll('.is-changed')).map((el) => el.textContent?.trim())
    expect(changed).toEqual(['0.89', '0.75'])
    expect(byTestId('comparison-line-P-3')?.querySelectorAll('.is-missing').length).toBeGreaterThan(0)
  })

  test('side by side shows at most four columns, the differing ones first', async () => {
    await mountDialog()
    radio('Side by side').click()
    await flushPromises()

    const heads = all('.data-comparison__head-cell')
      .map((el) => el.textContent?.trim())
      .filter((text) => text !== 'dataTable.comparison.side.status')
    expect(heads.slice(0, 4)).toEqual(['Code', 'Weight (kg)', 'Name', 'Family'])
  })

  test('removes a loaded row and restores a master one, only where it applies', async () => {
    const wrapper = await mountDialog()
    radio('Side by side').click()
    await flushPromises()

    const deletes = (key: string) => byTestId(`comparison-line-${key}`)?.querySelector('[data-testid="comparison-delete"]')
    const restores = (key: string) => byTestId(`comparison-line-${key}`)?.querySelector('[data-testid="comparison-restore"]')

    expect(deletes('P-3')).toBeNull()
    expect(deletes('P-5')).toBeNull()
    expect(restores('P-1')).toBeNull()
    expect(restores('P-4')).toBeNull()

    ;(deletes('P-4') as HTMLElement).click()
    ;(restores('P-5') as HTMLElement).click()
    expect(wrapper.emitted('delete')?.[0][0]).toMatchObject({ key: 'P-4' })
    expect(wrapper.emitted('restore')?.[0][0]).toMatchObject({ key: 'P-5' })
  })

  test('a modified field reads master value → loaded value, and the others are dimmed', async () => {
    await mountDialog()
    radio('Changes').click()
    await flushPromises()

    const card = byTestId('comparison-change-P-2') as HTMLElement
    expect(card.querySelector('.data-comparison__change-label')?.textContent).toBe('Code P-2')
    const changed = card.querySelector('.data-comparison__field.is-changed') as HTMLElement
    expect(changed.querySelector('s')?.textContent).toBe('0.75')
    expect(changed.querySelector('.data-comparison__new')?.textContent).toBe('0.89')
    expect(card.querySelectorAll('.data-comparison__field.is-muted').length).toBe(4)
    expect(card.textContent).toContain('Yes')
  })

  test('the footer says how many changes of the table are pending', async () => {
    await mountDialog({ pendingCount: 2 })
    expect(document.body.textContent).toContain('2 pending changes in Products')
  })
})
