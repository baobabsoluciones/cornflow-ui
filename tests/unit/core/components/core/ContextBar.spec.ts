import { describe, test, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ContextBar from '@cornflow-ui/core/components/core/ContextBar.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

const mockConfig = vi.hoisted(() => ({
  schema: 'planning_dag',
  schemas: ['planning_dag', 'stock_dag'] as string[],
  auth: { type: 'cornflow' },
  initConfig: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@cornflow-ui/core/config', () => ({ default: mockConfig }))

const mockParameters = vi.hoisted(() => ({
  schemaLabels: { planning_dag: 'Planning', stock_dag: 'labels.stock' } as Record<string, string>,
  globalContext: [] as unknown[],
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

const PLANT = {
  key: 'plant_id',
  labelKey: 'labels.plant',
  optionsEndpoint: '/user/plants/',
  valueField: 'plant_id',
}

/** Stand-in for mango-vue's modal: shows its content while open and lets a test press its buttons. */
const MBaseModalStub = defineComponent({
  name: 'MBaseModal',
  props: { modelValue: Boolean, title: String },
  emits: ['save', 'cancel', 'close', 'update:modelValue'],
  setup(props, { slots }) {
    return () =>
      props.modelValue
        ? h('div', { 'data-testid': 'confirm-modal' }, [props.title, slots.content?.()])
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

async function mountBar(path = '/history-execution') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/history-execution', component: { template: '<div />' } },
      { path: '/project-execution', component: { template: '<div />' } },
      { path: '/results/:tableKey', component: { template: '<div />' } },
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
        labels: { stock: 'Stock', plant: 'Plant' },
        contextBar: {
          module: 'Module',
          all: 'All',
          noOptions: 'None available',
          switchModuleTitle: 'Change module?',
          changeContextTitle: 'Change selection?',
        },
      },
    },
  })

  const wrapper = mount(ContextBar, {
    global: {
      plugins: [createVuetify({ components, directives }), i18n, router],
      stubs: { MBaseModal: MBaseModalStub, VMenu: VMenuStub },
    },
  })
  return { wrapper, pushSpy }
}

describe('ContextBar', () => {
  let store: ReturnType<typeof useGeneralStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockParameters.globalContext = []
    store = useGeneralStore()
    store.availableSchemas = ['planning_dag', 'stock_dag']
    store.setActiveSchema = vi.fn().mockResolvedValue(true) as any
    store.setGlobalContextValue = vi.fn().mockResolvedValue(true) as any
  })

  describe('module', () => {
    test('offers the DAGs the user may switch to, with their labels', async () => {
      const { wrapper } = await mountBar()

      expect(wrapper.find('[data-testid="context-bar-schema-planning_dag"]').text()).toBe('Planning')
      expect(wrapper.find('[data-testid="context-bar-schema-stock_dag"]').text()).toBe('Stock')
    })

    test('shows the DAG as a label when the user has only one', async () => {
      store.availableSchemas = ['planning_dag']
      const { wrapper } = await mountBar()

      expect(wrapper.find('[data-testid="context-bar-schema-stock_dag"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="context-bar-module"]').text()).toContain('Planning')
    })

    test('switches at once when nothing would be discarded, staying on a DAG-independent view', async () => {
      const { wrapper, pushSpy } = await mountBar('/history-execution')

      await wrapper.find('[data-testid="context-bar-schema-stock_dag"]').trigger('click')
      await flushPromises()

      expect(store.setActiveSchema).toHaveBeenCalledWith('stock_dag')
      expect(pushSpy).not.toHaveBeenCalled()
    })

    test('after switching, leaves a view that may not exist in the new DAG', async () => {
      const { wrapper, pushSpy } = await mountBar('/my-dashboard')

      await wrapper.find('[data-testid="context-bar-schema-stock_dag"]').trigger('click')
      await flushPromises()

      expect(pushSpy).toHaveBeenCalledWith('/')
    })

    test('asks before switching when executions are open, and does nothing on cancel', async () => {
      store.loadedExecutions = [{ executionId: 'e1' }] as any
      const { wrapper } = await mountBar()

      await wrapper.find('[data-testid="context-bar-schema-stock_dag"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="confirm-modal"]').text()).toContain('Change module?')
      expect(store.setActiveSchema).not.toHaveBeenCalled()

      wrapper.findComponent(MBaseModalStub).vm.$emit('cancel')
      await flushPromises()
      expect(store.setActiveSchema).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
    })

    test('switches once the change is confirmed', async () => {
      store.loadedExecutions = [{ executionId: 'e1' }] as any
      const { wrapper } = await mountBar()

      await wrapper.find('[data-testid="context-bar-schema-stock_dag"]').trigger('click')
      wrapper.findComponent(MBaseModalStub).vm.$emit('save')
      await flushPromises()

      expect(store.setActiveSchema).toHaveBeenCalledWith('stock_dag')
    })

    test('is hidden in a single-DAG deployment', async () => {
      store.availableSchemas = []
      const { wrapper } = await mountBar()

      expect(wrapper.find('[data-testid="context-bar-module"]').exists()).toBe(false)
    })
  })

  describe('global context', () => {
    const twoPlants = [
      { value: '102', title: 'North' },
      { value: '103', title: 'South' },
    ]

    /** Opens the dimension menu and clicks one of its options. */
    async function pick(wrapper: any, optionValue: string) {
      await wrapper.find('[data-testid="context-bar-trigger-plant_id"]').trigger('click')
      const option = wrapper.find(`[data-testid="context-bar-option-plant_id-${optionValue}"]`)
      await option.trigger('click')
      await flushPromises()
      return option
    }

    beforeEach(() => {
      mockParameters.globalContext = [PLANT]
      store.availableSchemas = []
    })

    test('offers a menu with the values the user may pick, showing the picked one', async () => {
      store.globalContextOptions = { plant_id: twoPlants }
      store.globalContext = { plant_id: '102' }
      const { wrapper } = await mountBar()

      const group = wrapper.find('[data-testid="context-bar-dimension-plant_id"]')
      expect(group.text()).toContain('Plant')
      expect(group.find('[data-testid="context-bar-trigger-plant_id"]').text()).toContain('North')

      const option = await pick(wrapper, '103')

      expect(option.text()).toContain('South')
      expect(store.setGlobalContextValue).toHaveBeenCalledWith('plant_id', '103')
    })

    test('picking the value already picked changes nothing', async () => {
      store.globalContextOptions = { plant_id: twoPlants }
      store.globalContext = { plant_id: '102' }
      const { wrapper } = await mountBar()

      await pick(wrapper, '102')

      expect(store.setGlobalContextValue).not.toHaveBeenCalled()
    })

    test('with allowEmpty it offers "All", sent to the store as null', async () => {
      mockParameters.globalContext = [{ ...PLANT, allowEmpty: true }]
      store.globalContextOptions = { plant_id: [{ value: '102', title: 'North' }] }
      store.globalContext = { plant_id: '102' }
      const { wrapper } = await mountBar()

      const option = await pick(wrapper, 'null')

      expect(option.text()).toContain('All')
      expect(store.setGlobalContextValue).toHaveBeenCalledWith('plant_id', null)
    })

    test('shows the only value as a fixed label, without a menu', async () => {
      store.globalContextOptions = { plant_id: [{ value: '101', title: 'East' }] }
      store.globalContext = { plant_id: '101' }
      const { wrapper } = await mountBar()

      expect(wrapper.find('[data-testid="context-bar-trigger-plant_id"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="context-bar-dimension-plant_id"]').text()).toContain(
        'East',
      )
    })

    test('leaves a view of the loaded execution when the change closed it', async () => {
      store.globalContextOptions = { plant_id: twoPlants }
      store.globalContext = { plant_id: '102' }
      const { wrapper, pushSpy } = await mountBar('/results/stock')

      await pick(wrapper, '103')

      expect(pushSpy).toHaveBeenCalledWith('/')
    })
  })
})
