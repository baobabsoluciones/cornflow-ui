import { describe, expect, test } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ConditionFilterChip from '@cornflow-ui/core/components/core/filters/ConditionFilterChip.vue'
import type { DataColumn, DataFilter } from '@cornflow-ui/core/components/core/data-table/types'
import { createEnI18n } from '../data-table/i18nEn'

const filterOf = (field: string, extra: Partial<DataFilter> = {}): DataFilter => ({
  id: 'f1',
  field,
  operator: 'is',
  value: '',
  value2: '',
  values: [],
  ...extra,
})

async function mountChip(props: { filter: DataFilter; column: DataColumn } & Record<string, unknown>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const wrapper = mount(ConditionFilterChip, {
    props,
    global: { plugins: [createEnI18n()] },
    attachTo: host,
  })
  await flushPromises()
  return wrapper
}

async function open(wrapper: Awaited<ReturnType<typeof mountChip>>) {
  await wrapper.find('.filter-chip__main').trigger('click')
  await flushPromises()
}

const panel = () => document.body.querySelector<HTMLElement>('.condition-filter')!
const inPanel = <T extends HTMLElement>(selector: string) => panel().querySelector<T>(selector)!
const applyButton = () => inPanel<HTMLButtonElement>('[data-testid="condition-filter-apply"]')
const buttonByText = (text: string) =>
  [...panel().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === text)!

async function type(element: HTMLInputElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('ConditionFilterChip', () => {
  test('shows the column and the value of the filter', async () => {
    const wrapper = await mountChip({
      filter: filterOf('capacity', { operator: 'is_between', value: '10', value2: '50' }),
      column: { key: 'capacity', title: 'Capacity', type: 'number' },
    })
    expect(wrapper.text()).toContain('Capacity:')
    expect(wrapper.text()).toContain('10 – 50')
  })

  test('a text filter offers the operators and a value; some operators need none', async () => {
    const wrapper = await mountChip({
      filter: filterOf('name', { operator: 'contains', value: 'nor' }),
      column: { key: 'name', title: 'Name', type: 'text' },
    })
    await open(wrapper)
    const operators = [...inPanel<HTMLSelectElement>('select').options].map((o) => o.textContent?.trim())
    expect(operators).toEqual(['contains', 'is', 'is not', 'starts with', 'is empty', 'has any value'])
    const value = inPanel<HTMLInputElement>('[data-testid="condition-filter-value"]')
    expect(value.value).toBe('nor')
    await type(value, 'north')
    applyButton().click()
    await flushPromises()
    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({ operator: 'contains', value: 'north' })
  })

  test('a number filter takes a range and says when it is wrong', async () => {
    const wrapper = await mountChip({
      filter: filterOf('capacity', { operator: 'is_between' }),
      column: { key: 'capacity', title: 'Capacity', type: 'number' },
    })
    await open(wrapper)
    expect(applyButton().disabled).toBe(true)
    await type(inPanel<HTMLInputElement>('[data-testid="condition-filter-from"]'), '50')
    await type(inPanel<HTMLInputElement>('[data-testid="condition-filter-to"]'), '10')
    expect(panel().textContent).toContain('can’t be greater than')
    expect(applyButton().disabled).toBe(true)
    await type(inPanel<HTMLInputElement>('[data-testid="condition-filter-to"]'), '100')
    expect(applyButton().disabled).toBe(false)
    applyButton().click()
    await flushPromises()
    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({ operator: 'is_between', value: '50', value2: '100' })
  })

  test('a date filter asks for its first and last day', async () => {
    const wrapper = await mountChip({
      filter: filterOf('since', { operator: 'is_between' }),
      column: { key: 'since', title: 'Start date', type: 'date' },
    })
    await open(wrapper)
    expect(inPanel<HTMLInputElement>('[data-testid="condition-filter-from"]').type).toBe('date')
    expect(inPanel<HTMLInputElement>('[data-testid="condition-filter-to"]').type).toBe('date')
  })

  test('a list filter picks several values, with how many rows have each', async () => {
    const wrapper = await mountChip({
      filter: filterOf('kind', { operator: 'is_any_of' }),
      column: { key: 'kind', title: 'Type', type: 'list' },
      choices: [
        { value: 'packing', label: 'Packing', count: 12 },
        { value: 'mixing', label: 'Mixing', count: 3 },
      ],
    })
    await open(wrapper)
    expect(panel().textContent).toContain('12')
    expect(applyButton().disabled).toBe(true)
    const boxes = panel().querySelectorAll<HTMLButtonElement>('[role="checkbox"]')
    boxes[0].click()
    await flushPromises()
    boxes[1].click()
    await flushPromises()
    applyButton().click()
    await flushPromises()
    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({ operator: 'is_any_of', values: ['packing', 'mixing'] })
  })

  test('a yes/no filter picks one of the two', async () => {
    const wrapper = await mountChip({
      filter: filterOf('active'),
      column: { key: 'active', title: 'Active', type: 'boolean' },
      booleanCounts: { yes: 40, no: 8 },
    })
    await open(wrapper)
    expect(panel().textContent).toContain('40')
    const no = [...panel().querySelectorAll<HTMLButtonElement>('[role="checkbox"]')].find((b) =>
      b.textContent?.includes('No'),
    )!
    no.click()
    await flushPromises()
    applyButton().click()
    await flushPromises()
    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({ operator: 'is', value: 'false' })
  })

  test('"Remove" removes the filter', async () => {
    const wrapper = await mountChip({
      filter: filterOf('name', { operator: 'contains', value: 'x' }),
      column: { key: 'name', title: 'Name', type: 'text' },
    })
    await open(wrapper)
    buttonByText('Remove').click()
    await flushPromises()
    expect(wrapper.emitted('remove')?.[0]).toEqual(['f1'])
  })

  test('a new filter opens by itself, and closing it without applying removes it', async () => {
    const wrapper = await mountChip({
      filter: filterOf('name', { operator: 'contains' }),
      column: { key: 'name', title: 'Name', type: 'text' },
      isNew: true,
    })
    await flushPromises()
    expect(panel()).not.toBeNull()
    await wrapper.find('.filter-chip__main').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('remove')?.[0]).toEqual(['f1'])
  })
})
