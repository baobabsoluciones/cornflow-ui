import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import CoreDropdownMenu from '@cornflow-ui/core/components/core/CoreDropdownMenu.vue'

// Stub the v-menu so the dropdown content renders inline (avoids jsdom overlay errors)
const menuStub = {
  name: 'v-menu',
  props: ['modelValue'],
  template:
    '<div class="v-menu-stub"><slot name="activator" :props="{}" :isOpen="modelValue" /><slot /></div>',
}

describe('CoreDropdownMenu', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const createWrapper = (props = {}, slots = {}) =>
    mount(CoreDropdownMenu, {
      props,
      slots,
      global: {
        plugins: [vuetify],
        stubs: {
          'v-menu': menuStub,
          'v-icon': true,
        },
      },
    })

  test('renders default activator (trigger button) when no slot', () => {
    wrapper = createWrapper()
    expect(wrapper.find('.core-dropdown-menu__trigger').exists()).toBe(true)
  })

  test('renders items without sections', () => {
    wrapper = createWrapper({
      items: [
        { id: 'a', title: 'Item A', icon: 'mdi-a' },
        { id: 'b', title: 'Item B' },
      ],
    })
    const titles = wrapper.findAll('.core-dropdown-menu__item-title')
    expect(titles).toHaveLength(2)
    expect(titles[0].text()).toBe('Item A')
  })

  test('renders sections with header and divider between sections', () => {
    wrapper = createWrapper({
      sections: [
        { title: 'Group 1', items: [{ title: 'One' }] },
        { title: 'Group 2', items: [{ title: 'Two' }] },
      ],
    })
    const headers = wrapper.findAll('.core-dropdown-menu__section-header')
    expect(headers).toHaveLength(2)
    expect(wrapper.findAll('.core-dropdown-menu__divider')).toHaveLength(1)
  })

  test('renders right icon and right content', () => {
    wrapper = createWrapper({
      items: [
        { title: 'WithRightIcon', rightIcon: 'mdi-chevron-right' },
        { title: 'WithRightContent', rightContent: 'Ctrl+K' },
      ],
    })
    expect(wrapper.find('.core-dropdown-menu__item-right-content').text()).toBe(
      'Ctrl+K',
    )
  })

  test('clicking an item emits item-click and runs action', async () => {
    const action = vi.fn()
    wrapper = createWrapper({
      items: [{ id: 'a', title: 'Click', action }],
    })
    await wrapper.find('.core-dropdown-menu__item').trigger('click')
    expect(action).toHaveBeenCalled()
    expect(wrapper.emitted('item-click')![0][0]).toMatchObject({ id: 'a' })
  })

  test('disabled item does not emit item-click or run action', async () => {
    const action = vi.fn()
    wrapper = createWrapper({
      items: [{ id: 'a', title: 'Disabled', disabled: true, action }],
    })
    await wrapper.find('.core-dropdown-menu__item').trigger('click')
    expect(action).not.toHaveBeenCalled()
    expect(wrapper.emitted('item-click')).toBeFalsy()
  })

  test('item without action still emits item-click', async () => {
    wrapper = createWrapper({ items: [{ title: 'NoAction' }] })
    await wrapper.find('.core-dropdown-menu__item').trigger('click')
    expect(wrapper.emitted('item-click')).toBeTruthy()
  })

  test('disabled class applied to disabled items', () => {
    wrapper = createWrapper({
      items: [{ title: 'D', disabled: true }],
    })
    expect(
      wrapper.find('.core-dropdown-menu__item--disabled').exists(),
    ).toBe(true)
  })

  test('renders custom activator slot', () => {
    wrapper = createWrapper(
      {},
      {
        activator: '<button class="my-activator">Open</button>',
      },
    )
    expect(wrapper.find('.my-activator').exists()).toBe(true)
    expect(wrapper.find('.core-dropdown-menu__trigger').exists()).toBe(false)
  })

  test('renders content slot', () => {
    wrapper = createWrapper(
      {},
      { content: '<div class="custom-content">extra</div>' },
    )
    expect(wrapper.find('.custom-content').exists()).toBe(true)
  })

  test('closeOnItemClick false keeps menu state (no error)', async () => {
    const action = vi.fn()
    wrapper = createWrapper({
      items: [{ title: 'Stay', action }],
      closeOnItemClick: false,
    })
    await wrapper.find('.core-dropdown-menu__item').trigger('click')
    expect(action).toHaveBeenCalled()
    expect(wrapper.emitted('item-click')).toBeTruthy()
  })

  test('empty props default to empty lists', () => {
    wrapper = createWrapper()
    expect(wrapper.findAll('.core-dropdown-menu__item')).toHaveLength(0)
  })
})
