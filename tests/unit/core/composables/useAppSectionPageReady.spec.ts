import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { defineComponent, h, nextTick, onMounted, provide, ref, KeepAlive } from 'vue'
import { mount } from '@vue/test-utils'
import {
  APP_SECTION_PAGE_READY_KEY,
  useAppSectionPageReady,
} from '@/composables/useAppSectionPageReady'

vi.mock('@/app/config', () => ({
  default: {
    isAppSectionShowsLoadingOnEnter: vi.fn(
      (path: string) => path === '/loading-view',
    ),
  },
}))

function createTestRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/loading-view',
        name: 'LoadingView',
        component: { template: '<div />' },
      },
      {
        path: '/other-view',
        name: 'OtherView',
        component: { template: '<div />' },
      },
    ],
  })
}

describe('useAppSectionPageReady', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('calls injected setPageReady handler', async () => {
    let readyCalled = false
    const setPageReady = () => {
      readyCalled = true
    }
    const router = createTestRouter()
    await router.push('/loading-view')
    await router.isReady()

    const Child = defineComponent({
      setup() {
        const { setPageReady: markReady } = useAppSectionPageReady()
        markReady()
        return () => h('div')
      },
    })

    const Parent = defineComponent({
      setup() {
        provide(APP_SECTION_PAGE_READY_KEY, setPageReady)
        return () => h(Child)
      },
    })

    mount(Parent, {
      global: {
        plugins: [router],
      },
    })
    expect(readyCalled).toBe(true)
  })

  test('setPageReady is a no-op without provider', async () => {
    const router = createTestRouter()
    await router.push('/loading-view')
    await router.isReady()

    const Child = defineComponent({
      setup() {
        const { setPageReady } = useAppSectionPageReady()
        expect(() => setPageReady()).not.toThrow()
        return () => h('div')
      },
    })

    mount(Child, {
      global: {
        plugins: [router],
      },
    })
  })

  test('setPageReady is ignored when route does not use showsLoadingOnEnter', async () => {
    let readyCalled = false
    const setPageReady = () => {
      readyCalled = true
    }
    const router = createTestRouter()
    await router.push('/other-view')
    await router.isReady()

    const Child = defineComponent({
      setup() {
        const { setPageReady: markReady } = useAppSectionPageReady()
        markReady()
        return () => h('div')
      },
    })

    mount(Child, {
      global: {
        plugins: [router],
        provide: {
          [APP_SECTION_PAGE_READY_KEY]: setPageReady,
        },
      },
    })

    expect(readyCalled).toBe(false)
  })

  test('setPageReady is ignored when the view is deactivated', async () => {
    let readyCalled = false
    const setPageReady = () => {
      readyCalled = true
    }
    const router = createTestRouter()
    await router.push('/loading-view')
    await router.isReady()

    const activeView = ref('loading-view')

    const LoadingView = defineComponent({
      name: 'LoadingView',
      setup() {
        const { setPageReady: markReady } = useAppSectionPageReady()

        onMounted(async () => {
          activeView.value = 'other-view'
          await nextTick()
          markReady()
        })

        return () => h('div', 'loading-view')
      },
    })

    const OtherView = defineComponent({
      name: 'OtherView',
      setup() {
        return () => h('div', 'other-view')
      },
    })

    const Parent = defineComponent({
      setup() {
        provide(APP_SECTION_PAGE_READY_KEY, setPageReady)
        return () =>
          h(KeepAlive, null, {
            default: () =>
              activeView.value === 'loading-view'
                ? h(LoadingView)
                : h(OtherView),
          })
      },
    })

    mount(Parent, {
      global: {
        plugins: [router],
      },
    })
    await nextTick()
    await nextTick()

    expect(readyCalled).toBe(false)
  })
})
