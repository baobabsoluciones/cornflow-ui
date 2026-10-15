import { describe, test, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ModuleSwitcher from '@cornflow-ui/core/components/core/ModuleSwitcher.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

const mockConfig = vi.hoisted(() => ({
  schema: 'planning_dag',
  schemas: ['planning_dag', 'stock_dag'] as string[],
  auth: { type: 'cornflow' },
  initConfig: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@cornflow-ui/core/config', () => ({ default: mockConfig }))

const mockParameters = vi.hoisted(() => ({
  schemaLabels: {
    planning_dag: 'Planning',
    stock_dag: 'labels.stock',
  } as Record<string, string>,
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

/** Stand-in for mango-vue's modal: shows its content while open and lets a test press its buttons. */
const MBaseModalStub = defineComponent({
  name: 'MBaseModal',
  props: { modelValue: Boolean, title: String },
  emits: ['save', 'cancel', 'close', 'update:modelValue'],
  setup(props, { slots }) {
    return () =>
      props.modelValue
        ? h('div', { 'data-testid': 'confirm-modal' }, [
            props.title,
            slots.content?.(),
          ])
        : null
  },
})

/**
 * Stand-in for Vuetify's menu (an overlay jsdom cannot position): the activator toggles the
 * content, rendered in place so a test can click its options.
 */
const VMenuStub = defineComponent({
  name: 'VMenu',
  setup(_, { slots }) {
    const open = ref(false)
    return () =>
      h('div', [
        slots.activator?.({
          props: { onClick: () => (open.value = !open.value) },
          isActive: open.value,
        }),
        open.value ? slots.default?.() : null,
      ])
  },
})

async function mountSwitcher(path = '/history-execution') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/history-execution', component: { template: '<div />' } },
      { path: '/project-execution', component: { template: '<div />' } },
      { path: '/my-dashboard', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const pushSpy = vi.spyOn(router, 'push')

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        labels: { stock: 'Stock' },
        modules: { label: 'Module', switchTitle: 'Change module?' },
      },
    },
  })

  const wrapper = mount(ModuleSwitcher, {
    global: {
      plugins: [createVuetify({ components, directives }), i18n, router],
      stubs: { MBaseModal: MBaseModalStub, VMenu: VMenuStub },
    },
  })
  return { wrapper, pushSpy }
}

const segment = (wrapper: any, schema: string) =>
  wrapper.find(`[data-testid="module-switcher-${schema}"]`)

describe('ModuleSwitcher', () => {
  let store: ReturnType<typeof useGeneralStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockConfig.schemas = ['planning_dag', 'stock_dag']
    store = useGeneralStore()
    store.availableSchemas = ['planning_dag', 'stock_dag']
    store.setActiveSchema = vi.fn().mockResolvedValue(true) as any
  })

  test('offers the DAGs the user may switch to, with their labels', async () => {
    const { wrapper } = await mountSwitcher()

    expect(segment(wrapper, 'planning_dag').text()).toBe('Planning')
    expect(segment(wrapper, 'stock_dag').text()).toBe('Stock')
    expect(segment(wrapper, 'planning_dag').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(segment(wrapper, 'stock_dag').attributes('aria-pressed')).toBe(
      'false',
    )
  })

  test('renders nothing for a user who cannot switch', async () => {
    store.availableSchemas = ['planning_dag']
    const { wrapper } = await mountSwitcher()

    expect(wrapper.find('[data-testid="module-switcher"]').exists()).toBe(false)
  })

  test('switches at once when nothing would be discarded, staying on a DAG-independent view', async () => {
    const { wrapper, pushSpy } = await mountSwitcher('/history-execution')

    await segment(wrapper, 'stock_dag').trigger('click')
    await flushPromises()

    expect(store.setActiveSchema).toHaveBeenCalledWith('stock_dag')
    expect(pushSpy).not.toHaveBeenCalled()
  })

  test('picking the active DAG changes nothing', async () => {
    const { wrapper } = await mountSwitcher()

    await segment(wrapper, 'planning_dag').trigger('click')
    await flushPromises()

    expect(store.setActiveSchema).not.toHaveBeenCalled()
  })

  test('after switching, leaves a view that may not exist in the new DAG', async () => {
    const { wrapper, pushSpy } = await mountSwitcher('/my-dashboard')

    await segment(wrapper, 'stock_dag').trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  test('asks before switching when executions are open, and does nothing on cancel', async () => {
    store.loadedExecutions = [{ executionId: 'e1' }] as any
    const { wrapper } = await mountSwitcher()

    await segment(wrapper, 'stock_dag').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="confirm-modal"]').text()).toContain(
      'Change module?',
    )
    expect(store.setActiveSchema).not.toHaveBeenCalled()

    wrapper.findComponent(MBaseModalStub).vm.$emit('cancel')
    await flushPromises()
    expect(store.setActiveSchema).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
  })

  test('asks before switching while an execution is being created', async () => {
    const { wrapper } = await mountSwitcher('/project-execution')

    await segment(wrapper, 'stock_dag').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(true)
  })

  test('switches once the change is confirmed', async () => {
    store.loadedExecutions = [{ executionId: 'e1' }] as any
    const { wrapper } = await mountSwitcher()

    await segment(wrapper, 'stock_dag').trigger('click')
    wrapper.findComponent(MBaseModalStub).vm.$emit('save')
    await flushPromises()

    expect(store.setActiveSchema).toHaveBeenCalledWith('stock_dag')
  })

  test('offers the DAGs in a menu when there are more than fit side by side', async () => {
    const schemas = ['planning_dag', 'stock_dag', 'dag_3', 'dag_4', 'dag_5']
    mockConfig.schemas = schemas
    store.availableSchemas = schemas
    const { wrapper } = await mountSwitcher()

    expect(wrapper.find('[role="group"]').exists()).toBe(false)
    const trigger = wrapper.find('[data-testid="module-switcher-trigger"]')
    expect(trigger.text()).toContain('Planning')

    await trigger.trigger('click')
    await segment(wrapper, 'dag_5').trigger('click')
    await flushPromises()

    expect(store.setActiveSchema).toHaveBeenCalledWith('dag_5')
  })
})
