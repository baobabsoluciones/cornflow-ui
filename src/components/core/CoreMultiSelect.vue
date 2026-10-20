<!--
/**
 * CoreMultiSelect component
 *
 * A dropdown to pick several values from a list, e.g. for filters. An empty selection means "all".
 *
 * Features:
 * - Button summarising the selection ("All", "Lisbon", "Lisbon +2"), with every selected title
 *   in its tooltip
 * - Checkbox list with a search box for long lists, a "n selected · Clear selection" bar and a
 *   "No results" message
 * - Rendered inline, not teleported like a Vuetify menu, so it can live inside a popover with its
 *   own click-outside handling without that popover closing mid-pick
 * - The model is always replaced with a new array (never mutated in place) and kept in item
 *   order, so watchers on it fire on every change
 * - Keyboard: Enter / Space / ArrowDown on the button open it; ArrowUp / ArrowDown move, Enter
 *   (or Space outside the search box) toggles, Esc closes back to the button, Tab closes
 * - Accessibility: listbox ARIA (aria-multiselectable, aria-activedescendant) and IME-safe keys
 * - Disabled when there are no items
 *
 * Props:
 * - modelValue (String[]): Selected values, in item order. Empty means "all"
 * - items (CoreMultiSelectOption[]): Items to pick from, as { title, value }
 * - allLabel (String): Summary shown with nothing selected. Defaults to the translated "All"
 * - searchThreshold (Number): Lists with more items than this get a search box (default 8, 0 = always)
 * - disabled (Boolean): Disabled state
 * - id (String): The button's id, so a `<label for>` names it
 *
 * Usage examples:
 *
 * Basic multi-select:
 * <CoreMultiSelect
 *   v-model="selectedStations"
 *   :items="stations"
 * />
 *
 * With a label and a custom "all" summary:
 * <label for="station-filter">Station</label>
 * <CoreMultiSelect
 *   id="station-filter"
 *   v-model="selectedStations"
 *   :items="stations"
 *   all-label="All stations"
 * />
 *
 * Search box always shown:
 * <CoreMultiSelect
 *   v-model="selectedStations"
 *   :items="stations"
 *   :search-threshold="0"
 * />
 *
 * Events:
 * - @update:modelValue: Emitted with the new selection, in item order
 */
-->

<template>
  <div ref="rootRef" class="core-multi-select">
    <button
      :id="id"
      ref="triggerRef"
      type="button"
      class="core-multi-select__trigger"
      :class="{ 'core-multi-select__trigger--has-value': modelValue.length }"
      :disabled="isDisabled"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? listId : undefined"
      :title="selectedTitles"
      @click="isOpen ? close() : open()"
      @keydown="handleTriggerKeydown"
    >
      <span class="core-multi-select__summary">{{ summary }}</span>
      <v-icon
        icon="mdi-chevron-down"
        size="20"
        class="core-multi-select__chevron"
      />
    </button>

    <div
      v-if="isOpen"
      class="core-multi-select__panel"
      @keydown="handlePanelKeydown"
      @mousedown="handlePanelMousedown"
    >
      <div v-if="hasSearch" class="core-multi-select__search">
        <v-icon
          icon="mdi-magnify"
          size="18"
          class="core-multi-select__search-icon"
        />
        <input
          ref="searchRef"
          v-model="query"
          class="core-multi-select__search-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="t('table.searchPlaceholder')"
          :aria-label="t('table.searchPlaceholder')"
          :aria-controls="listId"
          :aria-activedescendant="activeOptionId"
        />
      </div>

      <div v-if="modelValue.length" class="core-multi-select__bar">
        <span>{{
          t('table.selectedItems', { count: modelValue.length })
        }}</span>
        <button type="button" class="core-multi-select__clear" @click="clear">
          {{ t('table.clearSelection') }}
        </button>
      </div>

      <div
        :id="listId"
        ref="listRef"
        class="core-multi-select__list"
        role="listbox"
        aria-multiselectable="true"
        :tabindex="hasSearch ? -1 : 0"
        :aria-activedescendant="hasSearch ? undefined : activeOptionId"
      >
        <div
          v-for="(item, index) in visibleItems"
          :id="optionId(index)"
          :key="item.value"
          class="core-multi-select__option"
          :class="{
            'core-multi-select__option--active': index === activeIndex,
            'core-multi-select__option--selected': selectedSet.has(item.value),
          }"
          role="option"
          :aria-selected="selectedSet.has(item.value)"
          @mousedown.left="toggle(item.value)"
          @mousemove="activeIndex = index"
        >
          <CoreCheckbox
            :model-value="selectedSet.has(item.value)"
            class="core-multi-select__check"
            aria-hidden="true"
          />
          <span class="core-multi-select__title">{{ item.title }}</span>
        </div>
      </div>

      <div v-if="!visibleItems.length" class="core-multi-select__empty">
        {{ t('multiSelect.noResults') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreCheckbox from '@cornflow-ui/core/components/core/CoreCheckbox.vue'
import { useClickOutside } from '@cornflow-ui/core/composables/useClickOutside'

// Types
export interface CoreMultiSelectOption {
  title: string
  value: string
}

// Props
interface Props {
  modelValue: string[]
  items: CoreMultiSelectOption[]
  allLabel?: string
  searchThreshold?: number
  disabled?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  allLabel: undefined,
  searchThreshold: 8,
  disabled: false,
  id: undefined,
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

// Composables
const { t } = useI18n()

// State
const isOpen = ref(false)
const query = ref('')
const activeIndex = ref(-1)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

// Unique per instance, for the ARIA links between the button, the listbox and its options
const uid = useId()
const listId = `${uid}-list`
const optionId = (index: number) => `${uid}-option-${index}`

// Computed
const isDisabled = computed(() => props.disabled || !props.items.length)

const hasSearch = computed(() => props.items.length > props.searchThreshold)

const selectedSet = computed(() => new Set(props.modelValue))

const visibleItems = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q
    ? props.items.filter((item) => item.title.toLowerCase().includes(q))
    : props.items
})

// Selected items in item order, for the summary and its tooltip
const selectedItems = computed(() =>
  props.items.filter((item) => selectedSet.value.has(item.value)),
)

const summary = computed(() => {
  const selected = selectedItems.value
  if (!selected.length) return props.allLabel ?? t('multiSelect.all')
  return selected.length === 1
    ? selected[0].title
    : `${selected[0].title} +${selected.length - 1}`
})

const selectedTitles = computed(() =>
  selectedItems.value.length > 1
    ? selectedItems.value.map((item) => item.title).join(', ')
    : undefined,
)

const activeOptionId = computed(() =>
  visibleItems.value[activeIndex.value]
    ? optionId(activeIndex.value)
    : undefined,
)

// Methods
const toggle = (value: string) => {
  const next = new Set(props.modelValue)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  emit(
    'update:modelValue',
    props.items
      .filter((item) => next.has(item.value))
      .map((item) => item.value),
  )
}

const clear = () => {
  if (props.modelValue.length) emit('update:modelValue', [])
}

const setActive = (index: number) => {
  activeIndex.value = index
  nextTick(() =>
    listRef.value
      ?.querySelector('.core-multi-select__option--active')
      ?.scrollIntoView?.({ block: 'nearest' }),
  )
}

const open = () => {
  if (isOpen.value || isDisabled.value) return
  isOpen.value = true
  setActive(visibleItems.value.length ? 0 : -1)
  nextTick(() => (hasSearch.value ? searchRef.value : listRef.value)?.focus())
}

const close = (refocus = false) => {
  if (!isOpen.value) return
  isOpen.value = false
  query.value = ''
  activeIndex.value = -1
  if (refocus) triggerRef.value?.focus()
}

const move = (delta: number) => {
  const count = visibleItems.value.length
  if (!count) return
  setActive(
    activeIndex.value < 0 ? 0 : (activeIndex.value + delta + count) % count,
  )
}

const toggleActive = () => {
  const item = visibleItems.value[activeIndex.value]
  if (item) toggle(item.value)
}

const handleTriggerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    open()
  }
}

const handlePanelKeydown = (event: KeyboardEvent) => {
  // Keys confirming or navigating an IME composition belong to the IME
  if (event.isComposing) return
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()
      move(event.key === 'ArrowDown' ? 1 : -1)
      break
    case 'Enter':
      event.preventDefault()
      toggleActive()
      break
    case ' ':
      // In the search box a space is just part of the query
      if (event.target === searchRef.value) break
      event.preventDefault()
      toggleActive()
      break
    case 'Escape':
      // Consumed, so it doesn't also reach document-level Esc handlers (e.g. a parent popover)
      event.stopPropagation()
      close(true)
      break
    case 'Tab':
      close()
      break
  }
}

// Clicks in the panel (an option, the clear button, the padding) keep focus where it is (search
// box or list), so the keyboard keeps working and the panel stays open for more picks. Otherwise
// the clear button takes focus and loses it when its bar goes away. The search box takes its own
// clicks, and so does the list, whose only own target is its scrollbar.
const handlePanelMousedown = (event: MouseEvent) => {
  if (event.target !== searchRef.value && event.target !== listRef.value) {
    event.preventDefault()
  }
}

useClickOutside(rootRef, () => isOpen.value, close)

// A new query highlights its first match
watch(query, () => {
  if (isOpen.value) setActive(visibleItems.value.length ? 0 : -1)
})

// Losing the items (or being disabled) while open leaves nothing to pick
watch(isDisabled, (disabled) => {
  if (disabled) close()
})
</script>

<style src="@cornflow-ui/core/assets/styles/components/core/CoreMultiSelect.css"></style>
