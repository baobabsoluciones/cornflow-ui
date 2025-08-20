import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach } from 'vitest'

enableAutoUnmount(afterEach)

/* With jest-dom the resizeObserver seems to not be included, it is used by Vuetify so we have
   to include it somehow for tests.
*/
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback
  }
  disconnect() {}
  observe(element) {
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
      },
    ])
  }
  unobserve() {}
}
