import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  defineComponent,
  h,
  KeepAlive,
  nextTick,
  onActivated,
  onMounted,
  reactive,
  ref,
} from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

// Every flow counts its mounts and activations, so a test can tell a kept flow from a new one.
const lifecycle = vi.hoisted(() => ({
  mounted: [] as string[],
  activated: [] as string[],
}))

function flow(name: string) {
  return defineComponent({
    name,
    setup() {
      onMounted(() => lifecycle.mounted.push(name))
      onActivated(() => lifecycle.activated.push(name))
      return () => h('div', { class: 'flow' }, name)
    },
  })
}

vi.mock('@cornflow-ui/core/views/CreateExecutionView.vue', async () => {
  const { defineComponent, h, onActivated, onMounted } = await import('vue')
  return {
    default: defineComponent({
      name: 'CreateExecutionView',
      setup() {
        onMounted(() => lifecycle.mounted.push('CreateExecutionView'))
        onActivated(() => lifecycle.activated.push('CreateExecutionView'))
        return () => h('div', { class: 'flow' }, 'CreateExecutionView')
      },
    }),
  }
})

// The store: the active DAG and its settings, as `applyAppConfigForSchema` leaves them.
const store = vi.hoisted(() => ({ current: null as any }))
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => store.current,
}))

import CreateExecutionFlowView from '@cornflow-ui/core/views/CreateExecutionFlowView.vue'

/** Enters `schema` with `component` as its create-execution flow (null: none declared). */
function enter(schema: string, component: (() => Promise<unknown>) | null) {
  store.current.getSchemaName = schema
  store.current.appConfig.parameters.createExecution = {
    component,
    proposeName: null,
  }
}

async function mountRoute() {
  const wrapper = mount(CreateExecutionFlowView)
  await flushPromises()
  return wrapper
}

describe('CreateExecutionFlowView', () => {
  beforeEach(() => {
    lifecycle.mounted = []
    lifecycle.activated = []
    store.current = reactive({
      getSchemaName: 'dag_a',
      appConfig: {
        parameters: { createExecution: { component: null, proposeName: null } },
      },
    })
  })

  test("shows core's page when neither the DAG nor the app declares a flow", async () => {
    const wrapper = await mountRoute()

    expect(wrapper.text()).toBe('CreateExecutionView')
  })

  test('shows the flow the settings of the active DAG declare', async () => {
    enter('dag_a', () =>
      Promise.resolve({ __esModule: true, default: flow('FlowOfDagA') }),
    )

    const wrapper = await mountRoute()

    expect(wrapper.text()).toBe('FlowOfDagA')
  })

  test('entering another DAG shows the flow of that DAG', async () => {
    enter('dag_a', () => Promise.resolve(flow('FlowOfDagA')))
    const wrapper = await mountRoute()

    enter('dag_b', null)
    await flushPromises()

    expect(wrapper.text()).toBe('CreateExecutionView')

    enter('dag_a', () => Promise.resolve(flow('FlowOfDagA')))
    await flushPromises()

    expect(wrapper.text()).toBe('FlowOfDagA')
  })

  test('mounts a new flow when the DAG changes, even when both DAGs use the same one', async () => {
    const shared = () => Promise.resolve(flow('SharedFlow'))
    enter('dag_a', shared)
    await mountRoute()

    enter('dag_b', shared)
    await flushPromises()

    expect(lifecycle.mounted).toEqual(['SharedFlow', 'SharedFlow'])
  })

  test('keeps the flow while the settings of the same DAG are resolved again', async () => {
    const loader = () => Promise.resolve(flow('FlowOfDagA'))
    enter('dag_a', loader)
    await mountRoute()

    enter('dag_a', loader)
    await flushPromises()

    expect(lifecycle.mounted).toEqual(['FlowOfDagA'])
  })

  test("inside the route's keep-alive, the flow is kept and activated again on return", async () => {
    const shown = ref(true)
    const Other = defineComponent({
      name: 'OtherView',
      render: () => h('div', 'other'),
    })
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(KeepAlive, null, [
            shown.value ? h(CreateExecutionFlowView) : h(Other),
          ]),
      }),
    )
    await flushPromises()

    shown.value = false
    await nextTick()
    shown.value = true
    await nextTick()

    expect(wrapper.text()).toBe('CreateExecutionView')
    expect(lifecycle.mounted).toEqual(['CreateExecutionView'])
    expect(lifecycle.activated).toEqual([
      'CreateExecutionView',
      'CreateExecutionView',
    ])
  })
})
