/**
 * createExecutionFlow.ts — The flow the "create execution" route shows.
 *
 * `createExecution.component` of the active DAG's settings names the view of a flow of the app, as a
 * lazy import. The app's `parameters` declare the flow of every DAG, and a DAG's entry of
 * `core.schemaOverrides` declares its own; with neither, the route shows core's page. See
 * docs/create-execution-flows.md.
 */
import { defineAsyncComponent, markRaw, toRaw, type Component } from 'vue'

/** `createExecution.component`: a lazy import of the view of a flow. */
export type CreateExecutionFlowLoader = () => Promise<unknown>

const flowComponents = new WeakMap<CreateExecutionFlowLoader, Component>()

/**
 * The component of a flow declared as a lazy import, or null when none is declared. The same import
 * always gives the same component, so resolving the settings again keeps the flow on screen
 * instead of mounting it anew.
 */
export function createExecutionFlowComponent(
  loader: CreateExecutionFlowLoader | null | undefined,
): Component | null {
  if (loader == null) return null
  if (typeof loader !== 'function') {
    console.warn(
      "createExecution.component is ignored: it must be a lazy import, e.g. () => import('@/app/views/MyCreateExecutionView.vue')",
    )
    return null
  }
  const rawLoader = toRaw(loader)
  let component = flowComponents.get(rawLoader)
  if (!component) {
    component = markRaw(
      defineAsyncComponent(rawLoader as () => Promise<Component>),
    )
    flowComponents.set(rawLoader, component)
  }
  return component
}
