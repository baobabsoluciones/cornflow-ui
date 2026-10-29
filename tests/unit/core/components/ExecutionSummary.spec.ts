import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const { store } = vi.hoisted(() => ({
  store: { appConfig: { parameters: {} as Record<string, any> }, selectedExecution: null as any },
}))
vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => store }))

import ExecutionSummary from '@cornflow-ui/core/components/ExecutionSummary.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      state: { success: 'Success', successMessage: 'Solved', running: 'Running', runningMessage: 'Solving' },
      solution: { optimal: 'Optimal', optimalMessage: 'The best solution' },
    },
  },
})

const global = { plugins: [i18n], stubs: { teleport: true } }

const execution = (overrides = {}) => ({
  executionId: 'e1',
  name: 'Plan week 43',
  description: 'Base scenario',
  createdAt: '2026-10-21T10:30:00Z',
  state: 1,
  messageState: '',
  solutionState: { status_code: 1 },
  config: { solver: 'mip' },
  ...overrides,
})

const badges = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.core-badge').map((badge) => badge.text())

beforeEach(() => {
  store.selectedExecution = null
  store.appConfig = {
    parameters: {
      executionStates: {
        '1': { color: 'green', codeKey: 'state.success', messageKey: 'state.successMessage' },
        '0': { color: 'blue', codeKey: 'state.running', messageKey: 'state.runningMessage' },
      },
      solutionStates: {
        '1': { color: 'green', codeKey: 'solution.optimal', messageKey: 'solution.optimalMessage' },
      },
    },
  }
})

describe('ExecutionSummary', () => {
  test('sums up the selected execution: name, date and solver, and its state', () => {
    store.selectedExecution = execution()
    const wrapper = mount(ExecutionSummary, { global })
    expect(wrapper.find('.execution-summary__name').text()).toBe('Plan week 43')
    const meta = wrapper.find('.execution-summary__meta').text()
    expect(meta).toContain('2026')
    expect(meta).toMatch(/· mip$/)
    expect(badges(wrapper)).toEqual(['Optimal'])
  })

  test('a running execution reads as its own state', () => {
    const wrapper = mount(ExecutionSummary, {
      props: { execution: execution({ state: 0, solutionState: null }) as any },
      global,
    })
    expect(badges(wrapper)).toEqual(['Running'])
  })

  test('leaves the solver out where the app hides it', () => {
    store.appConfig.parameters.showExtraProjectExecutionColumns = { showSolver: false }
    store.selectedExecution = execution()
    const wrapper = mount(ExecutionSummary, { global })
    expect(wrapper.find('.execution-summary__meta').text()).not.toContain('mip')
  })

  test("the app's summary replaces what it returns and keeps the rest", () => {
    const resolver = vi.fn((loaded: any, defaults: any) => ({
      badges: [{ label: `Mode ${loaded.config.mode}`, tone: 'info' }, ...defaults.badges],
    }))
    store.appConfig.parameters.executionSummary = resolver
    store.selectedExecution = execution({ config: { solver: 'mip', mode: 'daily' } })
    const wrapper = mount(ExecutionSummary, { global })
    expect(badges(wrapper)).toEqual(['Mode daily', 'Optimal'])
    expect(wrapper.find('.execution-summary__meta').text()).toContain('mip')
    expect(resolver.mock.calls[0][1].badges[0]).toMatchObject({ label: 'Optimal', tone: 'success' })
  })

  test('shows nothing without an execution', () => {
    const wrapper = mount(ExecutionSummary, { global })
    expect(wrapper.find('[data-testid="execution-summary"]').exists()).toBe(false)
  })
})
