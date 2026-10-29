<!--
  CoreMenu: the list inside a popover: a caption, an optional search box, group headings and rows
  with icon, count, check and chevron.

  Arrow keys move between the rows (and from the search box to the first row); Enter or Space
  picks one. With `selectable` the rows are options of a single choice, and the picked one says so
  to screen readers.

  <CorePopover>
    <template #trigger>…</template>
    <CoreMenu title="Plant" selectable :items="[
      { key: 'all', label: 'All', selected: true },
      { key: '1', label: 'North plant', count: 6 },
    ]" @select="pick" />
  </CorePopover>
-->
<template>
  <div ref="root" class="core-menu" @keydown="onKeydown">
    <div v-if="title || backLabel" class="core-menu__head">
      <button
        v-if="backLabel"
        type="button"
        class="core-menu__back"
        :aria-label="backLabel"
        :title="backLabel"
        @click="emit('back')"
      >
        <CoreIcon name="mdi-arrow-left" :size="18" />
      </button>
      <span class="core-menu__title">{{ title }}</span>
    </div>

    <label v-if="searchable" class="core-menu__search">
      <CoreIcon name="mdi-magnify" :size="18" class="core-menu__search-icon" />
      <input
        ref="searchInput"
        v-model="query"
        class="core-menu__search-input"
        type="text"
        autocomplete="off"
        :placeholder="searchPlaceholder"
        :aria-label="searchPlaceholder"
      />
    </label>

    <div class="core-menu__list" role="menu" :aria-label="title || undefined">
      <template v-for="item in items" :key="item.key">
        <div v-if="item.separator" class="core-menu__separator" role="separator" />
        <div v-else-if="item.header" class="core-menu__group" role="presentation">
          {{ item.label }}
        </div>
        <button
          v-else
          type="button"
          :class="['core-menu__item', { 'is-selected': item.selected }]"
          :role="selectable ? 'menuitemradio' : 'menuitem'"
          :aria-checked="selectable ? Boolean(item.selected) : undefined"
          :disabled="item.disabled"
          :data-testid="item.testId"
          @click="emit('select', item)"
        >
          <CoreIcon
            v-if="item.icon"
            :name="item.icon"
            :size="18"
            class="core-menu__item-icon"
          />
          <span class="core-menu__item-label">{{ item.label }}</span>
          <span v-if="item.count !== undefined" class="core-menu__item-count">{{
            item.count
          }}</span>
          <CoreIcon
            v-if="item.selected"
            name="mdi-check"
            :size="16"
            class="core-menu__item-check"
          />
          <CoreIcon
            v-if="item.chevron"
            name="mdi-chevron-right"
            :size="18"
            class="core-menu__item-chevron"
          />
        </button>
      </template>
      <div v-if="!hasRows && emptyText" class="core-menu__empty">
        {{ emptyText }}
      </div>
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'

defineOptions({ name: 'CoreMenu' })

export interface CoreMenuItem {
  key: string
  label: string
  icon?: string
  /** Rows the option would leave, shown on the right. */
  count?: number
  selected?: boolean
  /** The row leads to another list. */
  chevron?: boolean
  disabled?: boolean
  /** A group heading, not a row. */
  header?: boolean
  /** A line between groups, not a row. */
  separator?: boolean
  testId?: string
}

const props = withDefaults(
  defineProps<{
    title?: string
    items: CoreMenuItem[]
    /** The rows are options of a single choice, not commands. */
    selectable?: boolean
    searchable?: boolean
    searchPlaceholder?: string
    /** Shown when no row is left (e.g. nothing matches the search). */
    emptyText?: string
    /** Shows a back arrow with this accessible name, which emits `back`. */
    backLabel?: string
  }>(),
  {
    title: '',
    selectable: false,
    searchable: false,
    searchPlaceholder: '',
    emptyText: '',
    backLabel: '',
  },
)

const emit = defineEmits<{
  select: [item: CoreMenuItem]
  back: []
}>()

const query = defineModel<string>('query', { default: '' })

const root = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const hasRows = computed(() => props.items.some((item) => !item.header && !item.separator))

function rows(): HTMLButtonElement[] {
  return Array.from(
    root.value?.querySelectorAll<HTMLButtonElement>(
      '.core-menu__item:not(:disabled)',
    ) ?? [],
  )
}

function onKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const items = rows()
  if (items.length === 0) return
  event.preventDefault()
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  let next: number
  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else if (event.key === 'ArrowDown')
    next = current < 0 ? 0 : Math.min(current + 1, items.length - 1)
  else if (current <= 0 && searchInput.value) {
    searchInput.value.focus()
    return
  } else next = Math.max(current - 1, 0)
  items[next].focus()
}
</script>

<style scoped>
.core-menu {
  display: flex;
  flex-direction: column;
  min-height: 0;
  font-family: var(--font-sans);
  color: var(--color-text);
}

.core-menu__head {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 1.5)
    calc(var(--spacing) * 1);
}

.core-menu__back {
  display: inline-flex;
  padding: 2px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}

.core-menu__back:hover {
  background: var(--color-surface-hover);
}

.core-menu__title,
.core-menu__group {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.core-menu__group {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 2)
    calc(var(--spacing) * 1);
  color: var(--color-text-subtle);
}

.core-menu__separator {
  height: 1px;
  margin: calc(var(--spacing) * 1) 0;
  background: var(--color-divider);
}

.core-menu__search {
  display: flex;
  flex: none;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  height: 34px;
  margin: 2px 2px calc(var(--spacing) * 1.5);
  padding: 0 calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  box-sizing: border-box;
}

.core-menu__search:focus-within {
  border-color: var(--color-primary);
}

.core-menu__search-icon {
  color: var(--color-text-muted);
}

.core-menu__search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: var(--text-md);
  color: var(--color-text);
}

.core-menu__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-height: 0;
  overflow-y: auto;
}

.core-menu__item {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  width: 100%;
  padding: 7px calc(var(--spacing) * 2);
  border: 0;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  font: inherit;
  font-size: var(--text-md);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.core-menu__item:hover,
.core-menu__item:focus-visible {
  background: var(--color-surface-hover);
  outline: none;
}

.core-menu__item.is-selected {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.core-menu__item:disabled {
  opacity: 0.45;
  cursor: default;
}

.core-menu__item-icon {
  color: var(--color-text-muted);
}

.core-menu__item.is-selected .core-menu__item-icon,
.core-menu__item-check {
  color: var(--color-primary);
}

.core-menu__item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.core-menu__item-count {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
}

.core-menu__item-chevron {
  color: var(--color-text-subtle);
}

.core-menu__empty {
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 2);
  font-size: var(--text-md);
  color: var(--color-text-muted);
}
</style>
