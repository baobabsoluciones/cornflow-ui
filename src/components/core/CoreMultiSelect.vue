<!--
  CoreMultiSelect: a dropdown to pick several of a list of options, of any type (numbers, ids…).

  - `v-model`: the values of the picked options, in the order of `options`; nothing picked is `[]`.
  - The box shows the picked options ("North, South +3"), or `placeholder` while there are none.
  - The list has a search box when there are more than a few options, and a footer to clear the
    picks. Picking keeps the list open, so several can be picked in a row.
  - `invalid` marks it in the danger tone, like CoreSelect.

  <CoreMultiSelect v-model="plants" :options="plantOptions" placeholder="All plants"
    search-placeholder="Search…" no-matches-text="No matches" clear-text="Clear" />
-->
<template>
  <CorePopover v-model:open="open" width="var(--reka-popover-trigger-width)">
    <template #trigger>
      <button
        v-bind="controlAttrs"
        type="button"
        :class="[
          'core-multi-select',
          { 'is-empty': picked.length === 0, 'is-invalid': invalid, 'is-open': open },
          $attrs.class,
        ]"
        :style="$attrs.style as StyleValue"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
      >
        <span class="core-multi-select__text">{{ boxText }}</span>
        <CoreIcon name="mdi-chevron-down" :size="18" class="core-multi-select__chevron" />
      </button>
    </template>
    <CoreMenu
      v-model:query="query"
      :items="items"
      multiple
      :searchable="options.length > SEARCH_FROM"
      :search-placeholder="searchPlaceholder"
      :empty-text="noMatchesText"
      @select="toggle($event.key)"
    >
      <div v-if="clearText" class="core-multi-select__footer">
        <span class="core-multi-select__count">{{ picked.length }} / {{ options.length }}</span>
        <CoreButton
          variant="text"
          size="small"
          :text="clearText"
          :disabled="picked.length === 0"
          @click="emit('update:modelValue', [])"
        />
      </div>
    </CoreMenu>
  </CorePopover>
</template>

<script lang="ts">
/** Text of a list of picked labels: the first ones, and how many more there are. */
export function pickedSummary(labels: string[], shown = 2): string {
  if (labels.length <= shown) return labels.join(', ')
  return `${labels.slice(0, shown).join(', ')} +${labels.length - shown}`
}
</script>

<script setup lang="ts">
import { computed, ref, useAttrs, watch, type StyleValue } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreMenu, { type CoreMenuItem } from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import type { CoreSelectOption } from '@cornflow-ui/core/components/core/CoreSelect.vue'

defineOptions({ name: 'CoreMultiSelect', inheritAttrs: false })

interface Props {
  modelValue?: unknown[] | null
  options: CoreSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  /** Shown when the search leaves no option. */
  noMatchesText?: string
  /** Text of the button that unpicks every option; without it the list has no footer. */
  clearText?: string
  invalid?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  placeholder: '',
  searchPlaceholder: '',
  noMatchesText: '',
  clearText: '',
  invalid: false,
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: unknown[]] }>()

/** The search box shows up from this many options. */
const SEARCH_FROM = 7

const attrs = useAttrs()
const controlAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const open = ref(false)
const query = ref('')

watch(open, (isOpen) => {
  if (!isOpen) query.value = ''
})

const pickedValues = computed(() => props.modelValue ?? [])

/** The options picked, in the order of `options`. */
const picked = computed(() =>
  props.options.filter((option) => pickedValues.value.includes(option.value)),
)

const boxText = computed(() =>
  picked.value.length === 0
    ? props.placeholder
    : pickedSummary(picked.value.map((option) => option.label)),
)

// The menu works with the position of the option, so the values can be of any type.
const items = computed<CoreMenuItem[]>(() => {
  const text = query.value.trim().toLowerCase()
  return props.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !text || option.label.toLowerCase().includes(text))
    .map(({ option, index }) => ({
      key: String(index),
      label: option.label,
      selected: pickedValues.value.includes(option.value),
    }))
})

function toggle(key: string) {
  const value = props.options[Number(key)]?.value
  const next = pickedValues.value.includes(value)
    ? pickedValues.value.filter((v) => v !== value)
    : [...pickedValues.value, value]
  emit(
    'update:modelValue',
    props.options.map((option) => option.value).filter((v) => next.includes(v)),
  )
}
</script>

<style scoped>
.core-multi-select {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 calc(var(--spacing) * 8) 0 calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  outline: none;
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}

.core-multi-select:hover {
  border-color: var(--color-border-strong);
}

.core-multi-select:focus-visible,
.core-multi-select.is-open {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.core-multi-select.is-empty {
  color: var(--color-text-subtle);
}

.core-multi-select.is-invalid {
  border-color: var(--color-danger);
}

.core-multi-select.is-invalid:focus-visible {
  box-shadow: 0 0 0 2px var(--color-danger-soft);
}

.core-multi-select:disabled {
  background: var(--color-disabled);
  opacity: 0.7;
  cursor: default;
}

.core-multi-select__text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.core-multi-select__chevron {
  position: absolute;
  top: 50%;
  right: calc(var(--spacing) * 2);
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.core-multi-select__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: calc(var(--spacing) * 1.5);
  padding-top: calc(var(--spacing) * 1.5);
  border-top: 1px solid var(--color-border-subtle);
}

.core-multi-select__count {
  padding-left: calc(var(--spacing) * 1);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>
