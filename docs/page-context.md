# Page context: telling consumers what is on screen

`src/composables/pageContext.ts`. A page or widget registers a small entry describing what it
draws; a consumer (for example an AI assistant) lists the entries, reads their `snapshot()` when
the user points at one, and never needs to know the components. Core has no dependency on the
consumer.

```ts
interface PageContextEntry {
  id: string                    // stable per widget/page, e.g. 'results.shifts-per-week'
  kind: 'view' | 'widget'       // 'view' = a whole page summary, 'widget' = one chart/table/KPI
  title: string                 // human label (keep it plain text, <= 80 characters)
  snapshot: () => unknown       // JSON-serialisable and small: the aggregated series, not raw tables
}
```

| Function | What it does |
| --- | --- |
| `registerPageContext(entry)` | Adds the entry and returns the function that removes it. An entry with an id that is already registered replaces it (same place in the list). |
| `usePageContext(entry)` | For components: the entry is listed while the component is on screen. Registers on mount and unregisters on unmount; under `<keep-alive>` (core's views are) it also unregisters when the component is deactivated and registers again when it is activated. |
| `usePageContexts()` | Readonly reactive list of the entries, in registration order. |
| `askAboutPageContext(id)` | A widget's "Ask about this" button. Calls the listeners with the entry; an unknown id does nothing. |
| `onAskAboutPageContext(fn)` | Listen to the above; returns the unsubscribe function. |

`snapshot` is called when the consumer needs it, not on every change, so it can read the
component's current state. Keep it small (a consumer may cut it at a few thousand characters)
and free of data the user should not share: everything in it can reach the assistant.

## Example: an app's dashboard component

```vue
<template>
  <v-card>
    <v-card-title>
      {{ title }}
      <v-btn size="small" variant="text" @click="askAboutPageContext(contextId)">
        Ask about this
      </v-btn>
    </v-card-title>
    <MyChart :categories="weeks" :series="series" />
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  askAboutPageContext,
  usePageContext,
} from '@cornflow-ui/core/composables/pageContext'

const props = defineProps<{ title: string; rows: Array<{ week: string; shifts: number }> }>()
const contextId = 'results.shifts-per-week'

const weeks = computed(() => props.rows.map((r) => r.week))
const series = computed(() => [{ name: 'Shifts', data: props.rows.map((r) => r.shifts) }])

usePageContext({
  id: contextId,
  kind: 'widget',
  title: props.title,
  snapshot: () => ({ categories: weeks.value, series: series.value }),
})
</script>
```

A consumer:

```ts
import {
  onAskAboutPageContext,
  usePageContexts,
} from '@cornflow-ui/core/composables/pageContext'

const entries = usePageContexts() // what can be pointed at
const stop = onAskAboutPageContext((entry) => attach(entry.id, entry.title, entry.snapshot()))
```
