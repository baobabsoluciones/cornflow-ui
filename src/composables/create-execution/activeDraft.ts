/**
 * The create-execution draft that is on screen right now, for anything outside the flow that
 * wants to look at it (an assistant, a help panel). `useExecutionDraft()` publishes itself here
 * and withdraws when its scope is disposed.
 */
import { shallowRef, shallowReadonly, type ShallowRef } from 'vue'
import type { ExecutionDraftController } from './useExecutionDraft'

const active = shallowRef<ExecutionDraftController | null>(null)
const activeReadonly = shallowReadonly(active) as Readonly<ShallowRef<ExecutionDraftController | null>>

/** Reactive reference to the active draft, or null when no flow is open. */
export function useActiveExecutionDraft(): Readonly<
  ShallowRef<ExecutionDraftController | null>
> {
  return activeReadonly
}

/** Used by `useExecutionDraft`; not part of the consumer API. */
export function publishActiveExecutionDraft(draft: ExecutionDraftController): void {
  active.value = draft
}

/** Clears the active draft only when it is still `draft` (a newer flow keeps its own). */
export function withdrawActiveExecutionDraft(draft: ExecutionDraftController): void {
  if (active.value === draft) active.value = null
}
