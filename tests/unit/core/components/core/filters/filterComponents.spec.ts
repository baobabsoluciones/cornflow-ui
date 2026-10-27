import { describe, test, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import FilterChip from '@cornflow-ui/core/components/core/filters/FilterChip.vue'
import DateFilterChip from '@cornflow-ui/core/components/core/filters/DateFilterChip.vue'
import AddFilterMenu from '@cornflow-ui/core/components/core/filters/AddFilterMenu.vue'
import OptionCards from '@cornflow-ui/core/components/core/OptionCards.vue'

/**
 * Stand-in for Vuetify's menu (an overlay jsdom cannot position): the activator toggles
 * `v-model`, and the content renders in place while it is open.
 */
const VMenuStub = defineComponent({
  name: 'VMenu',
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],
  setup(props, { slots, emit }) {
    return () =>
      h('div', [
        slots.activator?.({
          props: {
            onClick: () => emit('update:modelValue', !props.modelValue),
          },
          isActive: props.modelValue,
        }),
        props.modelValue ? slots.default?.() : null,
      ])
  },
})

const global = {
  plugins: [createVuetify({ components, directives })],
  stubs: { VMenu: VMenuStub },
}

const plants = [
  { value: 1, title: 'North', count: 3 },
  { value: 2, title: 'South', count: 0 },
]

describe('FilterChip', () => {
  const mountChip = (props = {}) =>
    mount(FilterChip, {
      props: { label: 'Plant', options: plants, allLabel: 'All', ...props },
      global,
    })

  const open = async (wrapper: any) => {
    await wrapper.find('.filter-chip__main').trigger('click')
  }

  test('shows the label and the picked option, or "All"', async () => {
    const wrapper = mountChip()
    expect(wrapper.find('.filter-chip__label').text()).toBe('Plant:')
    expect(wrapper.find('.filter-chip__value').text()).toBe('All')
    expect(wrapper.find('.filter-chip').classes()).not.toContain('is-set')

    await wrapper.setProps({ value: '2' })

    expect(wrapper.find('.filter-chip__value').text()).toBe('South')
    expect(wrapper.find('.filter-chip').classes()).toContain('is-set')
  })

  test('lists "All" first and the options, marking the picked one', async () => {
    const wrapper = mountChip({ value: 1 })
    await open(wrapper)

    const options = wrapper.findAll('.filter-menu__option')
    expect(
      options.map((option) => option.find('.filter-menu__title').text()),
    ).toEqual(['All', 'North', 'South'])
    expect(options[1].classes()).toContain('is-selected')
    expect(wrapper.find('.filter-menu__count').exists()).toBe(false)
  })

  test('picking an option emits it and closes the menu', async () => {
    const wrapper = mountChip()
    await open(wrapper)

    await wrapper.find('[data-testid="filter-option-2"]').trigger('click')

    expect(wrapper.emitted('pick')).toEqual([[2]])
    expect(wrapper.find('.filter-menu').exists()).toBe(false)
  })

  test('shows the counts when asked', async () => {
    const wrapper = mountChip({ showCounts: true })
    await open(wrapper)

    expect(
      wrapper.findAll('.filter-menu__count').map((count) => count.text()),
    ).toEqual(['3', '0'])
  })

  test('a removable chip has a cross instead of the chevron', async () => {
    const wrapper = mountChip({ removable: true, removeLabel: 'Remove filter' })

    expect(wrapper.find('.filter-chip__chevron').exists()).toBe(false)
    const cross = wrapper.find('[data-testid="filter-chip-remove"]')
    expect(cross.attributes('aria-label')).toBe('Remove filter')

    await cross.trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  test('picking the keep-open value leaves the menu open', async () => {
    const wrapper = mountChip({ keepOpenValue: 2 })
    await open(wrapper)

    await wrapper.find('[data-testid="filter-option-2"]').trigger('click')

    expect(wrapper.find('.filter-menu').exists()).toBe(true)
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
      global,
    })

  test('shows the picked preset', () => {
    const wrapper = mountDate()
    expect(wrapper.find('.filter-chip__value').text()).toBe('Last 30 days')
  })

  test('the custom range asks for both days and shows them once given', async () => {
    const wrapper = mountDate({ modelValue: 'custom' })
    await wrapper.find('.filter-chip__main').trigger('click')

    expect(wrapper.find('[data-testid="date-filter-from"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="date-filter-to"]').exists()).toBe(true)
    expect(wrapper.find('.filter-chip__value').text()).toBe('Custom range')

    await wrapper.setProps({ from: '2026-10-01', to: '2026-10-15' })

    expect(wrapper.find('.filter-chip__value').text()).toContain('–')
  })

  test('picking a preset emits it', async () => {
    const wrapper = mountDate()
    await wrapper.find('.filter-chip__main').trigger('click')

    await wrapper.find('[data-testid="filter-option-today"]').trigger('click')

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
      global,
    })
    await wrapper.find('.add-filter').trigger('click')
    return wrapper
  }

  test('lists the fields by group', async () => {
    const wrapper = await mountMenu()

    expect(
      wrapper.findAll('.filter-menu__caption').map((c) => c.text()),
    ).toEqual(['Execution', 'Solution'])
    expect(wrapper.findAll('.filter-menu__title').map((t) => t.text())).toEqual(
      ['Execution state', 'User', 'Solver'],
    )
  })

  test('the search narrows the fields, and says when none matches', async () => {
    const wrapper = await mountMenu()
    const search = wrapper.find('.add-filter-menu__search input')

    await search.setValue('sol')
    expect(wrapper.findAll('.filter-menu__title').map((t) => t.text())).toEqual(
      ['Solver'],
    )

    await search.setValue('zzz')
    expect(wrapper.find('.add-filter-menu__empty').text()).toBe(
      'No field matches',
    )
  })

  test('picking a field emits it and closes the menu', async () => {
    const wrapper = await mountMenu()

    await wrapper.find('[data-testid="add-filter-user"]').trigger('click')

    expect(wrapper.emitted('add')).toEqual([['user']])
    expect(wrapper.find('.add-filter-menu').exists()).toBe(false)
  })
})

describe('OptionCards', () => {
  const options = [
    {
      value: 'operative',
      title: 'Operative',
      description: 'Current staff only',
    },
    { value: 'strategic', title: 'Strategic' },
  ]

  test('shows each option with its description and marks the picked one', () => {
    const wrapper = mount(OptionCards, {
      props: { modelValue: 'strategic', options },
      global,
    })

    const cards = wrapper.findAll('.option-card')
    expect(cards[0].text()).toContain('Current staff only')
    expect(cards[1].classes()).toContain('is-selected')
    expect(cards[1].attributes('aria-pressed')).toBe('true')
  })

  test('clicking a card emits its value', async () => {
    const wrapper = mount(OptionCards, {
      props: { modelValue: null, options },
      global,
    })

    await wrapper.find('[data-testid="option-card-operative"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['operative']])
  })
})
