import { describe, test, expect, beforeEach, vi } from 'vitest'

let onBeforeUnmountCallback = vi.fn()

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onBeforeUnmount: (fn: Function) => {
      onBeforeUnmountCallback.mockImplementation(fn)
    },
  }
})

import { useFullscreen } from '@cornflow-ui/core/composables/useFullscreen'

describe('useFullscreen', () => {
  let fullscreen: ReturnType<typeof useFullscreen>

  beforeEach(() => {
    document.body.style.overflow = ''
    document.body.classList.remove('fullscreen-overlay-active')
    onBeforeUnmountCallback = vi.fn()
    fullscreen = useFullscreen()
  })

  describe('isMaximized', () => {
    test('starts as false', () => {
      expect(fullscreen.isMaximized.value).toBe(false)
    })
  })

  describe('toggleMaximize', () => {
    test('sets isMaximized to true on first call', () => {
      fullscreen.toggleMaximize()
      expect(fullscreen.isMaximized.value).toBe(true)
    })

    test('sets body overflow to hidden when maximized', () => {
      fullscreen.toggleMaximize()
      expect(document.body.style.overflow).toBe('hidden')
    })

    test('adds fullscreen-overlay-active class to body when maximized', () => {
      fullscreen.toggleMaximize()
      expect(
        document.body.classList.contains('fullscreen-overlay-active'),
      ).toBe(true)
    })

    test('toggles back to false on second call', () => {
      fullscreen.toggleMaximize()
      fullscreen.toggleMaximize()
      expect(fullscreen.isMaximized.value).toBe(false)
    })

    test('removes body overflow when not maximized', () => {
      fullscreen.toggleMaximize()
      fullscreen.toggleMaximize()
      expect(document.body.style.overflow).toBe('')
    })

    test('removes fullscreen-overlay-active class when not maximized', () => {
      fullscreen.toggleMaximize()
      fullscreen.toggleMaximize()
      expect(
        document.body.classList.contains('fullscreen-overlay-active'),
      ).toBe(false)
    })
  })

  describe('onBeforeUnmount cleanup', () => {
    test('resets body overflow on unmount', () => {
      fullscreen.toggleMaximize()
      onBeforeUnmountCallback()
      expect(document.body.style.overflow).toBe('')
    })

    test('removes fullscreen-overlay-active class on unmount', () => {
      fullscreen.toggleMaximize()
      onBeforeUnmountCallback()
      expect(
        document.body.classList.contains('fullscreen-overlay-active'),
      ).toBe(false)
    })
  })
})
