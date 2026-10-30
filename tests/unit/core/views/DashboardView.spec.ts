import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'

const { route, router } = vi.hoisted(() => ({
  route: { path: '/dashboard/solution' },
  router: { push: vi.fn() },
}))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => router }))

vi.mock('@/app/components/DashboardMain.vue', () => ({
  default: {
    name: 'DashboardMain',
    template: '<div data-testid="dashboard-main" />',
    props: ['execution', 'dashboardType'],
  },
}))

vi.mock('@cornflow-ui/core/components/ExecutionSummary.vue', () => ({
  default: { name: 'CoreExecutionSummary', template: '<div data-testid="execution-summary" />' },
}))

vi.mock('@cornflow-ui/core/services/FrontendAutomationService', () => ({
  getSectionType: (path: string) => (path.includes('input-data') ? 'input-data' : 'results'),
}))

import DashboardView from '@cornflow-ui/core/views/DashboardView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

function mountView(selectedExecution: Record<string, unknown> | null = null) {
  setActivePinia(createPinia())
  useGeneralStore().selectedExecution = selectedExecution as any
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false })
  return mount(DashboardView, { global: { plugins: [i18n] } })
}

const execution = (state: number) => ({ executionId: 'e1', name: 'Week 43', state })

describe('DashboardView', () => {
  beforeEach(() => {
    route.path = '/dashboard/solution'
    router.push.mockClear()
  })

  test('without an execution, it says so and leads to the history', async () => {
    const wrapper = mountView()
    const empty = wrapper.find('[data-testid="dashboard-no-execution"]')
    expect(empty.text()).toContain('projectExecution.infoCard.noExecutionSelected')
    expect(wrapper.find('[data-testid="execution-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dashboard-main"]').exists()).toBe(false)

    await empty.find('button').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/history-execution')
  })

  test('with an execution, the header sums it up and the dashboard shows it', () => {
    const selected = execution(1)
    const wrapper = mountView(selected)
    expect(wrapper.find('.core-title-view__title').text()).toBe('Dashboard')
    expect(wrapper.find('[data-testid="execution-summary"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'DashboardMain' }).props('execution')).toEqual(selected)
    expect(wrapper.find('[data-testid="dashboard-running"]').exists()).toBe(false)
  })

  test('while the execution runs, it says the solution will appear', () => {
    const wrapper = mountView(execution(0))
    expect(wrapper.find('[data-testid="dashboard-running"]').text()).toContain(
      'projectExecution.infoCard.solutionWillLoadMessage',
    )
  })

  test.each([
    ['/dashboard/solution', 'solution'],
    ['/dashboard/input-data/plants', 'instance'],
  ])('on %s it is the %s dashboard', (path, type) => {
    route.path = path
    const wrapper = mountView(execution(1))
    expect(wrapper.findComponent({ name: 'DashboardMain' }).props('dashboardType')).toBe(type)
  })
})
