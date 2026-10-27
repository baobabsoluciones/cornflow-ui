import { describe, expect, test } from 'vitest'
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
})
