/**
 * The guided tour being shown, one for the whole app: which tour, the steps it shows (those whose
 * element is on the screen when it starts) and the current one. The help menu starts a tour; the
 * tour host shows it.
 */
import { computed, nextTick, reactive } from 'vue'
import type { Tour, TourStep } from '@cornflow-ui/core/composables/onboarding/tours'

const state = reactive({
  tour: null as Tour | null,
  steps: [] as TourStep[],
  index: 0,
})

let undoSetup: (() => void) | undefined

/** The element a step points at, or null when it has none or it is not on the screen. */
export function tourTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null
  return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
}

const isShown = (step: TourStep) => !step.target || tourTarget(step) !== null

function stop() {
  undoSetup?.()
  undoSetup = undefined
  state.tour = null
  state.steps = []
  state.index = 0
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
  if (state.index >= state.steps.length - 1) stop()
  else state.index += 1
}

function back() {
  if (state.index > 0) state.index -= 1
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
    stop,
  }
}
