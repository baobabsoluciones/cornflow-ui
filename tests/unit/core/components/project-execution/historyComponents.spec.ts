import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const { store } = vi.hoisted(() => ({
  store: { appConfig: { parameters: {} as Record<string, any> } },
}))
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => store,
}))

import ExecutionDetailHeader from '@cornflow-ui/core/components/project-execution/ExecutionDetailHeader.vue'
import ExecutionListItem from '@cornflow-ui/core/components/project-execution/ExecutionListItem.vue'
import ExecutionStateBadge from '@cornflow-ui/core/components/project-execution/ExecutionStateBadge.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      state: {
        success: 'Success',
        successMessage: 'Solved',
        error: 'Error',
        errorMessage: 'It failed',
      },
      latestPlan: {
        chip: { current: 'Current plan' },
        actions: {
          setAsCurrent: 'Mark as current plan',
          isCurrentPlan: 'It is the current plan',
        },
      },
      executionTable: {
        replanning: 'Replanning',
        loadExecution: 'Load execution',
        deleteExecution: 'Delete',
      },
      versionHistory: {
        detail: {
          serverMessage: 'Server message',
          backToList: 'Back to the list',
          downloadExcel: 'Download Excel',
        },
      },
    },
  },
})

const global = { plugins: [i18n] }

const execution = (overrides = {}) => ({
  id: 'e1',
  name: 'Plan week 43',
  description: 'Base scenario',
  state: 1,
  message: '',
  createdAt: '2026-10-21T10:30:00Z',
  userName: 'agarcia',
  userFullName: 'Ana García',
  config: {},
  solution_state: { status_code: 1 },
  ...overrides,
})

beforeEach(() => {
  store.appConfig = {
    parameters: {
      showExtraProjectExecutionColumns: { showUserFullName: true },
      executionStates: {
        '1': {
          color: 'green',
          codeKey: 'state.success',
          messageKey: 'state.successMessage',
        },
        '-1': {
          color: 'red',
          codeKey: 'state.error',
          messageKey: 'state.errorMessage',
        },
      },
      solutionStates: {},
    },
  }
})

describe('ExecutionStateBadge', () => {
  test('the chip shows the label, and the message under it when asked', () => {
    const wrapper = mount(ExecutionStateBadge, {
      props: { kind: 'execution', code: 1, showMessage: true },
      global,
    })
    expect(wrapper.find('.core-badge').text()).toBe('Success')
    expect(wrapper.find('.core-badge').attributes('title')).toBe(
      'Success — Solved',
    )
    expect(wrapper.find('.execution-state__message').text()).toBe('Solved')
  })

  test('the icon variant names the state for screen readers', () => {
    const wrapper = mount(ExecutionStateBadge, {
      props: { kind: 'execution', code: -1, variant: 'icon' },
      global,
    })
    const icon = wrapper.find('.execution-state__icon')
    expect(icon.attributes('aria-label')).toBe('Error — It failed')
    expect(icon.classes()).toContain('is-danger')
  })
})

describe('ExecutionListItem', () => {
  test('shows the name, its tags, the time and the user', () => {
    const wrapper = mount(ExecutionListItem, {
      props: {
        execution: execution({ config: { replanning: true } }),
        currentPlan: true,
      },
      global,
    })
    const text = wrapper.text()
    expect(text).toContain('Plan week 43')
    expect(text).toContain('Base scenario')
    expect(text).toContain('Current plan')
    expect(text).toContain('Replanning')
    expect(text).toContain('Ana García')
  })

  test('selecting, loading and downloading emit separately', async () => {
    const wrapper = mount(ExecutionListItem, {
      props: { execution: execution(), selected: true },
      global,
    })
    expect(
      wrapper.find('.execution-row__main').attributes('aria-current'),
    ).toBe('true')

    await wrapper.find('.execution-row__main').trigger('click')
    await wrapper.find('[data-testid="history-row-load"]').trigger('click')
    await wrapper.find('[data-testid="history-row-excel"]').trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('load')).toHaveLength(1)
    expect(wrapper.emitted('excel')).toHaveLength(1)
  })

  test('keeps the actions in sight while one of them runs', () => {
    const wrapper = mount(ExecutionListItem, {
      props: { execution: execution(), loading: true },
      global,
    })
    expect(wrapper.find('.execution-row__actions').classes()).toContain(
      'is-visible',
    )
  })
})

describe('ExecutionDetailHeader', () => {
  test('shows the server message of a failed execution', () => {
    const wrapper = mount(ExecutionDetailHeader, {
      props: {
        execution: execution({
          state: -1,
          message: "Column 'capacity' not found",
        }),
      },
      global,
    })
    const alert = wrapper.find('[role="alert"]')
    expect(alert.text()).toContain('Server message')
    expect(alert.text()).toContain("Column 'capacity' not found")
  })

  test('does not show the message of an execution that worked', () => {
    const wrapper = mount(ExecutionDetailHeader, {
      props: {
        execution: execution({
          message: 'The execution has been solved correctly',
        }),
      },
      global,
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  test('offers to mark it as the current plan only when it applies', () => {
    const candidate = mount(ExecutionDetailHeader, {
      props: { execution: execution(), canSetCurrentPlan: true },
      global,
    })
    expect(
      candidate.find('[data-testid="history-detail-set-current"]').exists(),
    ).toBe(true)

    const current = mount(ExecutionDetailHeader, {
      props: { execution: execution(), currentPlan: true },
      global,
    })
    expect(
      current.find('[data-testid="history-detail-set-current"]').exists(),
    ).toBe(false)
    expect(current.text()).toContain('Current plan')
  })

  test('each action emits its event, and back appears on narrow screens', async () => {
    const wrapper = mount(ExecutionDetailHeader, {
      props: {
        execution: execution(),
        canSetCurrentPlan: true,
        showBack: true,
      },
      global,
    })

    await wrapper.find('[data-testid="history-detail-load"]').trigger('click')
    await wrapper.find('[data-testid="history-detail-excel"]').trigger('click')
    await wrapper
      .find('[data-testid="history-detail-set-current"]')
      .trigger('click')
    await wrapper.find('[data-testid="history-detail-delete"]').trigger('click')
    await wrapper.find('.execution-detail-header__back').trigger('click')

    expect(Object.keys(wrapper.emitted())).toEqual(
      expect.arrayContaining([
        'load',
        'excel',
        'set-current-plan',
        'delete',
        'back',
      ]),
    )
  })
})
