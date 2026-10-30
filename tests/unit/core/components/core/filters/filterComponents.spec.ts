import { describe, test, expect } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import FilterChip from '@cornflow-ui/core/components/core/filters/FilterChip.vue'
import DateFilterChip from '@cornflow-ui/core/components/core/filters/DateFilterChip.vue'
import AddFilterMenu from '@cornflow-ui/core/components/core/filters/AddFilterMenu.vue'

// The menus open in a popover rendered at the end of the document (gone once the test unmounts).
const menu = () => document.body.querySelector<HTMLElement>('.core-menu')
const rows = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.core-menu__item'))
const rowLabels = () =>
  rows().map((row) =>
    row.querySelector('.core-menu__item-label')?.textContent?.trim(),
  )
const byTestId = (id: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)

const click = async (element: HTMLElement | null) => {
  element?.click()
  await flushPromises()
}

const plants = [
  { value: 1, title: 'North', count: 3 },
  { value: 2, title: 'South', count: 0 },
]

describe('FilterChip', () => {
  const mountChip = (props = {}) =>
    mount(FilterChip, {
      props: { label: 'Plant', options: plants, allLabel: 'All', ...props },
      attachTo: document.body,
    })

  const open = async (wrapper: ReturnType<typeof mountChip>) => {
    await wrapper.find('.filter-chip__main').trigger('click')
    await flushPromises()
  }

  test('shows the label and the picked option, or "All"', async () => {
    const wrapper = mountChip()
    expect(wrapper.find('.filter-chip__label').text()).toBe('Plant')
    expect(wrapper.find('.filter-chip__value').text()).toBe('All')
    expect(wrapper.find('.filter-chip').classes()).not.toContain('is-set')

    await wrapper.setProps({ value: '2' })

    expect(wrapper.find('.filter-chip__value').text()).toBe('South')
    expect(wrapper.find('.filter-chip').classes()).toContain('is-set')
  })

  test('lists "All" first and the options, marking the picked one', async () => {
    const wrapper = mountChip({ value: 1 })
    await open(wrapper)

    expect(menu()?.querySelector('.core-menu__title')?.textContent).toBe(
      'Plant',
    )
    expect(rowLabels()).toEqual(['All', 'North', 'South'])
    expect(rows()[1].getAttribute('aria-checked')).toBe('true')
    expect(rows()[0].getAttribute('aria-checked')).toBe('false')
    expect(document.body.querySelector('.core-menu__item-count')).toBeNull()
  })

  test('picking an option emits it and closes the menu', async () => {
    const wrapper = mountChip()
    await open(wrapper)

    await click(byTestId('filter-option-2'))

    expect(wrapper.emitted('pick')).toEqual([[2]])
    expect(menu()).toBeNull()
  })

  test('shows the counts when asked', async () => {
    const wrapper = mountChip({ showCounts: true })
    await open(wrapper)

    expect(
      Array.from(document.body.querySelectorAll('.core-menu__item-count')).map(
        (count) => count.textContent?.trim(),
      ),
    ).toEqual(['3', '0'])
  })

  test('a removable chip names its filter and has a cross instead of the chevron', async () => {
    const wrapper = mountChip({ removable: true, removeLabel: 'Remove filter' })

    expect(wrapper.find('.filter-chip__label').text()).toBe('Plant:')
    expect(wrapper.find('.filter-chip__chevron').exists()).toBe(false)
    const cross = wrapper.find('[data-testid="filter-chip-remove"]')
    expect(cross.attributes('aria-label')).toBe('Remove filter')

    await cross.trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(menu()).toBeNull()
  })

  test('picking the keep-open value leaves the menu open', async () => {
    const wrapper = mountChip({ keepOpenValue: 2 })
    await open(wrapper)

    await click(byTestId('filter-option-2'))

    expect(menu()).not.toBeNull()
  })

  test('opens by itself when asked to (a filter just added)', async () => {
    mountChip({ autoOpen: true })
    await flushPromises()

    expect(menu()).not.toBeNull()
  })
})

describe('DateFilterChip', () => {
  const presets = [
    { value: 'today', label: 'Today' },
    { value: 'lastMonth', label: 'Last 30 days' },
    { value: 'custom', label: 'Custom range' },
  ]

  const mountDate = (props = {}) =>
    mount(DateFilterChip, {
      props: {
        label: 'Date',
        modelValue: 'lastMonth',
        presets,
        fromLabel: 'From',
        toLabel: 'To',
        ...props,
      },
      attachTo: document.body,
    })

  const open = async (wrapper: ReturnType<typeof mountDate>) => {
    await wrapper.find('.filter-chip__main').trigger('click')
    await flushPromises()
  }

  test('shows the picked preset', () => {
    const wrapper = mountDate()
    expect(wrapper.find('.filter-chip__value').text()).toBe('Last 30 days')
  })

  test('the custom range asks for both days and shows them once given', async () => {
    const wrapper = mountDate({ modelValue: 'custom' })
    await open(wrapper)

    expect(byTestId('date-filter-from')).not.toBeNull()
    expect(byTestId('date-filter-to')).not.toBeNull()
    expect(wrapper.find('.filter-chip__value').text()).toBe('Custom range')

    await wrapper.setProps({ from: '2026-10-01', to: '2026-10-15' })

    expect(wrapper.find('.filter-chip__value').text()).toContain('–')
  })

  test('typing a day emits it', async () => {
    const wrapper = mountDate({ modelValue: 'custom' })
    await open(wrapper)

    const from = byTestId('date-filter-from') as HTMLInputElement
    from.value = '2026-10-01'
    from.dispatchEvent(new Event('input'))

    expect(wrapper.emitted('update:from')).toEqual([['2026-10-01']])
  })

  test('picking a preset emits it', async () => {
    const wrapper = mountDate()
    await open(wrapper)

    await click(byTestId('filter-option-today'))

    expect(wrapper.emitted('update:modelValue')).toEqual([['today']])
  })
})

describe('AddFilterMenu', () => {
  const groups = [
    {
      key: 'execution',
      title: 'Execution',
      fields: [
        { key: 'state', title: 'Execution state', icon: 'mdi-progress-check' },
        { key: 'user', title: 'User', icon: 'mdi-account-outline' },
      ],
    },
    {
      key: 'solution',
      title: 'Solution',
      fields: [{ key: 'solver', title: 'Solver', icon: 'mdi-cpu-64-bit' }],
    },
  ]

  const mountMenu = async () => {
    const wrapper = mount(AddFilterMenu, {
      props: {
        label: 'Add filter',
        searchPlaceholder: 'Search field…',
        noMatchesText: 'No field matches',
        groups,
      },
      attachTo: document.body,
    })
    await wrapper.find('.add-filter').trigger('click')
    await flushPromises()
    return wrapper
  }

  const search = async (text: string) => {
    const input = document.body.querySelector<HTMLInputElement>(
      '.core-menu__search-input',
    )!
    input.value = text
    input.dispatchEvent(new Event('input'))
    await flushPromises()
  }

  test('lists the fields by group', async () => {
    await mountMenu()

    expect(
      Array.from(document.body.querySelectorAll('.core-menu__group')).map(
        (group) => group.textContent?.trim(),
      ),
    ).toEqual(['Execution', 'Solution'])
    expect(rowLabels()).toEqual(['Execution state', 'User', 'Solver'])
  })

  test('the search narrows the fields, and says when none matches', async () => {
    await mountMenu()

    await search('sol')
    expect(rowLabels()).toEqual(['Solver'])

    await search('zzz')
    expect(
      document.body.querySelector('.core-menu__empty')?.textContent?.trim(),
    ).toBe('No field matches')
  })

  test('picking a field emits it and closes the menu', async () => {
    const wrapper = await mountMenu()

    await click(byTestId('add-filter-user'))

    expect(wrapper.emitted('add')).toEqual([['user']])
    expect(menu()).toBeNull()
  })
})
