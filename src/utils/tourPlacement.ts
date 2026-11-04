/**
 * Where the card of a guided tour step goes: beside the element it points at, on the first side
 * with room (right, below, above, left), inside the window. With no element, or no side with
 * room, in the middle of the window.
 */

export interface TourRect {
  top: number
  left: number
  width: number
  height: number
}

export interface TourCardPosition {
  top: number
  left: number
  side: 'right' | 'bottom' | 'top' | 'left' | 'center'
}

/** Space between the element and the card, and between the card and the window's edge. */
const GAP = 12
const MARGIN = 16

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

export function tourCardPosition(
  target: TourRect | null,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): TourCardPosition {
  const maxLeft = viewport.width - card.width - MARGIN
  const maxTop = viewport.height - card.height - MARGIN
  const center: TourCardPosition = {
    top: Math.max(MARGIN, (viewport.height - card.height) / 2),
    left: Math.max(MARGIN, (viewport.width - card.width) / 2),
    side: 'center',
  }
  if (!target) return center

  const right = target.left + target.width
  const bottom = target.top + target.height
  const alignTop = clamp(target.top, MARGIN, maxTop)
  const alignLeft = clamp(target.left, MARGIN, maxLeft)

  if (right + GAP + card.width <= viewport.width - MARGIN) {
    return { top: alignTop, left: right + GAP, side: 'right' }
  }
  if (bottom + GAP + card.height <= viewport.height - MARGIN) {
    return { top: bottom + GAP, left: alignLeft, side: 'bottom' }
  }
  if (target.top - GAP - card.height >= MARGIN) {
    return { top: target.top - GAP - card.height, left: alignLeft, side: 'top' }
  }
  if (target.left - GAP - card.width >= MARGIN) {
    return { top: alignTop, left: target.left - GAP - card.width, side: 'left' }
  }
  return center
}

/** The lit area around the element: a little larger than it, inside the window. */
export function tourSpotlight(
  target: TourRect,
  viewport: { width: number; height: number },
  padding = 6,
): TourRect {
  const top = Math.max(0, target.top - padding)
  const left = Math.max(0, target.left - padding)
  const bottom = Math.min(viewport.height, target.top + target.height + padding)
  const right = Math.min(viewport.width, target.left + target.width + padding)
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}
