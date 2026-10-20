import { describe, test, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { useClickOutside } from '@cornflow-ui/core/composables/useClickOutside'

describe('useClickOutside', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const createWrapper = (isOpen: () => boolean = () => true) => {
    const onOutside = vi.fn()
    const Host = defineComponent({
      setup() {
        const target = ref<HTMLElement | null>(null)
        useClickOutside(target, isOpen, onOutside)
        return { target }
      },
      template: '<div ref="target" class="target"><span class="inner" /></div>',
    })
    const wrapper = mount(Host, { attachTo: document.body })
    return { wrapper, onOutside }
  }

  const pointerdown = (el: Element) =>
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

  test('calls onOutside on a pointerdown outside the target', () => {
    const { onOutside } = createWrapper()
    const outside = document.createElement('div')
    document.body.appendChild(outside)

    pointerdown(outside)

    expect(onOutside).toHaveBeenCalledTimes(1)
  })

  test('ignores a pointerdown on the target or inside it', () => {
    const { wrapper, onOutside } = createWrapper()

    pointerdown(wrapper.element)
    pointerdown(wrapper.find('.inner').element)

    expect(onOutside).not.toHaveBeenCalled()
  })

  test('does nothing while isOpen() is false', () => {
    const { onOutside } = createWrapper(() => false)

    pointerdown(document.body)

    expect(onOutside).not.toHaveBeenCalled()
  })

  test('still sees a pointerdown whose propagation is stopped (capture phase)', () => {
    const { onOutside } = createWrapper()
    const outside = document.createElement('div')
    outside.addEventListener('pointerdown', (e) => e.stopPropagation())
    document.body.appendChild(outside)

    pointerdown(outside)

    expect(onOutside).toHaveBeenCalledTimes(1)
  })

  test('stops listening once unmounted', () => {
    const { wrapper, onOutside } = createWrapper()

    wrapper.unmount()
    pointerdown(document.body)

    expect(onOutside).not.toHaveBeenCalled()
  })
})
