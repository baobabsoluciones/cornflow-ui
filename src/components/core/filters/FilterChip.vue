<template>
  <v-menu
    v-model="open"
    location="bottom start"
    offset="6"
    :close-on-content-click="false"
  >
    <template #activator="{ props: activator }">
      <div
        class="filter-chip"
        :class="{ 'is-set': hasValue, 'is-open': open }"
        v-bind="$attrs"
      >
        <button type="button" class="filter-chip__main" v-bind="activator">
          <v-icon v-if="icon" size="18" class="filter-chip__icon">{{
            icon
          }}</v-icon>
          <span class="filter-chip__label">{{ label }}:</span>
          <span class="filter-chip__value">{{ valueTitle }}</span>
          <v-icon v-if="!removable" size="18" class="filter-chip__chevron">
            mdi-menu-down
          </v-icon>
        </button>
        <button
          v-if="removable"
          type="button"
          class="filter-chip__remove"
          :aria-label="removeLabel"
          data-testid="filter-chip-remove"
          @click="emit('remove')"
        >
          <v-icon size="16">mdi-close</v-icon>
        </button>
      </div>
    </template>

    <div class="filter-menu" role="listbox" :aria-label="label">
      <div class="filter-menu__caption">{{ label }}</div>
      <button
        v-for="option in items"
        :key="String(option.value)"
        type="button"
        role="option"
        class="filter-menu__option"
        :class="{ 'is-selected': isSelected(option.value) }"
        :aria-selected="isSelected(option.value)"
        :data-testid="`filter-option-${String(option.value)}`"
        @click="pick(option.value)"
      >
        <v-icon size="20" class="filter-menu__radio">{{
          isSelected(option.value)
            ? 'mdi-radiobox-marked'
            : 'mdi-radiobox-blank'
        }}</v-icon>
        <span class="filter-menu__title">{{ option.title }}</span>
        <span
          v-if="showCounts && option.count !== undefined"
          class="filter-menu__count"
          >{{ option.count }}</span
        >
      </button>
      <slot name="after-options" />
    </div>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

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
  },
)

const emit = defineEmits<{
  pick: [value: unknown]
  remove: []
}>()

const open = ref(false)

/** Same value on both sides, comparing as text (ids may come as numbers or strings). */
const isSame = (a: unknown, b: unknown): boolean =>
  a === b || (a != null && b != null && String(a) === String(b))

const items = computed<FilterChipOption[]>(() => [
  ...(props.allLabel !== undefined
    ? [{ value: null, title: props.allLabel }]
    : []),
  ...props.options,
])

const hasValue = computed(
  () => props.value !== null && props.value !== undefined,
)

const isSelected = (value: unknown): boolean =>
  value === null ? !hasValue.value : isSame(value, props.value)

const valueTitle = computed(
  () =>
    items.value.find((option) => isSelected(option.value))?.title ??
    props.allLabel ??
    '',
)

function pick(value: unknown) {
  emit('pick', value)
  if (
    props.keepOpenValue === undefined ||
    !isSame(value, props.keepOpenValue)
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
  height: 44px;
  border: 1px solid color-mix(in srgb, var(--primary) 22%, #fff);
  border-radius: 10px;
  background-color: color-mix(in srgb, var(--primary) 6%, #fff);
  color: var(--title);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.filter-chip:hover {
  border-color: color-mix(in srgb, var(--primary) 45%, #fff);
}

.filter-chip.is-set {
  border-color: color-mix(in srgb, var(--primary) 45%, #fff);
  background-color: color-mix(in srgb, var(--primary) 12%, #fff);
}

.filter-chip.is-open {
  border-color: var(--primary);
  background-color: var(--primary);
  color: #fff;
}

.filter-chip__main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 10px 0 14px;
  font-size: 0.9375rem;
  white-space: nowrap;
}

.filter-chip__icon {
  color: inherit;
  opacity: 0.85;
}

.filter-chip__label {
  color: var(--subtitle);
}

.filter-chip.is-open .filter-chip__label {
  color: rgba(255, 255, 255, 0.8);
}

.filter-chip__value {
  font-weight: 700;
  color: inherit;
}

.filter-chip__remove {
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding: 0 12px 0 2px;
  color: inherit;
  opacity: 0.75;
}

.filter-chip__remove:hover {
  opacity: 1;
}

.filter-chip__main:focus-visible,
.filter-chip__remove:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 8px;
}
</style>

<style>
/* The menu is teleported out of the chip, so its styles cannot be scoped. */
.filter-menu {
  min-width: 260px;
  max-height: 420px;
  overflow-y: auto;
  padding: 10px 8px;
  border-radius: 14px;
  background-color: #fff;
  box-shadow:
    0 10px 30px rgba(16, 24, 40, 0.12),
    0 2px 6px rgba(16, 24, 40, 0.06);
}

.filter-menu__caption {
  padding: 8px 12px 6px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--subtitle);
}

.filter-menu__option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 0.9375rem;
  color: var(--title);
  text-align: left;
}

.filter-menu__option:hover {
  background-color: color-mix(in srgb, var(--primary) 6%, #fff);
}

.filter-menu__option.is-selected {
  background-color: color-mix(in srgb, var(--primary) 10%, #fff);
}

.filter-menu__radio {
  color: var(--title);
}

.filter-menu__title {
  flex: 1;
}

.filter-menu__count {
  font-size: 0.8125rem;
  color: var(--subtitle);
}
</style>
