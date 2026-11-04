/**
 * The guided tours of the app. A tour is a list of steps; each step points at a part of the screen
 * (the element with `data-tour="<target>"`) and reads `onboarding.<tour>.<step>.title` and
 * `.text`. A step without target shows in the middle of the window. A step whose element is not
 * on the screen when the tour starts (a button this user may not use, a panel of another state) is
 * left out.
 *
 * The general tour goes over the parts every page shares; a page tour, over one page, and the help
 * menu offers the one of the page the user is on.
 */
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

export interface TourStep {
  key: string
  /** `data-tour` of the element the step points at. */
  target?: string
}

export interface Tour {
  key: string
  steps: TourStep[]
  /** For a page tour, whether it is the tour of this route path. */
  page?: (path: string) => boolean
  /** Runs before the first step; what it returns runs once the tour ends. */
  setup?: () => (() => void) | void
}

export const GENERAL_TOUR: Tour = {
  key: 'general',
  // The menu stays open while the tour goes over it, and folds back after if it was folded.
  setup() {
    const store = useGeneralStore()
    const pinned = store.isDrawerPinned
    store.setDrawerPinned(true)
    return () => store.setDrawerPinned(pinned)
  },
  steps: [
    { key: 'welcome' },
    { key: 'menu', target: 'drawer' },
    { key: 'newExecution', target: 'drawer-new-execution' },
    { key: 'loadedExecution', target: 'drawer-execution' },
    { key: 'shared', target: 'drawer-groups' },
    { key: 'tabs', target: 'execution-tabs' },
    { key: 'help', target: 'help-menu' },
    { key: 'account', target: 'drawer-user' },
  ],
}

/** The tours of single pages. */
export const PAGE_TOURS: Tour[] = []

/** The tour of the page at this path, if it has one. */
export function pageTourOf(path: string): Tour | null {
  return PAGE_TOURS.find((tour) => tour.page?.(path)) ?? null
}

/** `onboarding.<tour>.<step>.title` and `.text`. */
export function stepTextKeys(tour: Tour, step: TourStep) {
  const base = `onboarding.${tour.key}.${step.key}`
  return { title: `${base}.title`, text: `${base}.text` }
}
