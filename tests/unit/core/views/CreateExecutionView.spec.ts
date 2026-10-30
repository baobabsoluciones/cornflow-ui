import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@cornflow-ui/core/plugins/locales/en'

const { draft, route, router, guard, store, snackbar, navigation } = vi.hoisted(() => ({
  draft: {} as Record<string, any>,
  route: { query: {} as Record<string, string> },
  router: { push: vi.fn() },
  guard: { leave: null as null | ((to: any, from: any, next: any) => void) },
  store: {
    selectedExecution: null as any,
    setSelectedExecution: vi.fn(),
    getConfigurations: { resultsData: {} },
  },
  snackbar: vi.fn(),
  navigation: { items: [] as any[] },
}))

vi.mock('@cornflow-ui/core/composables/create-execution/useExecutionDraft', () => ({
  useExecutionDraft: () => draft,
}))
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => router,
  onBeforeRouteLeave: (fn: any) => (guard.leave = fn),
}))
vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => store }))
vi.mock('@cornflow-ui/core/services/SnackbarService', () => ({ showSnackbar: snackbar }))
vi.mock('@cornflow-ui/core/services/FrontendAutomationService', () => ({
  getNavigationItemsFromConfig: () => navigation.items,
}))

import CreateExecutionView from '@cornflow-ui/core/views/CreateExecutionView.vue'

const savedDraft = { savedAt: '2026-10-30T09:15:00.000Z', name: 'Week 44', pendingChangesCount: 0 }

function resetDraft(overrides: Record<string, any> = {}) {
  for (const key of Object.keys(draft)) delete draft[key]
  Object.assign(
    draft,
    reactive({
      loadStatus: 'empty',
      files: [],
      isLaunched: false,
      fromExecution: null,
      hasProgress: false,
      launch: { executionId: null },
      readDraft: vi.fn(async () => savedDraft),
      resumeDraft: vi.fn(async () => {}),
      discardDraft: vi.fn(async () => {}),
      saveDraft: vi.fn(async () => true),
      startFrom: vi.fn(),
      reset: vi.fn(),
      ...overrides,
    }),
  )
}

const stubs = {
  CoreTitleView: { template: '<header />' },
  DraftBanner: {
    props: ['draft'],
    emits: ['resume', 'discard'],
    template:
      '<div data-testid="draft-banner"><button data-testid="resume" @click="$emit(\'resume\')" /><button data-testid="discard" @click="$emit(\'discard\')" /></div>',
  },
  ExecutionDataCard: { name: 'ExecutionDataCard', props: ['draft', 'highlight'], template: '<section />' },
  LaunchPanel: {
    name: 'LaunchPanel',
    props: ['draft', 'collapsed'],
    emits: ['update:collapsed', 'go', 'view', 'history'],
    template: '<aside />',
  },
  ExitCreateExecutionDialog: {
    name: 'ExitCreateExecutionDialog',
    props: ['modelValue', 'saving'],
    emits: ['save', 'leave', 'cancel'],
    template: '<div v-if="modelValue" data-testid="exit-dialog" />',
  },
}

const mountView = async () => {
  const wrapper = mount(CreateExecutionView, {
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })], stubs },
  })
  await flushPromises()
  return wrapper
}

const panel = (wrapper: any) => wrapper.findComponent({ name: 'LaunchPanel' })
const exitDialog = (wrapper: any) => wrapper.findComponent({ name: 'ExitCreateExecutionDialog' })
const layoutColumns = (wrapper: any) =>
  (wrapper.find('.create-execution-layout').element as HTMLElement).style.gridTemplateColumns

describe('CreateExecutionView', () => {
  /** Reports a new width of the view, as its ResizeObserver would. */
  let resize: (width: number) => void

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: (entries: any[]) => void) {
          resize = (width) => callback([{ contentRect: { width } }])
        }
        observe() {}
        disconnect() {}
      },
    )
    vi.clearAllMocks()
    resetDraft()
    route.query = {}
    store.selectedExecution = null
    navigation.items = []
    guard.leave = null
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('a saved draft', () => {
    test('is offered when the screen opens empty', async () => {
      const wrapper = await mountView()

      expect(draft.readDraft).toHaveBeenCalled()
      expect(wrapper.find('[data-testid="draft-banner"]').exists()).toBe(true)
    })

    test.each([
      ['data is loaded', { loadStatus: 'loaded' }],
      ['files are picked', { files: [new File(['x'], 'lines.json')] }],
      ['an execution was launched', { isLaunched: true }],
      ['it starts from an execution', { fromExecution: 'exec-1' }],
    ])('is not offered once %s', async (_, state) => {
      resetDraft(state)
      const wrapper = await mountView()

      expect(wrapper.find('[data-testid="draft-banner"]').exists()).toBe(false)
    })

    test('is not offered when there is none', async () => {
      resetDraft({ readDraft: vi.fn(async () => null) })
      const wrapper = await mountView()

      expect(wrapper.find('[data-testid="draft-banner"]').exists()).toBe(false)
    })

    test('continuing it restores it and says so', async () => {
      const wrapper = await mountView()

      await wrapper.find('[data-testid="resume"]').trigger('click')
      await flushPromises()

      expect(draft.resumeDraft).toHaveBeenCalledWith(savedDraft)
      expect(snackbar).toHaveBeenCalledWith('Draft recovered')
      expect(wrapper.find('[data-testid="draft-banner"]').exists()).toBe(false)
    })

    test('discarding it throws it away', async () => {
      const wrapper = await mountView()

      await wrapper.find('[data-testid="discard"]').trigger('click')
      await flushPromises()

      expect(draft.discardDraft).toHaveBeenCalled()
      expect(draft.resumeDraft).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="draft-banner"]').exists()).toBe(false)
    })
  })

  describe('starting from the selected execution', () => {
    test('happens when the screen opens with editInstance', async () => {
      store.selectedExecution = { executionId: 'exec-1' }
      route.query = { editInstance: 'true' }
      await mountView()

      expect(draft.startFrom).toHaveBeenCalledWith(store.selectedExecution)
    })

    test('needs a selected execution', async () => {
      route.query = { editInstance: 'true' }
      await mountView()

      expect(draft.startFrom).not.toHaveBeenCalled()
    })

    test('does not happen without the query', async () => {
      store.selectedExecution = { executionId: 'exec-1' }
      await mountView()

      expect(draft.startFrom).not.toHaveBeenCalled()
    })
  })

  describe('the launch panel', () => {
    test('"what is missing" highlights the data card for a moment and scrolls to it', async () => {
      vi.useFakeTimers()
      const wrapper = await mountView()
      const scrollTo = vi.fn()
      ;(wrapper.find('.create-execution-main').element as HTMLElement).scrollTo = scrollTo

      panel(wrapper).vm.$emit('go')
      await nextTick()

      expect(wrapper.findComponent({ name: 'ExecutionDataCard' }).props('highlight')).toBe(true)
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })

      vi.advanceTimersByTime(1800)
      await nextTick()
      expect(wrapper.findComponent({ name: 'ExecutionDataCard' }).props('highlight')).toBe(false)
    })

    test('collapsed, it leaves the data card the width', async () => {
      const wrapper = await mountView()
      expect(layoutColumns(wrapper)).toBe('minmax(0, 1fr) 380px')

      panel(wrapper).vm.$emit('update:collapsed', true)
      await nextTick()
      expect(layoutColumns(wrapper)).toBe('minmax(0, 1fr) 56px')
    })

    test('does not collapse once the execution is launched', async () => {
      resetDraft({ isLaunched: true })
      const wrapper = await mountView()

      panel(wrapper).vm.$emit('update:collapsed', true)
      await nextTick()
      expect(layoutColumns(wrapper)).toBe('minmax(0, 1fr) 380px')
    })

    test('is narrower when the screen is', async () => {
      const wrapper = await mountView()
      expect(wrapper.classes()).not.toContain('is-narrow')

      resize(1100)
      await nextTick()

      expect(wrapper.classes()).toContain('is-narrow')
      expect(layoutColumns(wrapper)).toBe('minmax(0, 1fr) 320px')
    })

    describe('after launching', () => {
      test('"view result" selects the execution and opens the first results page', async () => {
        navigation.items = [{ title: 'Summary' }, { title: 'Plan', to: '/results/plan' }]
        resetDraft({ launch: { executionId: 'exec-9' } })
        const wrapper = await mountView()

        panel(wrapper).vm.$emit('view')

        expect(store.setSelectedExecution).toHaveBeenCalledWith('exec-9')
        expect(router.push).toHaveBeenCalledWith('/results/plan')
      })

      test('a results group without its own page opens its first page', async () => {
        navigation.items = [{ title: 'Results', subPages: [{ to: '/results/kpis' }] }]
        resetDraft({ launch: { executionId: 'exec-9' } })
        const wrapper = await mountView()

        panel(wrapper).vm.$emit('view')

        expect(router.push).toHaveBeenCalledWith('/results/kpis')
      })

      test('without results pages it opens the output data', async () => {
        resetDraft({ launch: { executionId: 'exec-9' } })
        const wrapper = await mountView()

        panel(wrapper).vm.$emit('view')

        expect(router.push).toHaveBeenCalledWith('/output-data')
      })

      test('"view result" does nothing until there is an execution', async () => {
        const wrapper = await mountView()

        panel(wrapper).vm.$emit('view')

        expect(store.setSelectedExecution).not.toHaveBeenCalled()
        expect(router.push).not.toHaveBeenCalled()
      })

      test('"history" opens the history', async () => {
        const wrapper = await mountView()

        panel(wrapper).vm.$emit('history')

        expect(router.push).toHaveBeenCalledWith('/history-execution')
      })
    })
  })

  describe('leaving', () => {
    const tryToLeave = async () => {
      const next = vi.fn()
      guard.leave!({}, {}, next)
      await nextTick()
      return next
    }

    test('without progress it just leaves', async () => {
      const wrapper = await mountView()

      const next = await tryToLeave()

      expect(next).toHaveBeenCalledWith()
      expect(wrapper.find('[data-testid="exit-dialog"]').exists()).toBe(false)
    })

    test('with progress it asks first', async () => {
      resetDraft({ hasProgress: true })
      const wrapper = await mountView()

      const next = await tryToLeave()

      expect(next).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="exit-dialog"]').exists()).toBe(true)
    })

    test('staying cancels the navigation', async () => {
      resetDraft({ hasProgress: true })
      const wrapper = await mountView()
      const next = await tryToLeave()

      exitDialog(wrapper).vm.$emit('cancel')
      await nextTick()

      expect(next).toHaveBeenCalledWith(false)
      expect(draft.reset).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="exit-dialog"]').exists()).toBe(false)
    })

    test('leaving without saving clears the screen and goes on', async () => {
      resetDraft({ hasProgress: true })
      const wrapper = await mountView()
      const next = await tryToLeave()

      exitDialog(wrapper).vm.$emit('leave')
      await flushPromises()

      expect(draft.saveDraft).not.toHaveBeenCalled()
      expect(draft.reset).toHaveBeenCalled()
      expect(next).toHaveBeenCalledWith()
    })

    test('saving the draft first, then clearing the screen and going on', async () => {
      let finishSave: (saved: boolean) => void = () => {}
      resetDraft({ hasProgress: true, saveDraft: vi.fn(() => new Promise((r) => (finishSave = r))) })
      const wrapper = await mountView()
      const next = await tryToLeave()

      exitDialog(wrapper).vm.$emit('save')
      await nextTick()
      expect(exitDialog(wrapper).props('saving')).toBe(true)
      expect(next).not.toHaveBeenCalled()

      finishSave(true)
      await flushPromises()

      expect(draft.reset).toHaveBeenCalled()
      expect(next).toHaveBeenCalledWith()
    })

    test('a draft that cannot be saved keeps the user here, and says so', async () => {
      resetDraft({ hasProgress: true, saveDraft: vi.fn(async () => false) })
      const wrapper = await mountView()
      const next = await tryToLeave()

      exitDialog(wrapper).vm.$emit('save')
      await flushPromises()

      expect(snackbar).toHaveBeenCalledWith('The draft could not be saved', 'error')
      expect(next).not.toHaveBeenCalled()
      expect(draft.reset).not.toHaveBeenCalled()
      expect(exitDialog(wrapper).props('saving')).toBe(false)
      expect(wrapper.find('[data-testid="exit-dialog"]').exists()).toBe(true)
    })
  })
})
