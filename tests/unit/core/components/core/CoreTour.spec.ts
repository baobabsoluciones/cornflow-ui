import { describe, test, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CoreTour from '@cornflow-ui/core/components/core/CoreTour.vue'

const labels = {
  progressLabel: 'Step 2 of 3',
  backLabel: 'Back',
  nextLabel: 'Next',
  doneLabel: 'Done',
  closeLabel: 'Close the tour',
}

let wrapper: any

const mountTour = (props: Record<string, unknown> = {}) => {
  wrapper = mount(CoreTour, {
    attachTo: document.body,
    props: { target: null, title: 'The menu', text: 'Everything is here.', index: 1, count: 3, ...labels, ...props },
  })
  return wrapper
}

const card = () => document.querySelector<HTMLElement>('[data-testid="core-tour-card"]')!
const button = (testId: string) => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('CoreTour', () => {
  test('a dialog with the title, the text and how far the tour has gone', async () => {
    mountTour()
    await nextTick()
    expect(card().getAttribute('role')).toBe('dialog')
    expect(document.getElementById(card().getAttribute('aria-labelledby')!)!.textContent).toBe('The menu')
    expect(document.getElementById(card().getAttribute('aria-describedby')!)!.textContent).toBe('Everything is here.')
    expect(card().textContent).toContain('Step 2 of 3')
    expect(document.querySelectorAll('.core-tour__dot')).toHaveLength(3)
    expect(document.querySelectorAll('.core-tour__dot')[1].classList).toContain('is-current')
    expect(document.activeElement).toBe(card())
  })

  test('without an element it dims the whole window; with one it lights it up', async () => {
    mountTour()
    await nextTick()
    expect(document.querySelector('.core-tour__scrim')).not.toBeNull()
    expect(document.querySelector('.core-tour__spotlight')).toBeNull()

    const target = document.createElement('div')
    document.body.appendChild(target)
    await wrapper.setProps({ target })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await nextTick()
    expect(document.querySelector('.core-tour__spotlight')).not.toBeNull()
    expect(document.querySelector('.core-tour__scrim')).toBeNull()
  })

  test('back, next and close; the last step is done', async () => {
    mountTour()
    await nextTick()
    button('core-tour-back')!.click()
    button('core-tour-next')!.click()
    button('core-tour-close')!.click()
    expect(Object.keys(wrapper.emitted())).toEqual(expect.arrayContaining(['back', 'next', 'close']))
    expect(button('core-tour-next')!.textContent).toContain('Next')

    await wrapper.setProps({ index: 2 })
    expect(button('core-tour-next')!.textContent).toContain('Done')
  })

  test('the first step has no way back', async () => {
    mountTour({ index: 0 })
    await nextTick()
    expect(button('core-tour-back')).toBeNull()
  })

  test('from the keyboard: the arrows go back and on, Escape closes, Tab stays in the card', async () => {
    mountTour()
    await nextTick()
    const key = (name: string, shiftKey = false) =>
      card().dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true }))
    key('ArrowRight')
    key('ArrowLeft')
    key('Escape')
    expect(wrapper.emitted('next')).toHaveLength(1)
    expect(wrapper.emitted('back')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)

    key('Tab')
    expect(document.activeElement).toBe(button('core-tour-close'))
    key('Tab', true)
    expect(document.activeElement).toBe(button('core-tour-next'))
  })
})
