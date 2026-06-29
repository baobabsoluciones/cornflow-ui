import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useTableHeight } from '@/composables/core-table/useTableHeight'

/**
 * Mounts the composable inside a real component so onMounted/onUnmounted fire,
 * exposing the returned API plus the wrapper for cleanup.
 */
function withTableHeight() {
  let api: ReturnType<typeof useTableHeight>
  const Comp = defineComponent({
    setup() {
      api = useTableHeight()
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { api: api!, wrapper }
}

// jsdom doesn't implement layout; stub getBoundingClientRect per element.
function rect(el: HTMLElement, r: Partial<DOMRect>) {
  el.getBoundingClientRect = () =>
    ({ top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}), ...r }) as DOMRect
}

const RealRO = global.ResizeObserver
const RealMO = global.MutationObserver

beforeEach(() => {
  document.body.className = ''
  document.body.innerHTML = ''
  // Provide observers usable by the composable.
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
})

afterEach(() => {
  global.ResizeObserver = RealRO
  global.MutationObserver = RealMO
  vi.restoreAllMocks()
})

describe('useTableHeight - exposed defaults', () => {
  test('initial tableHeight and null container', () => {
    const { api, wrapper } = withTableHeight()
    expect(api.tableHeight.value).toBe(400)
    expect(api.tableContainer.value).toBeNull()
    wrapper.unmount()
  })

  test('calculateTableHeight no-ops without a container', () => {
    const { api, wrapper } = withTableHeight()
    api.calculateTableHeight()
    expect(api.tableHeight.value).toBe(400)
    wrapper.unmount()
  })
})

describe('useTableHeight - normal viewport calculation', () => {
  test('computes height from viewport and updates when change > 5', () => {
    const { api, wrapper } = withTableHeight()

    const container = document.createElement('div')
    const parent = document.createElement('div')
    parent.classList.add('core-table-container')
    parent.appendChild(container)
    document.body.appendChild(parent)

    rect(container, { top: 100 })
    // window.innerHeight default in jsdom is 768
    api.tableContainer.value = container
    api.calculateTableHeight()

    // availableHeight = 768 - 100 - bottomOffset(75 for <800) = 593, min 300 -> 593
    expect(api.tableHeight.value).toBe(593)
    wrapper.unmount()
  })

  test('applies minimum height when available space is tiny', () => {
    const { api, wrapper } = withTableHeight()
    const container = document.createElement('div')
    document.body.appendChild(container)
    rect(container, { top: 760 })
    api.tableContainer.value = container
    api.calculateTableHeight()
    // 768-760-75 negative -> clamped to min (300 for 768 viewport)
    expect(api.tableHeight.value).toBe(300)
    wrapper.unmount()
  })
})

describe('useTableHeight - fullscreen calculation', () => {
  test('uses fullscreen-body bounds when maximized', () => {
    const { api, wrapper } = withTableHeight()
    document.body.classList.add('fullscreen-overlay-active')

    const fsBody = document.createElement('div')
    fsBody.classList.add('fullscreen-body')
    const container = document.createElement('div')
    fsBody.appendChild(container)
    document.body.appendChild(fsBody)

    rect(container, { top: 50 })
    rect(fsBody, { bottom: 900 })

    api.tableContainer.value = container
    api.calculateTableHeight()
    // 900 - 50 - 20 buffer = 830, clamped within [min, 2000]
    expect(api.tableHeight.value).toBe(830)
    wrapper.unmount()
  })
})

describe('useTableHeight - panel/searchbar height helpers via calculation paths', () => {
  test('reads filters panel and search bar heights through container chain', () => {
    const { api, wrapper } = withTableHeight()

    const coreContainer = document.createElement('div')
    coreContainer.classList.add('core-table-container')

    const filters = document.createElement('div')
    filters.classList.add('core-filters-panel')
    rect(filters, { height: 120 })
    coreContainer.appendChild(filters)

    const searchBar = document.createElement('div')
    searchBar.classList.add('d-flex', 'justify-space-between')
    rect(searchBar, { height: 40 })
    coreContainer.appendChild(searchBar)

    const container = document.createElement('div')
    coreContainer.appendChild(container)
    document.body.appendChild(coreContainer)
    rect(container, { top: 100 })

    api.tableContainer.value = container
    // Should run without error, exercising getFiltersPanelHeight & getSearchBarHeight.
    api.calculateTableHeight()
    expect(api.tableHeight.value).toBeGreaterThan(0)
    wrapper.unmount()
  })
})

describe('useTableHeight - initializeHeight & observers', () => {
  test('initializeHeight wires observers without throwing', async () => {
    const { api, wrapper } = withTableHeight()

    const scrollable = document.createElement('div')
    scrollable.classList.add('view-container')
    const coreContainer = document.createElement('div')
    coreContainer.classList.add('core-table-container')
    const container = document.createElement('div')
    coreContainer.appendChild(container)
    scrollable.appendChild(coreContainer)
    document.body.appendChild(scrollable)
    rect(container, { top: 100 })

    api.tableContainer.value = container
    api.initializeHeight()
    // flush nextTick + timers
    await Promise.resolve()
    expect(api.tableHeight.value).toBeGreaterThan(0)
    wrapper.unmount()
  })

  test('unmount triggers cleanup without errors', () => {
    const { api, wrapper } = withTableHeight()
    const container = document.createElement('div')
    document.body.appendChild(container)
    api.tableContainer.value = container
    api.initializeHeight()
    expect(() => wrapper.unmount()).not.toThrow()
  })
})
