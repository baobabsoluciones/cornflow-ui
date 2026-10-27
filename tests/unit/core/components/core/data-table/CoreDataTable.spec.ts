import { describe, expect, test } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CoreDataTable from '@cornflow-ui/core/components/core/data-table/CoreDataTable.vue'
import type { DataColumn, DataFilter, DataRow } from '@cornflow-ui/core/components/core/data-table/types'
import { createEnI18n } from './i18nEn'

const columns: DataColumn[] = [
  { key: 'line', title: 'Line', type: 'text', required: true },
  { key: 'capacity', title: 'Capacity', type: 'number' },
  { key: 'active', title: 'Active', type: 'boolean' },
]

const rows: DataRow[] = [
  { id: 1, line: 'L1', capacity: 1200, active: true },
  { id: 2, line: 'L2', capacity: 1579, active: false },
]

const activeFilter: DataFilter = { id: 'f1', field: 'active', operator: 'is', value: 'true', values: [] }

function mountTable(props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return mount(CoreDataTable, {
    props: { title: 'Lines', columns, rows, ...props },
    global: { plugins: [createEnI18n()] },
    attachTo: host,
  })
}


/** The last element of the page with that text: the one in the overlay opened last. */
const bodyButton = (text: string) =>
  [...document.body.querySelectorAll<HTMLElement>('button, [role="menuitem"], [role="option"]')]
    .filter((element) => element.textContent?.trim() === text)
    .at(-1)

describe('CoreDataTable', () => {
  test('counts the rows, and the ones the filters leave', async () => {
    const wrapper = mountTable({ totalCount: 48 })
    expect(wrapper.find('[data-testid="data-table-count"]').text()).toBe('48 rows')
    await wrapper.setProps({ filters: [activeFilter], filteredCount: 39 })
    expect(wrapper.find('[data-testid="data-table-count"]').text()).toBe('39 of 48 rows')
  })

  test('"Clear filters" empties the filters and the search', async () => {
    const wrapper = mountTable({ filters: [activeFilter], search: 'L1' })
    await wrapper.find('.data-table__link').trigger('click')
    expect(wrapper.emitted('update:filters')?.at(-1)).toEqual([[]])
    expect(wrapper.emitted('update:search')?.at(-1)).toEqual([''])
  })

  test('says when the table is empty', () => {
    const wrapper = mountTable({ rows: [], totalCount: 0 })
    expect(wrapper.text()).toContain('No data available for this table')
  })

  test('says when the search finds nothing, and clears it', async () => {
    const wrapper = mountTable({ rows: [], totalCount: 2, search: 'East' })
    expect(wrapper.text()).toContain('No row contains «East»')
    await wrapper.find('.core-empty-state__action').trigger('click')
    expect(wrapper.emitted('update:search')?.at(-1)).toEqual([''])
  })

  test('says when the filters leave no row, and clears them', async () => {
    const wrapper = mountTable({ rows: [], totalCount: 2, filters: [activeFilter] })
    expect(wrapper.text()).toContain('No row matches the filters')
    await wrapper.find('.core-empty-state__action').trigger('click')
    expect(wrapper.emitted('update:filters')?.at(-1)).toEqual([[]])
  })

  test('an error offers to retry', async () => {
    const wrapper = mountTable({ status: 'error' })
    expect(wrapper.text()).toContain('The data could not be loaded')
    await wrapper.find('.core-empty-state__action').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  test('"Add row" shows the row to fill in, with what is required', async () => {
    const wrapper = mountTable({ canAdd: true, editable: true })
    await wrapper.find('[data-testid="data-table-add-row"]').trigger('click')
    expect(wrapper.find('.data-table__adding').text()).toContain('Line is required')
    expect(wrapper.find('[data-testid="data-grid-add-row"]').exists()).toBe(true)
  })

  test('selected rows show the selection bar', () => {
    const wrapper = mountTable({ selectable: true, selected: [1], canBulkEdit: true, canDelete: true })
    const bar = wrapper.find('.data-table__selection')
    expect(bar.text()).toContain('1 selected')
    expect(bar.find('[data-testid="data-table-bulk-edit"]').exists()).toBe(true)
  })

  test('with pending changes, deleting marks the rows at once', async () => {
    const wrapper = mountTable({ selectable: true, selected: [1, 2], canDelete: true, stagesChanges: true })
    await wrapper.find('[data-testid="data-table-delete"]').trigger('click')
    expect(wrapper.emitted('delete-rows')).toEqual([[[1, 2]]])
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([[]])
  })

  test('without pending changes, deleting asks first', async () => {
    const wrapper = mountTable({ selectable: true, selected: [2], canDelete: true, stagesChanges: false })
    await wrapper.find('[data-testid="data-table-delete"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('delete-rows')).toBeUndefined()
    expect(document.body.textContent).toContain('Delete 1 item?')
    bodyButton('Delete')?.click()
    await flushPromises()
    expect(wrapper.emitted('delete-rows')).toEqual([[[2]]])
  })

  test('rows all marked deleted are restored instead', async () => {
    const wrapper = mountTable({
      selectable: true,
      selected: [1],
      canDelete: true,
      rowState: (row: DataRow) => (row.id === 1 ? 'deleted' : undefined),
    })
    const button = wrapper.find('[data-testid="data-table-delete"]')
    expect(button.text()).toBe('Restore')
    await button.trigger('click')
    expect(wrapper.emitted('restore-rows')).toEqual([[[1]]])
  })

  test('the footer shows the pending changes, to review or discard', async () => {
    const wrapper = mountTable({ pendingCount: 3, pendingTables: 2 })
    expect(wrapper.find('.data-table__footer').text()).toContain('3 pending changes in 2 tables')
    await wrapper.find('[data-testid="data-table-review"]').trigger('click')
    expect(wrapper.emitted('review')).toHaveLength(1)
    const discard = wrapper.findAll('.data-table__link').find((link) => link.text() === 'Discard')
    await discard?.trigger('click')
    expect(wrapper.emitted('discard')).toHaveLength(1)
  })

  test('the screen\'s own actions are in the more-actions menu', async () => {
    const wrapper = mountTable({ actions: [{ key: 'relaunch', label: 'Create an execution' }] })
    await wrapper.find('[data-testid="data-table-actions"]').trigger('click')
    await flushPromises()
    bodyButton('Create an execution')?.click()
    await flushPromises()
    expect(wrapper.emitted('action')).toEqual([['relaunch']])
  })

  test('adding a filter appends an empty one on that column', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="data-table-add-filter"]').trigger('click')
    await flushPromises()
    bodyButton('Capacity')?.click()
    await flushPromises()
    const filters = wrapper.emitted('update:filters')?.at(-1)?.[0] as DataFilter[]
    expect(filters).toHaveLength(1)
    expect(filters[0]).toMatchObject({ field: 'capacity', operator: 'is_between', value: '' })
  })
})
