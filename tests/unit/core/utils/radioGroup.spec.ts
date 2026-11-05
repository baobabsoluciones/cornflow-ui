import { describe, test, expect, vi } from 'vitest'
import { onRadioGroupKey, radioTabIndex } from '@cornflow-ui/core/utils/radioGroup'

const values = ['a', 'b', 'c']

function press(key: string, current: string) {
  const group = document.createElement('div')
  const buttons = values.map(() => {
    const button = document.createElement('button')
    button.setAttribute('role', 'radio')
    group.appendChild(button)
    return button
  })
  document.body.appendChild(group)
  const pick = vi.fn()
  const event = new KeyboardEvent('keydown', { key, cancelable: true })
  Object.defineProperty(event, 'currentTarget', { value: group })
  onRadioGroupKey(event, values, current, pick)
  const focused = buttons.indexOf(document.activeElement as HTMLButtonElement)
  group.remove()
  return { pick, event, focused }
}

describe('radio group keys', () => {
  test.each([
    ['ArrowRight', 'a', 'b'],
    ['ArrowDown', 'b', 'c'],
    ['ArrowRight', 'c', 'a'],
    ['ArrowLeft', 'b', 'a'],
    ['ArrowUp', 'a', 'c'],
    ['Home', 'c', 'a'],
    ['End', 'a', 'c'],
  ])('%s from %s picks %s and focuses it', (key, current, expected) => {
    const { pick, event, focused } = press(key, current)
    expect(pick).toHaveBeenCalledWith(expected)
    expect(event.defaultPrevented).toBe(true)
    expect(focused).toBe(values.indexOf(expected))
  })

  test('with nothing picked, the next arrow picks the first', () => {
    expect(press('ArrowRight', 'none').pick).toHaveBeenCalledWith('a')
  })

  test('other keys are left alone', () => {
    const { pick, event } = press('Enter', 'a')
    expect(pick).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  test('only the picked option, or the first when none is, is in the tab order', () => {
    expect(values.map((v) => radioTabIndex(values, 'b', v))).toEqual([-1, 0, -1])
    expect(values.map((v) => radioTabIndex(values, 'none', v))).toEqual([0, -1, -1])
  })
})
