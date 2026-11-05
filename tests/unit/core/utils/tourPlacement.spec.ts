import { describe, test, expect } from 'vitest'
import { tourCardPosition, tourSpotlight } from '@cornflow-ui/core/utils/tourPlacement'

const viewport = { width: 1200, height: 800 }
const card = { width: 340, height: 180 }

describe('tourCardPosition', () => {
  test('without an element the card is in the middle of the window', () => {
    expect(tourCardPosition(null, card, viewport)).toEqual({ top: 310, left: 430, side: 'center' })
  })

  test('beside the element, on its right when there is room', () => {
    const menu = { top: 0, left: 0, width: 250, height: 800 }
    expect(tourCardPosition(menu, card, viewport)).toEqual({ top: 16, left: 262, side: 'right' })
  })

  test('below an element too wide to have room on its right', () => {
    const header = { top: 20, left: 900, width: 280, height: 40 }
    expect(tourCardPosition(header, card, viewport)).toEqual({ top: 72, left: 844, side: 'bottom' })
  })

  test('above an element at the foot of the window', () => {
    const tabBar = { top: 744, left: 56, width: 1144, height: 56 }
    expect(tourCardPosition(tabBar, card, viewport)).toEqual({ top: 552, left: 56, side: 'top' })
  })

  test('on the left of an element at the right edge that fills the height', () => {
    const panel = { top: 0, left: 900, width: 300, height: 800 }
    expect(tourCardPosition(panel, card, viewport)).toEqual({ top: 16, left: 548, side: 'left' })
  })

  test('in the middle when no side has room', () => {
    const page = { top: 0, left: 0, width: 1200, height: 800 }
    expect(tourCardPosition(page, card, viewport).side).toBe('center')
  })
})

describe('tourSpotlight', () => {
  test('a little larger than the element, inside the window', () => {
    expect(tourSpotlight({ top: 100, left: 100, width: 50, height: 20 }, viewport)).toEqual({
      top: 94,
      left: 94,
      width: 62,
      height: 32,
    })
    expect(tourSpotlight({ top: 0, left: 0, width: 250, height: 800 }, viewport)).toEqual({
      top: 0,
      left: 0,
      width: 256,
      height: 800,
    })
  })
})
