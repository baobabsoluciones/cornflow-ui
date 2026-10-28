<!--
  FilterChip: a filter of a list, shown as "Label  Value". Clicking it opens the options; picking
  one emits `pick` and closes the menu.

  A chip with a picked value (or open) is tinted in the primary. A `removable` chip is a filter the
  user added: it shows a cross that emits `remove` instead of the chevron.

  The `panel` slot replaces the list of options with an editor of its own (a condition with an
  operator, a range…); `valueText` is then the value the chip shows, and the slot gets `close`.
-->
<template>
  <PopoverRoot v-model:open="open">
    <PopoverAnchor as-child>
      <div
        class="filter-chip"
        :class="{
          'is-set': hasValue,
          'is-open': open,
          'is-removable': removable,
        }"
        v-bind="$attrs"
      >
        <PopoverTrigger as-child>
          <button type="button" class="filter-chip__main">
            <CoreIcon
              v-if="icon"
              :name="icon"
              :size="16"
              class="filter-chip__icon"
            />
            <span class="filter-chip__label">{{
              removable ? `${label}:` : label
            }}</span>
            <span class="filter-chip__value">{{ valueTitle }}</span>
            <CoreIcon
              v-if="!removable"
              :name="open ? 'mdi-menu-up' : 'mdi-menu-down'"
              :size="18"
              class="filter-chip__chevron"
            />
          </button>
        </PopoverTrigger>
        <button
          v-if="removable"
          type="button"
          class="filter-chip__remove"
          :aria-label="removeLabel"
          :title="removeLabel"
          data-testid="filter-chip-remove"
          @click="emit('remove')"
        >
          <CoreIcon name="mdi-close" :size="14" />
        </button>
      </div>
    </PopoverAnchor>
    <CorePopoverPanel :width="menuWidth">
      <slot v-if="$slots.panel" name="panel" :close="() => (open = false)" />
      <CoreMenu
        v-else
        :title="label"
        selectable
        :items="menuItems"
        @select="pick($event.key)"
      >
        <slot name="after-options" />
      </CoreMenu>
    </CorePopoverPanel>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue'
import { PopoverAnchor, PopoverRoot, PopoverTrigger } from 'reka-ui'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreMenu from '@cornflow-ui/core/components/core/CoreMenu.vue'
import type { CoreMenuItem } from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CorePopoverPanel from '@cornflow-ui/core/components/core/CorePopoverPanel.vue'

defineOptions({ name: 'CoreFilterChip', inheritAttrs: false })

export interface FilterChipOption {
  value: unknown
  title: string
  /** Rows the option would leave; shown with `showCounts`. */
  count?: number
}

const props = withDefaults(
  defineProps<{
    label: string
    icon?: string
    /** Picked value; `null` is "All". */
    value?: unknown
    options: FilterChipOption[]
    /** Text of the "All" option, listed first. Without it there is no "All" option. */
    allLabel?: string
    showCounts?: boolean
    /** Shows a cross that emits `remove` instead of the chevron. */
    removable?: boolean
    removeLabel?: string
    /** Opens the menu as soon as the chip appears (e.g. right after adding the filter). */
    autoOpen?: boolean
    /** Picking this value keeps the menu open (e.g. a custom range that needs more input). */
    keepOpenValue?: unknown
    /** Width of the menu, in px. */
    menuWidth?: number
    /** The value shown on the chip, instead of the title of the picked option. */
    valueText?: string
  }>(),
  {
    icon: undefined,
    value: null,
    allLabel: undefined,
    showCounts: false,
    removable: false,
    removeLabel: undefined,
    autoOpen: false,
    keepOpenValue: undefined,
    menuWidth: 260,
    valueText: undefined,
  },
)

const emit = defineEmits<{
  pick: [value: unknown]
  remove: []
}>()

const open = defineModel<boolean>('open', { default: false })

/** Same value on both sides, comparing as text (ids may come as numbers or strings). */
const isSame = (a: unknown, b: unknown): boolean =>
  a === b || (a != null && b != null && String(a) === String(b))

const options = computed<FilterChipOption[]>(() => [
  ...(props.allLabel !== undefined
    ? [{ value: null, title: props.allLabel }]
    : []),
  ...props.options,
])

const hasValue = computed(
  () => props.valueText !== undefined || (props.value !== null && props.value !== undefined),
)

const isSelected = (value: unknown): boolean =>
  value === null ? !hasValue.value : isSame(value, props.value)

const valueTitle = computed(
  () =>
    props.valueText ??
    options.value.find((option) => isSelected(option.value))?.title ??
    props.allLabel ??
    '',
)

const menuItems = computed<CoreMenuItem[]>(() =>
  options.value.map((option) => ({
    key: String(option.value),
    label: option.title,
    selected: isSelected(option.value),
    count: props.showCounts ? option.count : undefined,
    testId: `filter-option-${String(option.value)}`,
  })),
)

function pick(key: string) {
  const option = options.value.find(
    (candidate) => String(candidate.value) === key,
  )
  if (!option) return
  emit('pick', option.value)
  if (
    props.keepOpenValue === undefined ||
    !isSame(option.value, props.keepOpenValue)
  ) {
    open.value = false
  }
}

onMounted(async () => {
  if (!props.autoOpen) return
  await nextTick()
  open.value = true
})
</script>

<style scoped>
.filter-chip {
  display: inline-flex;
  align-items: center;
  height: 32px;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
  transition:
    background-color var(--duration-base) var(--ease-standard),
    border-color var(--duration-base) var(--ease-standard);
}

.filter-chip:hover {
  border-color: var(--color-primary);
}

.filter-chip.is-set,
.filter-chip.is-open {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.filter-chip.is-removable {
  border-color: color-mix(in srgb, var(--color-primary) 25%, var(--color-surface));
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.filter-chip__main {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  height: 100%;
  min-width: 0;
  padding: 0 calc(var(--spacing) * 1.5) 0 calc(var(--spacing) * 2.5);
  border: 0;
  border-radius: inherit;
  background: none;
  font: inherit;
  color: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.is-removable .filter-chip__main {
  padding-right: calc(var(--spacing) * 0.5);
}

.filter-chip__icon,
.filter-chip__chevron {
  color: var(--color-text-muted);
}

.filter-chip.is-set .filter-chip__icon,
.filter-chip.is-open .filter-chip__icon,
.filter-chip.is-set .filter-chip__chevron,
.filter-chip.is-open .filter-chip__chevron,
.is-removable .filter-chip__icon {
  color: inherit;
}

.filter-chip__chevron {
  margin-left: -2px;
}

.filter-chip__label {
  color: var(--color-text-muted);
}

.filter-chip.is-set .filter-chip__label,
.filter-chip.is-open .filter-chip__label,
.is-removable .filter-chip__label {
  color: inherit;
}

.filter-chip__value {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: var(--font-weight-medium);
}

.filter-chip__remove {
  display: inline-flex;
  align-items: center;
  margin: 0 calc(var(--spacing) * 1.5) 0 calc(var(--spacing) * 0.5);
  padding: 2px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: inherit;
  cursor: pointer;
}

.filter-chip__remove:hover {
  background: color-mix(in srgb, var(--color-text) 10%, transparent);
}

.filter-chip__main:focus-visible,
.filter-chip__remove:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
