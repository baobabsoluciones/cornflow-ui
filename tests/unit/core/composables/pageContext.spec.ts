import { describe, test, expect, vi, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import {
  askAboutPageContext,
  onAskAboutPageContext,
  registerPageContext,
  usePageContext,
  usePageContexts,
  type PageContextEntry,
} from '@cornflow-ui/core/composables/pageContext'

const entry = (id: string, extra: Partial<PageContextEntry> = {}): PageContextEntry => ({
  id,
  kind: 'widget',
  title: `Title ${id}`,
  snapshot: () => ({ id }),
  ...extra,
})

const cleanups: Array<() => void> = []
const register = (e: PageContextEntry) => {
  const off = registerPageContext(e)
  cleanups.push(off)
  return off
}
const ids = () => usePageContexts().value.map((e) => e.id)

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

describe('page context registry', () => {
  test('lists the registered entries in registration order and reads their snapshot', () => {
    register(entry('a'))
    register(entry('b', { kind: 'view' }))
    expect(ids()).toEqual(['a', 'b'])
    expect(usePageContexts().value[1].kind).toBe('view')
    expect(usePageContexts().value[0].snapshot()).toEqual({ id: 'a' })
  })

  test('the list a consumer holds updates reactively', async () => {
    const list = usePageContexts()
    const seen = list
    register(entry('a'))
    await nextTick()
    expect(seen.value.map((e) => e.id)).toEqual(['a'])
  })

  test('unregister removes the entry; calling it twice is harmless', () => {
    const off = register(entry('a'))
    register(entry('b'))
    off()
    off()
    expect(ids()).toEqual(['b'])
  })

  test('registering an id again replaces the entry and keeps its place', () => {
    register(entry('a', { title: 'Old' }))
    register(entry('b'))
    register(entry('a', { title: 'New' }))
    expect(ids()).toEqual(['a', 'b'])
    expect(usePageContexts().value[0].title).toBe('New')
  })

  test('the unregister of a replaced entry does not remove its replacement', () => {
    const offOld = register(entry('a', { title: 'Old' }))
    register(entry('a', { title: 'New' }))
    offOld()
    expect(usePageContexts().value.map((e) => e.title)).toEqual(['New'])
  })

  test('asking about an entry calls every listener with it', () => {
    const one = vi.fn()
    const two = vi.fn()
    cleanups.push(onAskAboutPageContext(one), onAskAboutPageContext(two))
    register(entry('a'))
    askAboutPageContext('a')
    expect(one).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', title: 'Title a' }))
    expect(two).toHaveBeenCalledTimes(1)
  })

  test('asking about an id that is not registered does nothing', () => {
    const fn = vi.fn()
    cleanups.push(onAskAboutPageContext(fn))
    askAboutPageContext('ghost')
    expect(fn).not.toHaveBeenCalled()
  })

  test('a listener stops hearing after it unsubscribes', () => {
    const fn = vi.fn()
    const off = onAskAboutPageContext(fn)
    register(entry('a'))
    off()
    askAboutPageContext('a')
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('usePageContext', () => {
  test('a component is listed while it is mounted', async () => {
    const Widget = defineComponent({
      setup() {
        usePageContext(entry('results.chart', { title: 'Chart' }))
        return () => h('div')
      },
    })
    const wrapper = mount(Widget)
    expect(ids()).toEqual(['results.chart'])

    wrapper.unmount()
    expect(ids()).toEqual([])
  })
})
