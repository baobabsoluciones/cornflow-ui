import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import MessageList from '@cornflow-ui/core/components/core/data-table/MessageList.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      dataTable: { messages: { error: 'Error', warning: 'Warning', none: 'No messages' } },
    },
  },
})

const mountList = (props: Record<string, unknown>) =>
  mount(MessageList, { props: props as any, global: { plugins: [i18n] } })

describe('MessageList', () => {
  test('shows each message numbered, with the icon of its level', () => {
    const wrapper = mountList({
      messages: ['Product P-199 has no demand.', 'Line L22 has no shifts in week 45.'],
      level: 'warning',
    })

    const items = wrapper.findAll('[data-testid="message-list-item"]')
    expect(items).toHaveLength(2)
    expect(items[1].text()).toContain('Line L22 has no shifts in week 45.')
    expect(items[1].text()).toContain('#2')
    expect(items[0].find('.mdi-alert').attributes('aria-label')).toBe('Warning')
  })

  test('an error check uses the error icon', () => {
    const wrapper = mountList({ messages: ['Capacity exceeded.'], level: 'error' })

    expect(wrapper.find('.mdi-alert-circle').attributes('aria-label')).toBe('Error')
  })

  test('with no messages it says so', () => {
    expect(mountList({ messages: [], level: 'error' }).text()).toContain('No messages')
    expect(
      mountList({ messages: [], level: 'error', emptyTitle: 'No message matches' }).text(),
    ).toContain('No message matches')
  })
})
