import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@cornflow-ui/core/plugins/locales/en'
import DraftBanner from '@cornflow-ui/core/components/create-execution/DraftBanner.vue'
import type { ExecutionDraft } from '@cornflow-ui/core/composables/create-execution/executionDraftStore'

const draft = (overrides: Partial<ExecutionDraft> = {}): ExecutionDraft => ({
  savedAt: new Date(2026, 9, 30, 9, 15).toISOString(),
  name: 'Week 44',
  description: '',
  config: {},
  instanceData: null,
  files: [],
  loadedFileNames: [],
  loadedFilters: null,
  fromExecution: null,
  pendingChanges: null,
  pendingChangesCount: 0,
  ...overrides,
})

const mountBanner = (props: Partial<ExecutionDraft> = {}) =>
  mount(DraftBanner, {
    props: { draft: draft(props) },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  })

const meta = (wrapper: ReturnType<typeof mountBanner>) => wrapper.find('.draft-banner__meta').text()

describe('DraftBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 30, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('says a draft is waiting, with its name and the time it was saved today', () => {
    const wrapper = mountBanner()
    const time = new Date(2026, 9, 30, 9, 15).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })

    expect(wrapper.text()).toContain('You have an unfinished execution')
    expect(meta(wrapper)).toBe(`Week 44 · saved today at ${time}`)
  })

  test('gives the date of a draft saved another day', () => {
    const saved = new Date(2026, 9, 27, 18, 40)
    const wrapper = mountBanner({ savedAt: saved.toISOString() })

    expect(meta(wrapper)).toBe('Week 44 · saved on 10/27/2026 at 06:40 PM')
  })

  test('names a draft without a name as unnamed, and says when it has edits not applied', () => {
    const wrapper = mountBanner({ name: '', pendingChangesCount: 3 })

    expect(meta(wrapper)).toMatch(/^Unnamed · saved today at .+ · with changes not applied$/)
  })

  test('continues or discards the draft', async () => {
    const wrapper = mountBanner()

    await wrapper.find('[data-testid="draft-banner-resume"]').trigger('click')
    const discard = wrapper.findAll('button').find((button) => button.text() === 'Discard')!
    await discard.trigger('click')

    expect(wrapper.emitted('resume')).toHaveLength(1)
    expect(wrapper.emitted('discard')).toHaveLength(1)
  })
})
