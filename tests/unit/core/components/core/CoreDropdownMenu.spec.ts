import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import CoreDropdownMenu from '@cornflow-ui/core/components/core/CoreDropdownMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { general: { moreActions: 'More actions' } } },
})

/** The popover rendered inline, open, so the menu can be read and clicked. */
const popover = {
  name: 'CorePopover',
  props: ['open'],
  emits: ['update:open'],
  template: '<div><slot name="trigger" /><slot /></div>',
}

function mountMenu(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(CoreDropdownMenu, {
    props,
    slots,
    global: { plugins: [i18n], stubs: { CorePopover: popover } },
  })
}

const rows = (wrapper: ReturnType<typeof mountMenu>) =>
  wrapper.findAll('.core-menu__item').map((row) => row.text())

describe('CoreDropdownMenu', () => {
  test('its trigger is a "more actions" button', () => {
    const trigger = mountMenu().find('[data-testid="core-dropdown-menu-trigger"]')
    expect(trigger.attributes('aria-label')).toBe('More actions')
  })

  test('lists the sections, each under its title and apart from the next, then the loose items', () => {
    const wrapper = mountMenu({
      sections: [
        { title: 'Data', items: [{ title: 'Download' }, { title: 'Upload' }] },
        { items: [{ title: 'Delete' }] },
      ],
      items: [{ title: 'Help' }],
    })
    expect(wrapper.findAll('.core-menu__group').map((group) => group.text())).toEqual(['Data'])
    expect(rows(wrapper)).toEqual(['Download', 'Upload', 'Delete', 'Help'])
    expect(wrapper.findAll('.core-menu__separator')).toHaveLength(2)
  })

  test('an item runs its action, is emitted and closes the menu', async () => {
    const action = vi.fn()
    const item = { id: 'download', title: 'Download', icon: 'mdi-download', action }
    const wrapper = mountMenu({ items: [item], modelValue: true })
    await wrapper.find('[data-testid="dropdown-item-download"]').trigger('click')
    expect(action).toHaveBeenCalled()
    expect(wrapper.emitted('item-click')?.[0]).toEqual([item])
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  test('stays open after an item when asked to', async () => {
    const wrapper = mountMenu({ items: [{ title: 'Refresh' }], modelValue: true, closeOnItemClick: false })
    await wrapper.find('.core-menu__item').trigger('click')
    expect(wrapper.emitted('item-click')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('a disabled item cannot be picked', async () => {
    const action = vi.fn()
    const wrapper = mountMenu({ items: [{ title: 'Delete', disabled: true, action }] })
    const row = wrapper.find('.core-menu__item')
    expect(row.attributes('disabled')).toBeDefined()
    await row.trigger('click')
    expect(action).not.toHaveBeenCalled()
    expect(wrapper.emitted('item-click')).toBeUndefined()
  })

  test('takes its own trigger and extra content', () => {
    const wrapper = mountMenu(
      { items: [{ title: 'Download' }] },
      { activator: '<button class="own-trigger">Actions</button>', content: '<p class="extra">Extra</p>' },
    )
    expect(wrapper.find('.own-trigger').exists()).toBe(true)
    expect(wrapper.find('[data-testid="core-dropdown-menu-trigger"]').exists()).toBe(false)
    expect(wrapper.find('.extra').text()).toBe('Extra')
  })
})
