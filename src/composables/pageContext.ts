/**
 * Page-context registry: what is on screen that the user may want to ask about.
 *
 * Pages and widgets (core's or an app's) register an entry; a consumer such as an AI assistant
 * lists the entries and reads their `snapshot()` when needed. Core knows nothing about the consumer.
 */
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowReadonly, shallowRef, type Ref } from 'vue'

export type PageContextKind = 'view' | 'widget'

export interface PageContextEntry {
  /** Stable per widget/page, e.g. 'results.shifts-per-week'. */
  id: string
  /** 'view' = whole page summary, 'widget' = one chart/table/KPI. */
  kind: PageContextKind
  /** Human label, shown on the chip. */
  title: string
  /** JSON-serialisable and small: what is drawn (aggregated series), not raw tables. */
  snapshot: () => unknown
}

const entries = shallowRef<PageContextEntry[]>([])
const entriesReadonly = shallowReadonly(entries) as Readonly<Ref<PageContextEntry[]>>
const askListeners = new Set<(entry: PageContextEntry) => void>()

/** Registers an entry (replacing one with the same id, keeping its place). Returns the unregister function. */
export function registerPageContext(entry: PageContextEntry): () => void {
  const index = entries.value.findIndex((e) => e.id === entry.id)
  entries.value =
    index === -1
      ? [...entries.value, entry]
      : entries.value.map((e, i) => (i === index ? entry : e))
  return () => {
    // only remove our own entry: a replacement registered later stays
    if (entries.value.includes(entry)) {
      entries.value = entries.value.filter((e) => e !== entry)
    }
  }
}

/** Reactive list of the registered entries, in registration order. */
export function usePageContexts(): Readonly<Ref<PageContextEntry[]>> {
  return entriesReadonly
}

/** A widget's "Ask about this" button calls this; listeners get the entry. Unknown ids are ignored. */
export function askAboutPageContext(id: string): void {
  const entry = entries.value.find((e) => e.id === id)
  if (!entry) return
  for (const fn of [...askListeners]) fn(entry)
}

/** Listens to `askAboutPageContext`. Returns the unsubscribe function. */
export function onAskAboutPageContext(fn: (entry: PageContextEntry) => void): () => void {
  askListeners.add(fn)
  return () => {
    askListeners.delete(fn)
  }
}

/**
 * For components: the entry is registered while the component is on screen.
 *
 * Registers on mount and unregisters on unmount. Under `<keep-alive>` (core's views are) a page that was
 * left stays mounted, so the entry is also unregistered when the component is deactivated and registered
 * again when it is activated.
 */
export function usePageContext(entry: PageContextEntry): void {
  let unregister: (() => void) | null = null
  const on = () => {
    if (!unregister) unregister = registerPageContext(entry)
  }
  const off = () => {
    unregister?.()
    unregister = null
  }
  onMounted(on)
  onActivated(on)
  onDeactivated(off)
  onBeforeUnmount(off)
}
