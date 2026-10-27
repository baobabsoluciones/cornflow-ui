import { describe, test, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { useSchemaSwitch } from '@cornflow-ui/core/composables/navigation/useSchemaSwitch'

const mockConfig = vi.hoisted(() => ({
  schema: 'planning_dag',
  schemas: ['planning_dag', 'stock_dag'] as string[],
  auth: { type: 'cornflow' },
  initConfig: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@cornflow-ui/core/config', () => ({ default: mockConfig }))

const mockParameters = vi.hoisted(() => ({
  schemaLabels: { planning_dag: 'Planning', stock_dag: 'labels.stock' } as Record<string, string>,
}))
vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({ parameters: mockParameters }),
    getDashboardRoutes: () => [],
    getDashboardPages: () => [],
    getDashboardLayout: () => ({}),
    getInstanceDashboardRoutes: () => [],
    getInstanceDashboardPages: () => [],
    getInstanceDashboardLayout: () => ({}),
    getInstanceDependentAppRoutePrefixes: () => [],
  },
}))

async function setup(path = '/history-execution') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/history-execution', component: { template: '<div />' } },
      { path: '/project-execution', component: { template: '<div />' } },
      { path: '/my-dashboard', component: { template: '<div />' } },
      { path: '/planning-board', component: { template: '<div />' }, meta: { schemas: ['planning_dag'] } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const pushSpy = vi.spyOn(router, 'push')
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { labels: { stock: 'Stock' } } } })

  let api: ReturnType<typeof useSchemaSwitch>
  mount(
    defineComponent({
      setup() {
        api = useSchemaSwitch()
        return () => h('div')
      },
    }),
    { global: { plugins: [i18n, router] } },
  )
  return { api: api!, pushSpy }
}

describe('useSchemaSwitch', () => {
  let store: ReturnType<typeof useGeneralStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useGeneralStore()
    store.availableSchemas = ['planning_dag', 'stock_dag']
    store.setActiveSchema = vi.fn(async (schema: string) => {
      store.schema = schema
      return true
    }) as any
  })

  test('offers the DAGs the user may switch to, with their labels', async () => {
    const { api } = await setup()
    expect(api.canSwitch.value).toBe(true)
    expect(api.current.value).toBe('planning_dag')
    expect(api.schemas.value.map(api.schemaLabel)).toEqual(['Planning', 'Stock'])
  })

  test('a user with a single DAG cannot switch', async () => {
    store.availableSchemas = ['planning_dag']
    const { api } = await setup()
    expect(api.canSwitch.value).toBe(false)
  })

  test('switches at once when nothing would be discarded, staying on a DAG-independent view', async () => {
    const { api, pushSpy } = await setup('/history-execution')
    await api.request('stock_dag')
    await flushPromises()
    expect(store.setActiveSchema).toHaveBeenCalledWith('stock_dag')
    expect(pushSpy).not.toHaveBeenCalled()
  })

  test('picking the active DAG changes nothing', async () => {
    const { api } = await setup()
    await api.request('planning_dag')
    expect(store.setActiveSchema).not.toHaveBeenCalled()
  })

  test('after switching, stays on a view the new DAG also has', async () => {
    const { api, pushSpy } = await setup('/my-dashboard')
    await api.request('stock_dag')
    await flushPromises()
    expect(pushSpy).not.toHaveBeenCalled()
  })

  test("after switching, leaves a view gated to the previous DAG for the new DAG's default view", async () => {
    const { api, pushSpy } = await setup('/planning-board')
    await api.request('stock_dag')
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  test('asks before switching when executions are open, and does nothing on cancel', async () => {
    store.loadedExecutions = [{ executionId: 'e1' }] as any
    const { api } = await setup()
    await api.request('stock_dag')
    expect(api.confirming.value).toBe(true)
    expect(store.setActiveSchema).not.toHaveBeenCalled()

    api.cancel()
    await api.confirm()
    expect(api.confirming.value).toBe(false)
    expect(store.setActiveSchema).not.toHaveBeenCalled()
  })

  test('asks before switching while an execution is being created', async () => {
    const { api } = await setup('/project-execution')
    await api.request('stock_dag')
    expect(api.confirming.value).toBe(true)
  })

  test('switches once the change is confirmed', async () => {
    store.loadedExecutions = [{ executionId: 'e1' }] as any
    const { api } = await setup()
    await api.request('stock_dag')
    await api.confirm()
    expect(store.setActiveSchema).toHaveBeenCalledWith('stock_dag')
  })
})
