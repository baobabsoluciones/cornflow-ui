import { afterEach, describe, expect, test } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PendingChangesPanel from '@cornflow-ui/core/components/core/data-table/PendingChangesPanel.vue'
import type { PendingChangeGroup } from '@cornflow-ui/core/components/core/data-table/PendingChangesPanel.vue'
import type { DataColumn } from '@cornflow-ui/core/components/core/data-table/types'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      common: { close: 'Close' },
      table: { yes: 'Yes', no: 'No' },
      dataTable: {
        errors: { required: 'Required', number: 'Enter a valid number' },
        pending: {
          title: 'Pending changes',
          changes: '{n} change | {n} change | {n} changes',
          tables: '{n} table | {n} table | {n} tables',
          rowsAffected: '{n} row affected | {n} row affected | {n} rows affected',
          expand: 'Open large',
          closeBanner: 'Close message',
          validationTitle: 'The data does not match the schema',
          empty: 'No pending changes',
          emptyText: 'What you edit shows here.',
          emptyTextDialog: 'What you edit shows here.',
          nothingToSave: 'Nothing to save.',
          dialogSubtitle: '{summary}.',
          revertTable: 'Revert table',
          revertTableTitle: 'Revert every change of this table',
          goToRow: 'Go to the row',
          goToCell: 'Go to the cell',
          revert: 'Revert',
          remove: 'Remove',
          restore: 'Restore',
          revertField: 'Revert this field',
          kind: { modified: 'Modified', new: 'New', deleted: 'Deleted' },
          rowKind: { modified: 'Modified row', new: 'New row', deleted: 'Deleted row' },
          count: {
            modified: '{n} modified | {n} modified | {n} modified',
            new: '{n} new | {n} new | {n} new',
            deleted: '{n} deleted | {n} deleted | {n} deleted',
          },
          emptyValue: 'empty',
          noMoreData: 'No more data',
          processing: 'Processing the changes…',
          revertAll: 'Revert all',
          revertAllChanges: 'Revert all changes',
          confirmRevertAll: 'Revert the change? | Revert the change? | Revert the {n} changes?',
          revertAllConfirm: 'Revert all',
          no: 'No',
          cancel: 'Cancel',
          choose: 'Choose…',
          emptyOption: '— empty —',
          overwriteTitle: 'Confirm overwrite',
          overwriteIntro: 'Some data depends on this:',
          overwriteNote: 'The changes stay pending if you cancel.',
          overwriteConfirm: 'Overwrite anyway',
        },
      },
    },
  },
})

const columns: DataColumn[] = [
  { key: 'line', title: 'Line', type: 'text', required: true },
  { key: 'plant', title: 'Plant', type: 'list', options: [{ value: 'North', label: 'North' }, { value: 'South', label: 'South' }] },
  { key: 'capacity', title: 'Capacity', type: 'number', unit: 'u/wk' },
  { key: 'pinned', title: 'Pinned', type: 'switch' },
]

const groups: PendingChangeGroup[] = [
  {
    tableKey: 'lines',
    title: 'Lines',
    columns,
    items: [
      {
        tableKey: 'lines',
        rowId: 'r2',
        kind: 'modified',
        label: 'Line L2',
        row: { line: 'L2', plant: 'North', capacity: 1650, pinned: false },
        original: { line: 'L2', plant: 'North', capacity: 1579, pinned: false },
        changedKeys: ['capacity'],
      },
      {
        tableKey: 'lines',
        rowId: 'new-1',
        kind: 'new',
        label: 'Line L9',
        row: { line: 'L9', plant: 'South', capacity: 300, pinned: true },
        changedKeys: [],
      },
    ],
  },
  {
    tableKey: 'products',
    title: 'Products',
    columns: [{ key: 'code', title: 'Code', type: 'text' }],
    items: [
      {
        tableKey: 'products',
        rowId: 'p1',
        kind: 'deleted',
        label: 'Code P-101',
        row: { code: 'P-101' },
        changedKeys: [],
      },
    ],
  },
]

const mounted: Array<{ unmount: () => void }> = []

const mountPanel = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(PendingChangesPanel, {
    props: { open: true, groups, saveLabel: 'Save changes', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

const byTestId = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('PendingChangesPanel', () => {
  test('counts the changes and the tables, and lists each changed row with its kind', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('.pending-panel__subtitle').text()).toBe('3 changes · 2 tables')
    expect(wrapper.find('[data-testid="pending-group-lines"]').text()).toContain('2 rows affected')
    const edited = wrapper.find('[data-testid="pending-item-r2"]')
    expect(edited.text()).toContain('Modified')
    expect(edited.text()).toContain('Line L2')
    expect(edited.find('.pending-panel__old').text()).toBe('1,579')
    expect(edited.find('.pending-panel__new').text()).toBe('1,650')

    expect(wrapper.find('[data-testid="pending-item-new-1"] .pending-panel__summary').text()).toBe(
      'South · 300 · Yes',
    )
    const deleted = wrapper.find('[data-testid="pending-item-p1"]')
    expect(deleted.text()).toContain('Restore')
    expect(deleted.find('.pending-panel__item-label').classes()).toContain('is-deleted')
  })

  test('reverts a field, a row, a table, and everything after confirming', async () => {
    const wrapper = mountPanel()

    await wrapper.find('[data-testid="pending-revert-field-r2-capacity"]').trigger('click')
    await wrapper.find('[data-testid="pending-revert-row-new-1"]').trigger('click')
    await wrapper.find('[data-testid="pending-revert-table-products"]').trigger('click')
    expect(wrapper.emitted('revert-field')).toEqual([['lines', 'r2', 'capacity']])
    expect(wrapper.emitted('revert-row')).toEqual([['lines', 'new-1', 'new']])
    expect(wrapper.emitted('revert-table')).toEqual([['products']])

    await wrapper.find('[data-testid="pending-revert-all"]').trigger('click')
    expect(wrapper.text()).toContain('Revert the 3 changes?')
    expect(wrapper.emitted('revert-all')).toBeUndefined()
    await wrapper.find('[data-testid="pending-revert-all-confirm"]').trigger('click')
    expect(wrapper.emitted('revert-all')).toHaveLength(1)
  })

  test('takes the user to a row or a field, saves, and closes', async () => {
    const wrapper = mountPanel()

    await wrapper.find('[data-testid="pending-item-r2"] .pending-panel__field-go').trigger('click')
    await wrapper.find('[data-testid="pending-item-p1"] .pending-panel__item-go').trigger('click')
    expect(wrapper.emitted('go-to')).toEqual([
      ['lines', 'r2', 'capacity'],
      ['products', 'p1', 'code'],
    ])

    await wrapper.find('[data-testid="pending-save"]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    await wrapper.find('[data-testid="pending-close"]').trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  test('collapses a table', async () => {
    const wrapper = mountPanel()

    await wrapper.find('[data-testid="pending-group-lines"] .pending-panel__group-toggle').trigger('click')
    expect(wrapper.find('[data-testid="pending-item-r2"]').exists()).toBe(false)
  })

  test('while saving, the actions are locked and it says so', () => {
    const wrapper = mountPanel({ saving: true })

    expect(wrapper.text()).toContain('Processing the changes…')
    expect(wrapper.find('[data-testid="pending-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="pending-revert-all"]').attributes('disabled')).toBeDefined()
  })

  test('shows why the data does not match the schema, and closes it', async () => {
    const wrapper = mountPanel({ validationError: 'Row 12: too low.' })
    expect(wrapper.text()).toContain('The data does not match the schema')
    expect(wrapper.text()).toContain('Row 12: too low.')

    await wrapper.find('.pending-panel__banner-close').trigger('click')
    expect(wrapper.emitted('close-banner')).toHaveLength(1)
  })

  test('says so when there is nothing to review', () => {
    const wrapper = mountPanel({ groups: [] })

    expect(wrapper.text()).toContain('No pending changes')
    expect(wrapper.find('[data-testid="pending-save"]').exists()).toBe(false)
  })

  test('asks for a second confirmation when the server reports dependent data', async () => {
    const wrapper = mountPanel({ overwrite: { message: '3 products use those lines.' } })
    await flushPromises()

    expect(document.body.textContent).toContain('3 products use those lines.')
    byTestId('pending-overwrite-confirm')?.click()
    byTestId('pending-overwrite-cancel')?.click()
    expect(wrapper.emitted('confirm-overwrite')).toHaveLength(1)
    expect(wrapper.emitted('cancel-overwrite')).toHaveLength(1)
  })

  describe('expanded', () => {
    const expand = async () => {
      const wrapper = mountPanel()
      await wrapper.find('[data-testid="pending-expand"]').trigger('click')
      await flushPromises()
      return wrapper
    }

    test('shows each row as a small table, the edited cells with their old value', async () => {
      const wrapper = await expand()

      expect(wrapper.find('[data-testid="pending-changes-panel"]').exists()).toBe(false)
      const cell = byTestId('pending-cell-r2-capacity')!
      expect(cell.textContent).toContain('1,579')
      expect(cell.querySelector('input')?.value).toBe('1650')
      expect(byTestId('pending-cell-p1-code')?.querySelector('input')).toBeNull()
      expect(byTestId('pending-cell-p1-code')?.textContent).toContain('P-101')
    })

    test('a corrected value is parsed and emitted; an invalid one says why', async () => {
      const wrapper = await expand()
      const input = byTestId('pending-cell-r2-capacity')!.querySelector('input')!

      input.value = '1,700'
      input.dispatchEvent(new Event('change'))
      await flushPromises()
      expect(wrapper.emitted('update-field')).toEqual([['lines', 'r2', 'capacity', 1700]])

      input.value = 'abc'
      input.dispatchEvent(new Event('change'))
      await flushPromises()
      expect(byTestId('pending-cell-r2-capacity')?.textContent).toContain('Enter a valid number')
      expect(wrapper.emitted('update-field')).toHaveLength(1)
    })

    test('a list is picked and a switch toggled on a new row', async () => {
      const wrapper = await expand()

      const select = byTestId('pending-cell-new-1-plant')!.querySelector('select')!
      select.value = '0'
      select.dispatchEvent(new Event('change'))
      byTestId('pending-cell-new-1-pinned')!.querySelector<HTMLButtonElement>('[role="switch"]')!.click()
      await flushPromises()

      expect(wrapper.emitted('update-field')).toEqual([
        ['lines', 'new-1', 'plant', 'North'],
        ['lines', 'new-1', 'pinned', false],
      ])
    })

    test('saves from the dialog', async () => {
      const wrapper = await expand()

      byTestId('pending-dialog-save')!.click()
      expect(wrapper.emitted('save')).toHaveLength(1)
    })
  })
})
