<!--
  ConditionFilterChip: a column filter of a table, shown as "Column: value" with a cross. It
  opens an editor that fits the column's type:

  - text: an operator (contains, is, is not, starts with, is empty, has any value) and a value;
  - number: a range, from and/or to;
  - date: a range of days, from and/or to;
  - list or reference: the values to keep, each with how many rows have it;
  - yes/no: one of the two, with their counts.

  "Apply" stays disabled until the filter is complete and valid; the editor says what is wrong
  ("From" above "To"). A new filter (`isNew`) opens by itself, and closing it without applying
  removes it.

  <ConditionFilterChip :filter="filter" :column="column" :counts="counts" is-new
    @apply="replace" @remove="remove" />
-->
<template>
  <FilterChip
    v-model:open="open"
    :label="column.title"
    :icon="undefined"
    :options="[]"
    :value-text="draftIsEmpty ? '…' : chipValue"
    removable
    :remove-label="$t('dataTable.filters.remove')"
    :menu-width="kind === 'list' ? 280 : 300"
    :auto-open="isNew"
    data-testid="condition-filter-chip"
    @remove="emit('remove', filter.id)"
  >
    <template #panel>
      <div class="condition-filter" @keydown.enter="apply">
        <div class="condition-filter__title">
          <CoreIcon :name="icon" :size="14" />
          {{ column.title }}
        </div>

        <div v-if="kind === 'text'" class="condition-filter__fields">
          <CoreSelect
            v-model="draft.operator"
            size="small"
            :options="operatorOptions"
            :aria-label="$t('dataTable.filters.operator')"
          />
          <CoreTextField
            v-if="needsValue"
            v-model="draft.value"
            size="small"
            :placeholder="$t('dataTable.filters.value')"
            :aria-label="$t('dataTable.filters.value')"
            data-testid="condition-filter-value"
          />
        </div>

        <div v-else-if="kind === 'range' || kind === 'dates'" class="condition-filter__range">
          <label class="condition-filter__field">
            <span>{{ $t('dataTable.filters.from') }}</span>
            <CoreTextField
              v-model="draft.value"
              size="small"
              :type="kind === 'dates' ? 'date' : 'text'"
              :inputmode="kind === 'range' ? 'decimal' : undefined"
              :invalid="!!check.error"
              data-testid="condition-filter-from"
            />
          </label>
          <label class="condition-filter__field">
            <span>{{ $t('dataTable.filters.to') }}</span>
            <CoreTextField
              v-model="draft.value2"
              size="small"
              :type="kind === 'dates' ? 'date' : 'text'"
              :inputmode="kind === 'range' ? 'decimal' : undefined"
              :invalid="!!check.error"
              data-testid="condition-filter-to"
            />
          </label>
        </div>

        <ul v-else class="condition-filter__options" role="listbox" :aria-multiselectable="kind === 'list'">
          <li v-for="option in choiceOptions" :key="String(option.value)" class="condition-filter__option">
            <CoreCheckbox
              :model-value="option.picked"
              :label="option.label"
              class="condition-filter__check"
              :class="{ 'is-radio': kind === 'boolean' }"
              @update:model-value="toggleOption(option.value)"
            />
            <span v-if="option.count !== undefined" class="condition-filter__count">{{ option.count }}</span>
          </li>
          <li v-if="choiceOptions.length === 0" class="condition-filter__empty">
            {{ $t('dataTable.filters.noValues') }}
          </li>
        </ul>

        <p v-if="check.error" class="condition-filter__error" role="alert">{{ $t(check.error) }}</p>

        <div class="condition-filter__footer">
          <CoreButton
            variant="text"
            size="small"
            :text="$t('dataTable.filters.remove')"
            @click="emit('remove', filter.id)"
          />
          <CoreButton
            size="small"
            :text="$t('dataTable.filters.apply')"
            :disabled="!check.ok"
            data-testid="condition-filter-apply"
            @click="apply"
          />
        </div>
      </div>
    </template>
  </FilterChip>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreCheckbox from '@cornflow-ui/core/components/core/CoreCheckbox.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import FilterChip from '@cornflow-ui/core/components/core/filters/FilterChip.vue'
import type {
  DataColumn,
  DataColumnOption,
  DataFilter,
} from '@cornflow-ui/core/components/core/data-table/types'
import {
  TEXT_FILTER_OPERATORS,
  checkFilter,
  filterChipValue,
  filterKindOf,
  operatorNeedsValue,
} from '@cornflow-ui/core/utils/dataTable'

defineOptions({ name: 'ConditionFilterChip' })

const props = withDefaults(
  defineProps<{
    filter: DataFilter
    column: DataColumn
    /** Values a list filter offers, with their row counts. */
    choices?: Array<DataColumnOption & { count?: number }>
    /** Row counts of yes and no, for a yes/no filter. */
    booleanCounts?: { yes: number; no: number }
    isNew?: boolean
  }>(),
  { choices: () => [], booleanCounts: undefined, isNew: false },
)

const emit = defineEmits<{
  apply: [filter: DataFilter]
  remove: [id: string]
}>()

const { t, locale } = useI18n()

const open = ref(false)
const applied = ref(!props.isNew)
const kind = computed(() => filterKindOf(props.column.type))

const cloneFilter = (filter: DataFilter): DataFilter => ({
  ...filter,
  values: [...(filter.values ?? [])],
})
const draft = ref<DataFilter>(cloneFilter(props.filter))

watch(open, (isOpen, wasOpen) => {
  if (isOpen) draft.value = cloneFilter(props.filter)
  else if (wasOpen && !applied.value) emit('remove', props.filter.id)
})

const check = computed(() => checkFilter(draft.value, kind.value))
const needsValue = computed(() => operatorNeedsValue(draft.value.operator))
const draftIsEmpty = computed(() => !applied.value)
const chipValue = computed(() => filterChipValue(props.filter, props.column, locale.value, t))

const TYPE_ICONS: Record<string, string> = {
  text: 'mdi-format-text',
  range: 'mdi-numeric',
  dates: 'mdi-calendar-blank-outline',
  list: 'mdi-format-list-bulleted',
  boolean: 'mdi-checkbox-marked-outline',
}
const icon = computed(() => TYPE_ICONS[kind.value])

const operatorOptions = computed(() =>
  TEXT_FILTER_OPERATORS.map((operator) => ({
    value: operator,
    label: t(`dataTable.filters.operators.${operator}`),
  })),
)

const choiceOptions = computed(() => {
  if (kind.value === 'boolean') {
    return [
      { value: 'true', label: t('table.yes'), count: props.booleanCounts?.yes, picked: draft.value.value === 'true' },
      { value: 'false', label: t('table.no'), count: props.booleanCounts?.no, picked: draft.value.value === 'false' },
    ]
  }
  const picked = draft.value.values ?? []
  return props.choices.map((choice) => ({
    ...choice,
    picked: picked.some((value) => value === choice.value),
  }))
})

function toggleOption(value: unknown) {
  if (kind.value === 'boolean') {
    draft.value = { ...draft.value, operator: 'is', value: String(value) }
    return
  }
  const values = draft.value.values ?? []
  draft.value = {
    ...draft.value,
    operator: 'is_any_of',
    values: values.includes(value) ? values.filter((v) => v !== value) : [...values, value],
  }
}

function apply() {
  if (!check.value.ok) return
  applied.value = true
  emit('apply', cloneFilter(draft.value))
  open.value = false
}
</script>

<style scoped>
.condition-filter {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 3);
  font-family: var(--font-sans);
  font-size: var(--text-md);
}

.condition-filter__title {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.condition-filter__fields {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
}

.condition-filter__range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(var(--spacing) * 2);
}

.condition-filter__field {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.condition-filter__options {
  display: flex;
  flex-direction: column;
  max-height: 260px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.condition-filter__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 1);
  border-radius: var(--radius-sm);
}

.condition-filter__option:hover {
  background: var(--color-surface-hover);
}

.condition-filter__check {
  flex: 1;
  min-width: 0;
}

.condition-filter__check.is-radio :deep(.core-checkbox__box) {
  border-radius: var(--radius-full);
}

.condition-filter__count {
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-subtle);
}

.condition-filter__empty {
  padding: calc(var(--spacing) * 2);
  color: var(--color-text-subtle);
}

.condition-filter__error {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-danger);
}

.condition-filter__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 calc(var(--spacing) * -3) calc(var(--spacing) * -3);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
  border-top: 1px solid var(--color-divider);
}
</style>
