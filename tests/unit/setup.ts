import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach } from 'vitest'

enableAutoUnmount(afterEach)

// Mock ResizeObserver which is used by Vuetify
class MockResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  
  disconnect() {}
  
  observe(element: Element) {
    this.callback([
      {
        target: element,
        contentRect: {
          bottom: 0,
          height: 0,
          left: 0,
          right: 0,
          top: 0,
          width: 0,
          x: 0,
          y: 0,
        },
      } as unknown as ResizeObserverEntry,
    ], this as unknown as ResizeObserver);
  }
  
  unobserve() {}
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Set up any global test utilities here
