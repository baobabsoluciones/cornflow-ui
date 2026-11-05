import { describe, test, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const { store, snackbar } = vi.hoisted(() => ({
  store: {} as Record<string, any>,
  snackbar: vi.fn(),
}))

vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => store }))
vi.mock('@cornflow-ui/core/services/SnackbarService', () => ({ showSnackbar: snackbar }))
vi.mock('@cornflow-ui/core/composables/project-execution/useExecutionStatus', () => ({
  useExecutionStatus: () => ({
    displayStatus: (state: number, code: number | null | undefined) =>
      state === 1 && code != null
        ? { label: `solution ${code}`, tone: 'success', spin: false }
        : { label: `state ${state}`, tone: state === -1 ? 'danger' : 'primary', spin: state === 0 },
  }),
}))

import {
  RECENT_EXECUTIONS,
  useDrawerExecutions,
} from '@cornflow-ui/core/composables/navigation/useDrawerExecutions'

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000)
const execution = (id: string, minutes: number, state = 1, solution = 1) => ({
  id,
  name: `Plan ${id}`,
  createdAt: minutesAgo(minutes),
  state,
  solution_state: { status_code: solution },
})

function setup() {
  let api: ReturnType<typeof useDrawerExecutions>
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {} },
    missingWarn: false,
    fallbackWarn: false,
  })
  mount(
    defineComponent({
      setup() {
        api = useDrawerExecutions()
        return () => h('div')
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return api!
}

describe('useDrawerExecutions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(store, {
      selectedExecution: null,
      loadedExecutions: [],
      fetchRecentExecutions: vi.fn(async () => [
        execution('e1', 5),
        execution('e2', 60 * 26, -1),
        ...['e3', 'e4', 'e5', 'e6'].map((id, i) => execution(id, 60 * 24 * (3 + i))),
      ]),
      fetchLoadedExecution: vi.fn(async () => true),
      setSelectedExecution: vi.fn(),
    })
  })

  test('offers the latest executions, read as their solution when they finished', async () => {
    const api = setup()
    await api.refresh()
    expect(api.latest.value).toHaveLength(RECENT_EXECUTIONS)
    const [first, second] = api.latest.value
    expect(first).toMatchObject({ id: 'e1', name: 'Plan e1', status: { label: 'solution 1', tone: 'success' } })
    expect(first.date).toMatch(/ · \d{2}:\d{2}/)
    expect(second).toMatchObject({ status: { label: 'state -1', tone: 'danger' } })
  })

  test('the loaded execution is the selected one, with its solution state from the latest', async () => {
    expect(setup().loaded.value).toBeNull()
    store.selectedExecution = { executionId: 'e1', name: 'Plan e1', createdAt: minutesAgo(5), state: 1 }
    const api = setup()
    expect(api.loaded.value).toMatchObject({ id: 'e1', status: { label: 'state 1' } })
    await api.refresh()
    expect(api.loaded.value).toMatchObject({ id: 'e1', status: { label: 'solution 1' } })
  })

  test('a loaded execution not among the latest reads as the solution state it was loaded with', async () => {
    store.selectedExecution = {
      executionId: 'old',
      name: 'Plan old',
      createdAt: minutesAgo(60 * 24 * 30),
      state: 1,
      solutionState: { status_code: 2 },
    }
    const api = setup()
    await api.refresh()
    expect(api.loaded.value).toMatchObject({ id: 'old', status: { label: 'solution 2' } })
  })

  test('opening one loads it when it is not loaded yet, and selects it', async () => {
    const api = setup()
    await api.refresh()
    expect(await api.open(api.latest.value[1])).toBe(true)
    expect(store.fetchLoadedExecution).toHaveBeenCalledWith('e2')
    expect(store.setSelectedExecution).toHaveBeenCalledWith('e2')
  })

  test('opening one already loaded only selects it', async () => {
    store.loadedExecutions = [{ executionId: 'e2' }]
    const api = setup()
    await api.refresh()
    await api.open(api.latest.value[1])
    expect(store.fetchLoadedExecution).not.toHaveBeenCalled()
    expect(store.setSelectedExecution).toHaveBeenCalledWith('e2')
  })

  test('a load that fails says so and selects nothing', async () => {
    store.fetchLoadedExecution.mockResolvedValue(false)
    const api = setup()
    await api.refresh()
    expect(await api.open(api.latest.value[1])).toBe(false)
    expect(store.setSelectedExecution).not.toHaveBeenCalled()
    expect(snackbar).toHaveBeenCalledWith('projectExecution.snackbar.errorLoad', 'error')
  })
})
