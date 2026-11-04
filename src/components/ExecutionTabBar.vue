<!--
  ExecutionTabBar: the bar at the foot of the app with a tab per loaded execution.

  Each tab shows a dot in the colour of the execution's state (a spinner while it runs) and its
  name; the selected one is marked. A click selects a tab (`select`, its id), the × closes it
  (`close`, its index). At the end, the `end` slot. Many tabs scroll sideways.

  From the keyboard it is a tab list: Tab reaches the selected tab, the arrows (and Home, End)
  move between tabs, Enter or Space selects the one with the focus, and Delete closes it.

  <ExecutionTabBar :tabs="tabs" :selected="selectedId" @select="select" @close="close" />
-->
<template>
  <nav
    class="execution-tab-bar"
    :aria-label="$t('executionTabs.label')"
    data-testid="execution-tab-bar"
    data-tour="execution-tabs"
  >
    <div
      class="execution-tab-bar__tabs"
      role="tablist"
      :aria-label="$t('executionTabs.label')"
      @keydown="onKey"
    >
      <div
        v-for="(tab, index) in tabs"
        :key="tab.id"
        class="execution-tab-bar__tab"
        :class="{ 'is-selected': tab.id === selected }"
      >
        <button
          type="button"
          role="tab"
          class="execution-tab-bar__select"
          :aria-selected="tab.id === selected"
          :tabindex="tab.id === focusableId ? 0 : -1"
          aria-keyshortcuts="Delete"
          :title="`${tab.name} · ${tab.status.label}`"
          :data-testid="`execution-tab-${tab.id}`"
          @click="emit('select', tab.id)"
        >
          <CoreSpinner v-if="tab.status.spin" :size="10" />
          <span v-else class="execution-tab-bar__dot" :class="`is-${tab.status.tone}`" />
          <span class="execution-tab-bar__name">{{ tab.name }}</span>
        </button>
        <button
          type="button"
          class="execution-tab-bar__close"
          tabindex="-1"
          :aria-label="$t('executionTabs.close', { name: tab.name })"
          :title="$t('executionTabs.close', { name: tab.name })"
          :data-testid="`execution-tab-close-${tab.id}`"
          @click="emit('close', index)"
        >
          <CoreIcon name="mdi-close" :size="14" />
        </button>
      </div>
    </div>
    <div v-if="$slots.end" class="execution-tab-bar__end">
      <slot name="end" />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import type { CoreTone } from '@cornflow-ui/core/types/ui'

defineOptions({ name: 'CoreExecutionTabBar' })

export interface ExecutionTabBarTab {
  id: string
  name: string
  /** The execution's state as the app shows it: label, tone, and whether it is running. */
  status: { label: string; tone: CoreTone; spin: boolean }
}

const props = defineProps<{
  tabs: ExecutionTabBarTab[]
  /** Id of the selected tab. */
  selected: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  close: [index: number]
}>()

/** The tab Tab reaches: the selected one, or the first. */
const focusableId = computed(() =>
  props.tabs.some((tab) => tab.id === props.selected) ? props.selected : props.tabs[0]?.id,
)

function onKey(event: KeyboardEvent) {
  const tabs = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]')]
  const index = tabs.indexOf(document.activeElement as HTMLElement)
  if (index === -1) return
  const last = tabs.length - 1
  const target = {
    ArrowLeft: index === 0 ? last : index - 1,
    ArrowRight: index === last ? 0 : index + 1,
    Home: 0,
    End: last,
  }[event.key]
  if (target !== undefined) {
    event.preventDefault()
    tabs[target].focus()
  } else if (event.key === 'Delete') {
    event.preventDefault()
    emit('close', index)
  }
}
</script>

<style scoped>
.execution-tab-bar {
  display: flex;
  align-items: stretch;
  box-sizing: border-box;
  height: var(--bottom-bar-height);
  border-top: 1px solid var(--color-divider);
  background: var(--color-surface-muted);
  font-family: var(--font-sans);
  font-size: var(--text-md);
}

.execution-tab-bar__tabs {
  display: flex;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.execution-tab-bar__tab {
  flex: none;
  display: flex;
  align-items: center;
  border-right: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
}

.execution-tab-bar__tab:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

/* The selected tab joins the page: the surface colour, the primary text and a line on top. */
.execution-tab-bar__tab.is-selected {
  background: var(--color-surface);
  box-shadow: inset 0 2px 0 var(--color-primary);
  color: var(--color-primary);
}

.execution-tab-bar__select {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  height: 100%;
  padding: 0 calc(var(--spacing) * 1) 0 calc(var(--spacing) * 3);
  border: 0;
  background: none;
  font: inherit;
  font-weight: var(--font-weight-medium);
  color: inherit;
  cursor: pointer;
}

.execution-tab-bar__select:focus-visible,
.execution-tab-bar__close:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.execution-tab-bar__name {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-tab-bar__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-neutral);
}

.execution-tab-bar__dot.is-success {
  background: var(--color-success);
}

.execution-tab-bar__dot.is-warning {
  background: var(--color-warning);
}

.execution-tab-bar__dot.is-danger {
  background: var(--color-danger);
}

.execution-tab-bar__dot.is-primary {
  background: var(--color-primary);
}

.execution-tab-bar__dot.is-info {
  background: var(--color-info);
}

.execution-tab-bar__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: calc(var(--spacing) * 1.5);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-subtle);
  cursor: pointer;
}

.execution-tab-bar__close:hover {
  background: var(--color-border-subtle);
  color: var(--color-text);
}

.execution-tab-bar__end {
  flex: none;
  display: flex;
  align-items: center;
  margin-left: auto;
  padding: 0 calc(var(--spacing) * 3);
}
</style>
