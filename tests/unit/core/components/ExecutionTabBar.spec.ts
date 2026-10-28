import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ExecutionTabBar from '@cornflow-ui/core/components/ExecutionTabBar.vue'

const tabs = [
  { id: 'e1', name: 'Plan week 44', status: { label: 'Optimal', tone: 'success', spin: false } },
  { id: 'e2', name: 'Plan week 45', status: { label: 'Running', tone: 'primary', spin: true } },
  { id: 'e3', name: 'Plan week 43', status: { label: 'Infeasible', tone: 'danger', spin: false } },
]

const i18n = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { executionTabs: { label: 'Open executions', close: 'Close {name}' } } },
  })

function mountBar(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(ExecutionTabBar, {
    props: { tabs, selected: 'e1', createLabel: 'New execution', ...props },
    slots,
    global: { plugins: [i18n()] },
  })
}

describe('ExecutionTabBar', () => {
  test('has a tab per execution, with its name and the dot of its state', () => {
    const wrapper = mountBar()
    const names = wrapper.findAll('.execution-tab-bar__name').map((name) => name.text())
    expect(names).toEqual(['Plan week 44', 'Plan week 45', 'Plan week 43'])
    expect(wrapper.find('[data-testid="execution-tab-e1"] .execution-tab-bar__dot').classes()).toContain('is-success')
    expect(wrapper.find('[data-testid="execution-tab-e3"] .execution-tab-bar__dot').classes()).toContain('is-danger')
    expect(wrapper.find('[data-testid="execution-tab-e1"]').attributes('title')).toBe('Plan week 44 · Optimal')
  })

  test('a running execution shows a spinner instead of the dot', () => {
    const running = mountBar().find('[data-testid="execution-tab-e2"]')
    expect(running.find('.core-spinner').exists()).toBe(true)
    expect(running.find('.execution-tab-bar__dot').exists()).toBe(false)
  })

  test('marks the selected tab', () => {
    const wrapper = mountBar({ selected: 'e2' })
    const selected = wrapper.findAll('[role="tab"]').map((tab) => tab.attributes('aria-selected'))
    expect(selected).toEqual(['false', 'true', 'false'])
    expect(wrapper.findAll('.execution-tab-bar__tab')[1].classes()).toContain('is-selected')
  })

  test('a click selects a tab; the × closes it without selecting it', async () => {
    const wrapper = mountBar()
    await wrapper.find('[data-testid="execution-tab-e2"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['e2']])

    const close = wrapper.find('[data-testid="execution-tab-close-e3"]')
    expect(close.attributes('aria-label')).toBe('Close Plan week 43')
    await close.trigger('click')
    expect(wrapper.emitted('close')).toEqual([[2]])
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  test('"New execution" asks to create one', async () => {
    const wrapper = mountBar({ tabs: [] })
    const create = wrapper.find('[data-testid="execution-tab-bar-create"]')
    expect(create.text()).toBe('New execution')
    await create.trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  test('shows the end slot after the tabs', () => {
    const wrapper = mountBar({}, { end: '<span class="credit">Powered by</span>' })
    expect(wrapper.find('.execution-tab-bar__end .credit').exists()).toBe(true)
    expect(mountBar().find('.execution-tab-bar__end').exists()).toBe(false)
  })
})
