/**
 * The guided tour being shown, one for the whole app: which tour, the steps it shows (those whose
 * element is on the screen when it starts) and the current one. The help menu starts a tour; the
 * tour host shows it.
 *
 * A step can open what it shows (`reveal`): the component that owns it says how with
 * `onTourReveal`. A page can also give a step the terms its card explains (`provideTourTerms`),
 * when they depend on what the page holds.
 */
import { computed, nextTick, onScopeDispose, reactive, watch } from 'vue'
import type { Tour, TourStep, TourTerm } from '@cornflow-ui/core/composables/onboarding/tours'

const state = reactive({
  tour: null as Tour | null,
  steps: [] as TourStep[],
  index: 0,
  /** The user went on to the current step (not back). */
  forward: true,
})

let undoSetup: (() => void) | undefined

const elementOf = (mark: string) => document.querySelector<HTMLElement>(`[data-tour="${mark}"]`)

/** The element a step points at, or null when it has none or it is not on the screen. */
export function tourTarget(step: TourStep): HTMLElement | null {
  return step.target ? elementOf(step.target) : null
}

/** A step is shown when the element it needs is on the screen as the tour starts. */
const isShown = (step: TourStep) => {
  const mark = step.shownWith ?? step.target
  return !mark || elementOf(mark) !== null
}

function stop() {
  undoSetup?.()
  undoSetup = undefined
  state.tour = null
  state.steps = []
  state.index = 0
  state.forward = true
}

/** Starts a tour once what it sets up is on the screen; it leaves out the steps not shown. */
async function start(tour: Tour) {
  stop()
  const undo = tour.setup?.()
  undoSetup = typeof undo === 'function' ? undo : undefined
  await nextTick()
  const steps = tour.steps.filter(isShown)
  if (steps.length === 0) {
    stop()
    return
  }
  state.tour = tour
  state.steps = steps
  state.index = 0
}

function next() {
  state.forward = true
  if (state.index >= state.steps.length - 1) stop()
  else state.index += 1
}

function back() {
  state.forward = false
  if (state.index > 0) state.index -= 1
}

/**
 * Leaves out the current step, whose element did not show up once the step opened it, and shows
 * the one the user was heading to.
 */
function skip() {
  state.steps.splice(state.index, 1)
  if (state.steps.length === 0 || (state.forward && state.index >= state.steps.length)) stop()
  else if (!state.forward && state.index > 0) state.index -= 1
}

/** What the current step opens, if anything. */
const revealed = computed(() => (state.tour ? (state.steps[state.index]?.reveal ?? null) : null))

/**
 * Opens a part of a component while a tour step shows it (the step's `reveal` is `key`): `open`
 * runs when such a step comes, and what it returns runs when the tour moves to a step that does not
 * show it, or ends. Consecutive steps that show the same part leave it open.
 */
export function onTourReveal(key: string, open: () => (() => void) | void) {
  let close: (() => void) | undefined
  const shut = () => {
    close?.()
    close = undefined
  }
  watch(
    () => revealed.value === key,
    (shown) => {
      if (!shown) {
        shut()
        return
      }
      const undo = open()
      close = typeof undo === 'function' ? undo : undefined
    },
    { immediate: true },
  )
  onScopeDispose(shut)
}

const termSources = reactive(new Map<string, () => TourTerm[]>())

/**
 * The terms the card of the step pointing at `target` explains, from what the page holds (the
 * upload modes a table allows, say). The step keeps them while the component lives.
 */
export function provideTourTerms(target: string, terms: () => TourTerm[]) {
  termSources.set(target, terms)
  onScopeDispose(() => {
    if (termSources.get(target) === terms) termSources.delete(target)
  })
}

/** The terms a page gives the step pointing at `target`, if any. */
export function tourTermsOf(target: string | undefined): TourTerm[] {
  return (target && termSources.get(target)?.()) || []
}

export function useTour() {
  return {
    tour: computed(() => state.tour),
    steps: computed(() => state.steps),
    index: computed(() => state.index),
    step: computed(() => state.steps[state.index] ?? null),
    start,
    next,
    back,
    skip,
    stop,
  }
}
