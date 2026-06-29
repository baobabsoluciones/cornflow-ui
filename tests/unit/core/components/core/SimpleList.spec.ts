import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import SimpleList from '@cornflow-ui/core/components/core/SimpleList.vue'

describe('SimpleList', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const createWrapper = (props = {}) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          table: {
            noDataAvailable: 'No data available',
            searchPlaceholder: 'Search...',
            downloadExcelTable: 'Download Excel',
          },
        },
      },
    })
    return mount(SimpleList, {
      props,
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          CoreSearchInput: {
            name: 'CoreSearchInput',
            props: ['modelValue', 'placeholder'],
            template:
              '<div class="search-stub" @click="$emit(\'search\', \'q\')"></div>',
          },
          CoreDropdownMenu: {
            name: 'CoreDropdownMenu',
            props: ['items'],
            template: '<div class="menu-stub"></div>',
          },
          'v-icon': true,
        },
      },
    })
  }

  test('shows no-data alert when items empty', () => {
    wrapper = createWrapper({ items: [] })
    expect(wrapper.text()).toContain('No data available')
    expect(wrapper.find('.search-stub').exists()).toBe(false)
  })

  test('renders search input when items present and enableSearch', () => {
    wrapper = createWrapper({ items: ['a', 'b'], enableSearch: true })
    expect(wrapper.find('.search-stub').exists()).toBe(true)
  })

  test('does not render search input when enableSearch false', () => {
    wrapper = createWrapper({ items: ['a'], enableSearch: false })
    expect(wrapper.find('.search-stub').exists()).toBe(false)
  })

  test('renders dropdown menu when canDownloadExcel', () => {
    wrapper = createWrapper({ items: ['a'], canDownloadExcel: true })
    expect(wrapper.find('.menu-stub').exists()).toBe(true)
  })

  test('hides dropdown menu when canDownloadExcel false', () => {
    wrapper = createWrapper({ items: ['a'], canDownloadExcel: false })
    expect(wrapper.find('.menu-stub').exists()).toBe(false)
  })

  test('renders an alert per item', () => {
    wrapper = createWrapper({ items: ['one', 'two', 'three'] })
    const alerts = wrapper.findAll('.simple-list-item')
    expect(alerts).toHaveLength(3)
    expect(wrapper.text()).toContain('one')
  })

  test('shows skeleton loader when loading', () => {
    wrapper = createWrapper({ items: ['a'], loading: true })
    expect(wrapper.findComponent({ name: 'VSkeletonLoader' }).exists()).toBe(
      true,
    )
    expect(wrapper.find('.simple-list-item').exists()).toBe(false)
  })

  test('filteredItems returns all items when no search value', () => {
    wrapper = createWrapper({ items: ['apple', 'banana'], searchValue: '' })
    expect((wrapper.vm as any).filteredItems).toEqual(['apple', 'banana'])
  })

  test('filteredItems filters by searchValue', () => {
    wrapper = createWrapper({
      items: ['apple', 'banana', 'cherry'],
      searchValue: 'an',
    })
    expect((wrapper.vm as any).filteredItems).toEqual(['banana'])
  })

  test('filteredItems with whitespace-only search returns all', () => {
    wrapper = createWrapper({ items: ['a', 'b'], searchValue: '   ' })
    expect((wrapper.vm as any).filteredItems).toEqual(['a', 'b'])
  })

  test('handleSearch emits update:searchValue and search', async () => {
    wrapper = createWrapper({ items: ['a'], enableSearch: true })
    await wrapper.find('.search-stub').trigger('click')
    expect(wrapper.emitted('update:searchValue')![0]).toEqual(['q'])
    expect(wrapper.emitted('search')![0]).toEqual(['q'])
  })

  test('actionItems action emits download-excel', () => {
    wrapper = createWrapper({ items: ['a'], canDownloadExcel: true })
    const actionItems = (wrapper.vm as any).actionItems
    expect(actionItems[0].id).toBe('download-excel')
    actionItems[0].action()
    expect(wrapper.emitted('download-excel')).toBeTruthy()
  })

  test('computedSearchPlaceholder uses default i18n when not provided', () => {
    wrapper = createWrapper({ items: ['a'] })
    expect((wrapper.vm as any).computedSearchPlaceholder).toBe('Search...')
  })

  test('computedSearchPlaceholder uses provided placeholder', () => {
    wrapper = createWrapper({ items: ['a'], searchPlaceholder: 'Custom' })
    expect((wrapper.vm as any).computedSearchPlaceholder).toBe('Custom')
  })

  test('handleTableActionClick is a no-op (does not throw)', () => {
    wrapper = createWrapper({ items: ['a'] })
    expect(() =>
      (wrapper.vm as any).handleTableActionClick({ id: 'x' }),
    ).not.toThrow()
  })

  test('applies elevation prop to card', () => {
    wrapper = createWrapper({ items: ['a'], elevation: 5 })
    expect(wrapper.findComponent({ name: 'VCard' }).props('elevation')).toBe(5)
  })
})
