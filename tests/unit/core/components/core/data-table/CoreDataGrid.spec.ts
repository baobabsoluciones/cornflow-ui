import { describe, expect, test, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import CoreDataGrid from '@cornflow-ui/core/components/core/data-table/CoreDataGrid.vue'
import type { DataColumn, DataRow } from '@cornflow-ui/core/components/core/data-table/types'
import { createEnI18n } from './i18nEn'

const columns: DataColumn[] = [
  { key: 'line', title: 'Line', type: 'text', required: true },
  { key: 'capacity', title: 'Capacity', unit: 'units/week', type: 'number', required: true },
  { key: 'description', title: 'Description', type: 'text' },
  { key: 'plant', title: 'Plant', type: 'reference' },
  { key: 'pinned', title: 'Pin', type: 'switch' },
]

const rows: DataRow[] = [
  { id: 1, line: 'L1', capacity: 1200, description: 'Main line', plant: 'North', pinned: false },
  { id: 2, line: 'L2', capacity: 1579, description: null, plant: 'South', pinned: true },
  { id: 3, line: 'L3', capacity: 1958, description: 'Small', plant: 'North', pinned: false },
]

function mountGrid(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(CoreDataGrid, {
    props: { columns, rows, editable: true, cellValue: (row: DataRow, k: string) => row[k], ...props },
    slots,
    global: { plugins: [createEnI18n()] },
    attachTo: document.body,
  })
}

const cell = (wrapper: VueWrapper, rowId: number, key: string) =>
  wrapper.find(`tr[data-row-id="${rowId}"] td[data-column="${key}"]`)
const grid = (wrapper: VueWrapper) => wrapper.find('[data-testid="data-grid"]')

async function pick(wrapper: VueWrapper, rowId: number, key: string) {
  await cell(wrapper, rowId, key).trigger('pointerdown')
}

async function key(wrapper: VueWrapper, name: string, options: Record<string, unknown> = {}) {
  await grid(wrapper).trigger('keydown', { key: name, ...options })
  await flushPromises()
}

describe('CoreDataGrid', () => {
  test('heads each column with its type icon, title and unit', () => {
    const wrapper = mountGrid()
    const header = wrapper.findAll('th.data-grid__header')[1]
    expect(header.text()).toContain('Capacity')
    expect(header.text()).toContain('(units/week)')
    expect(header.find('.mdi-numeric').exists()).toBe(true)
  })

  test('the sort button cycles ascending, descending and no order', async () => {
    const wrapper = mountGrid()
    const button = wrapper.find('[data-testid="data-grid-sort-capacity"]')
    await button.trigger('click')
    expect(wrapper.emitted('update:sort')?.at(-1)).toEqual([{ key: 'capacity', direction: 'asc' }])
    await wrapper.setProps({ sort: { key: 'capacity', direction: 'asc' } })
    await button.trigger('click')
    expect(wrapper.emitted('update:sort')?.at(-1)).toEqual([{ key: 'capacity', direction: 'desc' }])
    await wrapper.setProps({ sort: { key: 'capacity', direction: 'desc' } })
    await button.trigger('click')
    expect(wrapper.emitted('update:sort')?.at(-1)).toEqual([null])
  })

  test('shows the values formatted, and a dash for an empty one', () => {
    const wrapper = mountGrid()
    expect(cell(wrapper, 1, 'capacity').text()).toBe('1,200')
    expect(cell(wrapper, 2, 'description').text()).toBe('—')
  })

  test('marks new and deleted rows and the edited cells', () => {
    const wrapper = mountGrid({
      rowState: (row: DataRow) => ({ 1: 'new', 2: 'deleted' } as Record<number, 'new' | 'deleted'>)[row.id as number],
      cellModified: (row: DataRow, k: string) => row.id === 3 && k === 'capacity',
    })
    const first = wrapper.find('tr[data-row-id="1"]')
    expect(first.classes()).toContain('is-new')
    expect(first.find('.mdi-plus-circle-outline').exists()).toBe(true)
    const second = wrapper.find('tr[data-row-id="2"]')
    expect(second.classes()).toContain('is-deleted')
    expect(second.find('.mdi-delete-outline').exists()).toBe(true)
    expect(cell(wrapper, 3, 'capacity').classes()).toContain('is-modified')
  })

  test('the arrows move the active cell', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'line')
    expect(cell(wrapper, 1, 'line').classes()).toContain('is-active')
    await key(wrapper, 'ArrowDown')
    await key(wrapper, 'ArrowRight')
    expect(cell(wrapper, 2, 'capacity').classes()).toContain('is-active')
    await key(wrapper, 'ArrowUp')
    expect(cell(wrapper, 1, 'capacity').classes()).toContain('is-active')
  })

  test('typing a digit edits a number cell; Enter commits the parsed number', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 2, 'capacity')
    await key(wrapper, '7')
    const input = cell(wrapper, 2, 'capacity').find('input')
    expect(input.element.value).toBe('7')
    await input.setValue('1,650')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('cell-change')).toEqual([[rows[1], 'capacity', 1650]])
    expect(cell(wrapper, 3, 'capacity').classes()).toContain('is-active')
  })

  test('Enter edits the active cell with its value; Escape cancels without a change', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'description')
    await key(wrapper, 'Enter')
    const input = cell(wrapper, 1, 'description').find('input')
    expect(input.element.value).toBe('Main line')
    await input.setValue('Other')
    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cell-change')).toBeUndefined()
    expect(cell(wrapper, 1, 'description').find('input').exists()).toBe(false)
  })

  test('an invalid number keeps the cell in edit mode, marked', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'capacity')
    await key(wrapper, 'Enter')
    const input = cell(wrapper, 1, 'capacity').find('input')
    await input.setValue('abc')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('cell-change')).toBeUndefined()
    expect(cell(wrapper, 1, 'capacity').classes()).toContain('is-invalid')
    expect(cell(wrapper, 1, 'capacity').find('input').exists()).toBe(true)
  })

  test('a deleted row cannot be edited', async () => {
    const wrapper = mountGrid({ rowState: (row: DataRow) => (row.id === 1 ? 'deleted' : undefined) })
    await pick(wrapper, 1, 'description')
    await key(wrapper, 'Enter')
    expect(cell(wrapper, 1, 'description').find('input').exists()).toBe(false)
  })

  test('a switch toggles with a click and emits the change', async () => {
    const wrapper = mountGrid()
    await cell(wrapper, 2, 'pinned').find('[role="switch"]').trigger('click')
    expect(wrapper.emitted('cell-change')).toEqual([[rows[1], 'pinned', false]])
  })

  test('editing a reference asks for its options', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'plant')
    await key(wrapper, 'Enter')
    expect(wrapper.emitted('need-options')?.[0]?.[0]).toMatchObject({ key: 'plant' })
  })

  test('selects rows, and all of them from the header', async () => {
    const wrapper = mountGrid({ selectable: true, selected: [] })
    await wrapper.find('tr[data-row-id="2"] [role="checkbox"]').trigger('click')
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([[2]])
    await wrapper.setProps({ selected: [2] })
    const all = wrapper.find('[data-testid="data-grid-select-all"]')
    expect(all.attributes('aria-checked')).toBe('mixed')
    await all.trigger('click')
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([[2, 1, 3]])
  })

  test('the row being added checks the required fields and emits the parsed values', async () => {
    const wrapper = mountGrid({ adding: true })
    await flushPromises()
    const vm = wrapper.vm as unknown as { commitAdd: () => void }
    vm.commitAdd()
    await flushPromises()
    expect(wrapper.emitted('add')).toBeUndefined()
    const inputs = wrapper.findAll('[data-testid="data-grid-add-row"] input')
    await inputs[0].setValue('L9')
    await inputs[1].setValue('2,500')
    vm.commitAdd()
    expect(wrapper.emitted('add')?.[0]?.[0]).toMatchObject({ line: 'L9', capacity: 2500, pinned: false })
  })

  test('shows the message slot when there are no rows', () => {
    const wrapper = mountGrid({ rows: [] }, { message: '<p class="nothing">Nothing here</p>' })
    expect(wrapper.find('.nothing').exists()).toBe(true)
  })

  test('the columns grow in proportion to fill the card; a resized one keeps its width', async () => {
    const wrapper = mountGrid({ columns: columns.slice(0, 2) })
    expect(gridColumns(wrapper)).toBe('24px minmax(200px, 200fr) minmax(214px, 214fr)')
    await wrapper.setProps({ widths: { line: 150 } })
    expect(gridColumns(wrapper)).toBe('24px 150px minmax(214px, 214fr)')
    await wrapper.setProps({ widths: { line: 150, capacity: 180 } })
    expect(gridColumns(wrapper)).toBe('24px 150px minmax(180px, 1fr)')
  })

  test('resizing a column keeps the widths at its left and follows the pointer', async () => {
    const wrapper = mountGrid({ columns: columns.slice(0, 3) })
    wrapper.findAll('.data-grid__resize')[1].element.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: 100, bubbles: true, cancelable: true }),
    )
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 140 }))
    window.dispatchEvent(new MouseEvent('pointerup'))
    expect(wrapper.emitted('update:widths')?.at(-1)).toEqual([{ line: 200, capacity: 254 }])
  })
})

const gridColumns = (wrapper: VueWrapper) =>
  (wrapper.find('.data-grid').element as HTMLElement).style.getPropertyValue('--grid-columns')

describe('CoreDataGrid from the keyboard', () => {
  const active = (wrapper: VueWrapper) => {
    const td = wrapper.find('td.is-active')
    if (!td.exists()) return null
    return `${td.element.closest('tr')!.getAttribute('data-row-id')}:${td.attributes('data-column')}`
  }

  test('the active cell is the active descendant of the grid, for assistive technology', async () => {
    const wrapper = mountGrid()
    expect(grid(wrapper).attributes('aria-activedescendant')).toBeUndefined()

    await pick(wrapper, 2, 'capacity')
    const id = grid(wrapper).attributes('aria-activedescendant')
    const activeCell = cell(wrapper, 2, 'capacity')
    expect(id).toBeTruthy()
    expect(activeCell.attributes('id')).toBe(id)
    expect(activeCell.attributes('aria-selected')).toBe('true')

    await key(wrapper, 'Escape')
    expect(grid(wrapper).attributes('aria-activedescendant')).toBeUndefined()
  })

  test('the first arrow picks the first cell, and without rows there is nothing to pick', async () => {
    const wrapper = mountGrid()
    await key(wrapper, 'ArrowDown')
    expect(active(wrapper)).toBe('1:line')

    const empty = mountGrid({ rows: [] })
    await key(empty, 'ArrowDown')
    expect(active(empty)).toBeNull()
  })

  test('other keys do nothing until a cell is picked', async () => {
    const wrapper = mountGrid()
    await key(wrapper, 'Enter')
    await key(wrapper, 'x')
    expect(active(wrapper)).toBeNull()
    expect(wrapper.find('td input').exists()).toBe(false)
  })

  test('Tab and Shift+Tab move along the row', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 2, 'line')
    await key(wrapper, 'Tab')
    await key(wrapper, 'Tab')
    expect(active(wrapper)).toBe('2:description')
    await key(wrapper, 'Tab', { shiftKey: true })
    expect(active(wrapper)).toBe('2:capacity')
  })

  test('the moves stop at the edges of the table', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'line')
    await key(wrapper, 'ArrowUp')
    await key(wrapper, 'ArrowLeft')
    expect(active(wrapper)).toBe('1:line')

    await pick(wrapper, 3, 'pinned')
    await key(wrapper, 'ArrowDown')
    await key(wrapper, 'Tab')
    expect(active(wrapper)).toBe('3:pinned')
  })

  test('F2 edits the cell as Enter does', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 3, 'description')
    await key(wrapper, 'F2')
    expect(cell(wrapper, 3, 'description').find('input').element.value).toBe('Small')
  })

  test('typing a letter replaces a text cell with it', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'description')
    await key(wrapper, 'B')
    expect(cell(wrapper, 1, 'description').find('input').element.value).toBe('B')
  })

  test('a key with Ctrl, Cmd or Alt is not typing', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'description')
    await key(wrapper, 'c', { ctrlKey: true })
    await key(wrapper, 'v', { metaKey: true })
    await key(wrapper, 'x', { altKey: true })
    expect(cell(wrapper, 1, 'description').find('input').exists()).toBe(false)
  })

  test('Escape lets go of the active cell', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'line')
    await key(wrapper, 'Escape')
    expect(active(wrapper)).toBeNull()
  })

  test('Space toggles a switch cell', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'pinned')
    await key(wrapper, ' ')
    expect(wrapper.emitted('cell-change')).toEqual([[rows[0], 'pinned', true]])
  })

  test('Delete and Backspace empty an optional cell', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'description')
    await key(wrapper, 'Delete')
    await pick(wrapper, 3, 'description')
    await key(wrapper, 'Backspace')
    expect(wrapper.emitted('cell-change')).toEqual([
      [rows[0], 'description', null],
      [rows[2], 'description', null],
    ])
  })

  test('a required cell cannot be emptied, and the grid says why', async () => {
    const snackbar = vi.fn()
    const wrapper = mount(CoreDataGrid, {
      props: { columns, rows, editable: true, cellValue: (row: DataRow, k: string) => row[k] },
      global: { plugins: [createEnI18n()], provide: { showSnackbar: snackbar } },
      attachTo: document.body,
    })
    await pick(wrapper, 1, 'line')
    await key(wrapper, 'Delete')
    expect(wrapper.emitted('cell-change')).toBeUndefined()
    expect(snackbar).toHaveBeenCalledWith('“Line” is required: it can’t be left empty.', 'info')
  })

  test('a deleted row says how to edit it again', async () => {
    const snackbar = vi.fn()
    const wrapper = mount(CoreDataGrid, {
      props: {
        columns,
        rows,
        editable: true,
        cellValue: (row: DataRow, k: string) => row[k],
        rowState: (row: DataRow) => (row.id === 2 ? 'deleted' : undefined),
      },
      global: { plugins: [createEnI18n()], provide: { showSnackbar: snackbar } },
      attachTo: document.body,
    })
    await pick(wrapper, 2, 'description')
    await key(wrapper, 'F2')
    expect(snackbar).toHaveBeenCalledWith('Row marked to be deleted. Restore it to edit it.', 'info')
  })

  test('while a cell is edited the keys are the editor’s, not the grid’s', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 1, 'description')
    await key(wrapper, 'Enter')
    await key(wrapper, 'ArrowDown')
    expect(active(wrapper)).toBe('1:description')
    expect(cell(wrapper, 1, 'description').find('input').exists()).toBe(true)
  })

  test('a read-only grid moves but does not edit', async () => {
    const wrapper = mountGrid({ editable: false })
    await pick(wrapper, 1, 'description')
    await key(wrapper, 'ArrowRight')
    await key(wrapper, 'Enter')
    await key(wrapper, 'Delete')
    expect(active(wrapper)).toBe('1:plant')
    expect(wrapper.find('td input').exists()).toBe(false)
    expect(wrapper.emitted('cell-change')).toBeUndefined()
  })

  test('the active cell goes when its row does', async () => {
    const wrapper = mountGrid()
    await pick(wrapper, 2, 'line')
    await wrapper.setProps({ rows: [rows[0], rows[2]] })
    expect(active(wrapper)).toBeNull()
  })

  test('"go to" picks the cell it is given', async () => {
    const wrapper = mountGrid()
    ;(wrapper.vm as any).focusCell(3, 'plant')
    await flushPromises()
    expect(active(wrapper)).toBe('3:plant')
  })
})
