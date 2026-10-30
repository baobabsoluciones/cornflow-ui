<!--
  DataTableTabs: the strip of tables of a group, one tab per table.

  Each tab shows the table's name and its row count, and the state that matters at a glance: the
  origin of its data, check errors or warnings, the comparison with its master table and its
  unsaved changes. Its tooltip says all of it in words.

  When the tabs do not fit, arrows at the ends scroll the strip, and the active tab scrolls into
  view whenever it changes. The "⋯ N" button at the right lists every table, with a search, to jump
  to any of them.

  Arrow keys move between the tabs; Enter or Space opens the focused one.

  <DataTableTabs v-model="activeTable" :tabs="[{ key: 'lines', label: 'Lines', rows: 48 }]" />
-->
<template>
  <div class="data-table-tabs">
    <button
      v-if="overflowing"
      type="button"
      class="data-table-tabs__arrow"
      :disabled="!canScrollStart"
      :aria-label="$t('dataTable.tabs.previous')"
      :title="$t('dataTable.tabs.previous')"
      data-testid="data-table-tabs-previous"
      @click="scrollBy(-1)"
    >
      <CoreIcon name="mdi-chevron-left" :size="18" />
    </button>

    <div
      ref="strip"
      class="data-table-tabs__strip"
      role="tablist"
      @scroll="updateOverflow"
      @keydown="onKeydown"
    >
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        class="data-table-tabs__tab"
        :class="{ 'is-active': tab.key === modelValue }"
        :aria-selected="tab.key === modelValue"
        :tabindex="tab.key === focusKey ? 0 : -1"
        :title="summary(tab)"
        :data-tab="tab.key"
        :data-testid="`data-table-tab-${tab.key}`"
        @click="select(tab.key)"
      >
        <CoreIcon
          v-if="tab.source"
          :name="SOURCE_ICONS[tab.source]"
          :size="15"
          class="data-table-tabs__source"
        />
        <span v-if="tab.badge" class="data-table-tabs__badge">{{ tab.badge }}</span>
        <span class="data-table-tabs__label">{{ tab.label }}</span>
        <span v-if="tab.rows !== undefined" class="data-table-tabs__rows">{{
          formatCount(tab.rows)
        }}</span>
        <template v-for="mark in marksOf(tab)" :key="mark.key">
          <CoreSpinner v-if="mark.kind === 'spinner'" :size="13" class="data-table-tabs__mark" />
          <span v-else-if="mark.kind === 'pending'" class="data-table-tabs__pending">
            <CoreIcon name="mdi-pencil" :size="11" />{{ mark.text }}
          </span>
          <CoreIcon v-else :name="mark.icon" :size="15" :class="['data-table-tabs__mark', mark.tone]" />
        </template>
      </button>
    </div>

    <button
      v-if="overflowing"
      type="button"
      class="data-table-tabs__arrow"
      :disabled="!canScrollEnd"
      :aria-label="$t('dataTable.tabs.next')"
      :title="$t('dataTable.tabs.next')"
      data-testid="data-table-tabs-next"
      @click="scrollBy(1)"
    >
      <CoreIcon name="mdi-chevron-right" :size="18" />
    </button>

    <div class="data-table-tabs__all">
      <CorePopover v-model:open="menuOpen" align="end" :width="300">
        <template #trigger>
          <button
            type="button"
            class="data-table-tabs__all-button"
            :aria-label="$t('dataTable.tabs.allTables', { count: tabs.length })"
            :title="$t('dataTable.tabs.allTables', { count: tabs.length })"
            data-testid="data-table-tabs-all"
          >
            <CoreIcon name="mdi-dots-horizontal" :size="18" />
            <span>{{ tabs.length }}</span>
          </button>
        </template>
        <template #default="{ close }">
          <div class="data-table-tabs__menu">
            <CoreTextField
              v-model="query"
              size="small"
              :placeholder="$t('dataTable.tabs.search')"
              :aria-label="$t('dataTable.tabs.search')"
              data-testid="data-table-tabs-search"
            />
            <div class="data-table-tabs__menu-list" role="listbox">
              <button
                v-for="tab in matchingTabs"
                :key="tab.key"
                type="button"
                role="option"
                class="data-table-tabs__menu-item"
                :class="{ 'is-active': tab.key === modelValue }"
                :aria-selected="tab.key === modelValue"
                :title="summary(tab)"
                :data-testid="`data-table-tabs-menu-${tab.key}`"
                @click="pickFromMenu(tab.key, close)"
              >
                <CoreIcon
                  v-if="tab.source"
                  :name="SOURCE_ICONS[tab.source]"
                  :size="15"
                  class="data-table-tabs__source"
                />
                <span class="data-table-tabs__menu-label">{{ tab.label }}</span>
                <span v-if="tab.rows !== undefined" class="data-table-tabs__rows">{{
                  formatCount(tab.rows)
                }}</span>
                <template v-for="mark in marksOf(tab)" :key="mark.key">
                  <CoreSpinner v-if="mark.kind === 'spinner'" :size="13" class="data-table-tabs__mark" />
                  <span v-else-if="mark.kind === 'pending'" class="data-table-tabs__pending">
                    <CoreIcon name="mdi-pencil" :size="11" />{{ mark.text }}
                  </span>
                  <CoreIcon v-else :name="mark.icon" :size="15" :class="['data-table-tabs__mark', mark.tone]" />
                </template>
              </button>
              <p v-if="matchingTabs.length === 0" class="data-table-tabs__menu-empty">
                {{ $t('dataTable.tabs.noMatches') }}
              </p>
            </div>
          </div>
        </template>
      </CorePopover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'

defineOptions({ name: 'DataTableTabs' })

export interface DataTableTab {
  key: string
  label: string
  /** Rows of the table, shown muted after the label. */
  rows?: number
  /** Short tag before the label, e.g. the side a check belongs to ("Input", "Output"). */
  badge?: string
  /** Unsaved changes in the table. */
  pending?: number
  /** The table holds check errors or warnings. */
  level?: 'error' | 'warning'
  /** Comparison with its master table. */
  master?: 'identical' | 'different' | 'comparing' | 'error'
  /** Where its data comes from. */
  source?: 'database' | 'file' | 'edited' | 'reuploaded'
}

const props = defineProps<{
  tabs: DataTableTab[]
  modelValue: string
}>()

const emit = defineEmits<{ 'update:modelValue': [key: string] }>()

const { t, locale } = useI18n()

const SOURCE_ICONS: Record<NonNullable<DataTableTab['source']>, string> = {
  database: 'mdi-database-outline',
  file: 'mdi-file-outline',
  edited: 'mdi-database-edit-outline',
  reuploaded: 'mdi-file-replace-outline',
}

const MASTER_ICONS: Record<Exclude<NonNullable<DataTableTab['master']>, 'comparing'>, string> = {
  identical: 'mdi-equal',
  different: 'mdi-not-equal-variant',
  error: 'mdi-alert-circle-outline',
}

type TabMark =
  | { key: string; kind: 'icon'; icon: string; tone: string }
  | { key: string; kind: 'spinner' }
  | { key: string; kind: 'pending'; text: string }

/** The marks after a tab's label: check level, master comparison and unsaved changes. */
function marksOf(tab: DataTableTab): TabMark[] {
  const marks: TabMark[] = []
  if (tab.level) {
    const icon = tab.level === 'error' ? 'mdi-alert-circle' : 'mdi-alert'
    marks.push({ key: 'level', kind: 'icon', icon, tone: `is-${tab.level}` })
  }
  if (tab.master === 'comparing') {
    marks.push({ key: 'master', kind: 'spinner' })
  } else if (tab.master) {
    const icon = MASTER_ICONS[tab.master]
    marks.push({ key: 'master', kind: 'icon', icon, tone: `is-master-${tab.master}` })
  }
  if (tab.pending) marks.push({ key: 'pending', kind: 'pending', text: String(tab.pending) })
  return marks
}

const formatCount = (count: number) => new Intl.NumberFormat(locale.value).format(count)

/** The tooltip of a tab: everything its marks say, in words. */
function summary(tab: DataTableTab): string {
  const parts = [tab.label]
  if (tab.rows !== undefined) {
    parts.push(t('dataTable.tabs.rows', { count: formatCount(tab.rows) }, tab.rows))
  }
  if (tab.pending) parts.push(t('dataTable.tabs.pending', { count: tab.pending }, tab.pending))
  if (tab.source) {
    parts.push(t('dataTable.tabs.origin', { source: t(`dataTable.tabs.sources.${tab.source}`) }))
  }
  if (tab.master) parts.push(t(`dataTable.tabs.master.${tab.master}`))
  if (tab.level) parts.push(t(`dataTable.tabs.level.${tab.level}`))
  return parts.join(' · ')
}

// ── Keyboard focus ──────────────────────────────────────────────────────────

/** The tab that takes the keyboard focus inside the strip; the active one until arrows move it. */
const focusKey = ref(props.modelValue)
watch(
  () => props.modelValue,
  (key) => {
    focusKey.value = key
  },
)

function select(key: string) {
  focusKey.value = key
  if (key !== props.modelValue) emit('update:modelValue', key)
}

function focusTab(key: string) {
  focusKey.value = key
  tabElement(key)?.focus()
}

function onKeydown(event: KeyboardEvent) {
  const keys = props.tabs.map((tab) => tab.key)
  const index = keys.indexOf(focusKey.value)
  const targets: Record<string, number> = {
    ArrowRight: Math.min(keys.length - 1, index + 1),
    ArrowLeft: Math.max(0, index - 1),
    Home: 0,
    End: keys.length - 1,
  }
  if (!(event.key in targets) || keys.length === 0) return
  event.preventDefault()
  focusTab(keys[targets[event.key]])
}

// ── Overflow and scrolling ──────────────────────────────────────────────────

const strip = ref<HTMLElement>()
const overflowing = ref(false)
const canScrollStart = ref(false)
const canScrollEnd = ref(false)

/** The button of a tab in the strip. */
function tabElement(key: string): HTMLElement | undefined {
  const buttons = strip.value?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []
  return [...buttons].find((button) => button.dataset.tab === key)
}

function updateOverflow() {
  const el = strip.value
  if (!el) return
  overflowing.value = el.scrollWidth > el.clientWidth + 1
  canScrollStart.value = el.scrollLeft > 0
  canScrollEnd.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function scrollBy(direction: 1 | -1) {
  const el = strip.value
  if (!el) return
  el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' })
}

/** Brings the active tab into view, with some margin, when it is outside the visible strip. */
function revealActive() {
  const el = strip.value
  const tab = tabElement(props.modelValue)
  if (!el || !tab) return
  const left = tab.offsetLeft - el.offsetLeft
  const right = left + tab.offsetWidth
  if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
    el.scrollTo({ left: Math.max(0, left - 40), behavior: 'smooth' })
  }
}

watch(
  () => props.modelValue,
  () => nextTick(revealActive),
)
watch(
  () => props.tabs.length,
  () => nextTick(updateOverflow),
)

let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  updateOverflow()
  revealActive()
  if (typeof ResizeObserver !== 'undefined' && strip.value) {
    resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(strip.value)
  }
})
onBeforeUnmount(() => resizeObserver?.disconnect())

// ── All tables menu ─────────────────────────────────────────────────────────

const menuOpen = ref(false)
const query = ref('')

watch(menuOpen, (open) => {
  if (open) query.value = ''
})

const matchingTabs = computed(() => {
  const text = query.value.trim().toLowerCase()
  return text ? props.tabs.filter((tab) => tab.label.toLowerCase().includes(text)) : props.tabs
})

function pickFromMenu(key: string, close: () => void) {
  select(key)
  close()
}
</script>

<style scoped>
.data-table-tabs {
  display: flex;
  align-items: stretch;
  min-width: 0;
  border-bottom: 1px solid var(--color-divider);
  font-family: var(--font-sans);
}

.data-table-tabs__strip {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 2px;
  padding: 0 calc(var(--spacing) * 2);
  overflow-x: auto;
  scrollbar-width: none;
}

.data-table-tabs__strip::-webkit-scrollbar {
  display: none;
}

.data-table-tabs__tab {
  flex: none;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 3) calc(var(--spacing) * 2.5);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  font: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.data-table-tabs__tab:hover {
  background: color-mix(in srgb, var(--color-primary) 4%, transparent);
  color: var(--color-text);
}

.data-table-tabs__tab:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.data-table-tabs__tab.is-active {
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
}

.data-table-tabs__label {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.data-table-tabs__rows {
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-subtle);
}

.data-table-tabs__source {
  color: var(--color-text-subtle);
}

.data-table-tabs__badge {
  padding: 1px calc(var(--spacing) * 1.5);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.data-table-tabs__mark.is-error {
  color: var(--color-danger);
}

.data-table-tabs__mark.is-warning {
  color: var(--color-warning);
}

.data-table-tabs__mark.is-master-identical {
  color: var(--color-success);
}

.data-table-tabs__mark.is-master-different {
  color: var(--color-info);
}

.data-table-tabs__mark.is-master-error {
  color: var(--color-danger);
}

.data-table-tabs__pending {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px calc(var(--spacing) * 1.5) 1px calc(var(--spacing) * 1);
  border-radius: var(--radius-full);
  background: var(--color-warning-soft);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-warning-strong);
}

.data-table-tabs__arrow {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.data-table-tabs__arrow:disabled {
  cursor: default;
  opacity: 0.35;
}

.data-table-tabs__all {
  flex: none;
  display: flex;
  align-items: center;
  padding: 0 calc(var(--spacing) * 2) 0 calc(var(--spacing) * 1);
  border-left: 1px solid var(--color-divider);
}

.data-table-tabs__all-button {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  height: 32px;
  padding: 0 calc(var(--spacing) * 2);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  cursor: pointer;
}

.data-table-tabs__all-button:hover {
  background: var(--color-surface-hover);
}

.data-table-tabs__menu {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 1.5);
}

.data-table-tabs__menu-list {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
}

.data-table-tabs__menu-item {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 1.75) calc(var(--spacing) * 2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  font: inherit;
  font-size: var(--text-md);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.data-table-tabs__menu-item:hover {
  background: var(--color-surface-hover);
}

.data-table-tabs__menu-item.is-active {
  background: var(--color-primary-soft);
  font-weight: var(--font-weight-medium);
}

.data-table-tabs__menu-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-table-tabs__menu-empty {
  margin: 0;
  padding: calc(var(--spacing) * 2);
  font-size: var(--text-md);
  color: var(--color-text-subtle);
}
</style>
