<!--
  BulkEditDialog: sets the same value in a column of every selected row.

  One field per column it gets (the editable ones, with their options loaded). A field left as
  "No change" is not touched; the eraser of a field that is not required empties it in every row.
  Text and numbers are checked as the table checks a cell (a number in the user's language).

  `apply` gives only the fields to change: `{ capacity: 1200, comment: null }` (null = emptied).

  <BulkEditDialog v-model:open="bulkOpen" :columns="editableColumns" :count="selected.length"
    table-title="Lines" @apply="applyToSelected" />
-->
<template>
  <CoreDialog
    :model-value="open"
    :title="$t('dataTable.bulkEdit.title')"
    :width="640"
    closable
    @update:model-value="emit('update:open', $event)"
  >
    <p class="bulk-edit__subtitle">
      {{ $t('dataTable.bulkEdit.subtitle', { table: tableTitle }, count) }}
    </p>
    <p class="bulk-edit__hint">
      <CoreIcon name="mdi-information-outline" :size="14" />
      {{ $t('dataTable.bulkEdit.hint') }}
    </p>

    <div class="bulk-edit__fields">
      <div
        v-for="column in columns"
        :key="column.key"
        class="bulk-edit__field"
        :data-testid="`bulk-edit-field-${column.key}`"
      >
        <label class="bulk-edit__label" :for="fieldId(column.key)">
          {{ column.title }}
          <span v-if="column.unit" class="bulk-edit__unit">({{ column.unit }})</span>
        </label>
        <div class="bulk-edit__control">
          <CoreSelect
            v-if="isSelect(column)"
            :id="fieldId(column.key)"
            class="bulk-edit__input"
            :model-value="cleared[column.key] ? null : values[column.key]"
            :options="optionsOf(column)"
            :placeholder="placeholderOf(column.key)"
            :disabled="cleared[column.key]"
            :invalid="!!errors[column.key]"
            clearable
            @update:model-value="setValue(column.key, $event)"
          />
          <CoreTextField
            v-else
            :id="fieldId(column.key)"
            class="bulk-edit__input"
            :class="{ 'is-number': column.type === 'number' }"
            :type="inputTypeOf(column)"
            :inputmode="column.type === 'number' ? 'decimal' : undefined"
            :model-value="cleared[column.key] ? '' : textOf(column.key)"
            :placeholder="placeholderOf(column.key)"
            :disabled="cleared[column.key]"
            :invalid="!!errors[column.key]"
            @update:model-value="setValue(column.key, $event)"
          />
          <button
            v-if="canEmpty(column)"
            type="button"
            class="bulk-edit__empty"
            :class="{ 'is-on': cleared[column.key] }"
            :aria-pressed="!!cleared[column.key]"
            :aria-label="emptyLabel(column)"
            :title="emptyLabel(column)"
            :data-testid="`bulk-edit-empty-${column.key}`"
            @click="toggleEmpty(column.key)"
          >
            <CoreIcon name="mdi-eraser" :size="16" />
          </button>
          <span
            v-else-if="column.required"
            class="bulk-edit__required"
            :title="$t('dataTable.bulkEdit.required')"
          >
            <CoreIcon name="mdi-asterisk" :size="12" />
          </span>
        </div>
        <span v-if="errors[column.key]" class="bulk-edit__error">
          {{ $t(errors[column.key]) }}
        </span>
      </div>
    </div>

    <template #actions>
      <span class="bulk-edit__summary" data-testid="bulk-edit-summary">{{ summary }}</span>
      <CoreButton
        variant="text"
        :text="$t('dataTable.bulkEdit.cancel')"
        @click="emit('update:open', false)"
      />
      <CoreButton
        :text="$t('dataTable.bulkEdit.apply', { count }, count)"
        :disabled="fieldCount === 0"
        data-testid="bulk-edit-apply"
        @click="apply"
      />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import type {
  DataColumn,
  DataColumnOption,
} from '@cornflow-ui/core/components/core/data-table/types'
import { cellText, parseCellInput } from '@cornflow-ui/core/utils/dataTable'

defineOptions({ name: 'BulkEditDialog' })

const props = defineProps<{
  open: boolean
  /** The columns that can be edited, with the options of lists and references loaded. */
  columns: DataColumn[]
  /** Rows selected. */
  count: number
  tableTitle: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  apply: [values: Record<string, unknown>]
}>()

const { t, locale } = useI18n()

/** What each field holds; a missing (or null) entry means "No change". */
const values = reactive<Record<string, unknown>>({})
/** Fields to empty in every row. */
const cleared = reactive<Record<string, boolean>>({})
/** Error key of each field that does not parse. */
const errors = reactive<Record<string, string>>({})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    for (const record of [values, cleared, errors]) {
      for (const key of Object.keys(record)) delete record[key]
    }
  },
  { immediate: true },
)

const SELECT_TYPES = new Set(['list', 'reference', 'boolean', 'switch'])
const INPUT_TYPES: Record<string, 'date' | 'time' | 'datetime-local'> = {
  date: 'date',
  time: 'time',
  datetime: 'datetime-local',
}

const isSelect = (column: DataColumn) => SELECT_TYPES.has(column.type)
const inputTypeOf = (column: DataColumn) => INPUT_TYPES[column.type] ?? 'text'
const canEmpty = (column: DataColumn) => !column.required && column.type !== 'switch'
const fieldId = (key: string) => `bulk-edit-${key}`

function optionsOf(column: DataColumn): DataColumnOption[] {
  if (column.type === 'boolean' || column.type === 'switch') {
    return [
      { value: true, label: t('table.yes') },
      { value: false, label: t('table.no') },
    ]
  }
  return column.options ?? []
}

function placeholderOf(key: string): string {
  return cleared[key] ? t('dataTable.bulkEdit.emptied') : t('dataTable.bulkEdit.noChange')
}

function emptyLabel(column: DataColumn): string {
  return cleared[column.key]
    ? t('dataTable.bulkEdit.keep', { field: column.title })
    : t('dataTable.bulkEdit.empty', { field: column.title })
}

const isSet = (key: string) =>
  values[key] !== undefined && values[key] !== null && values[key] !== ''

const textOf = (key: string) => (isSet(key) ? cellText(values[key]) : '')

function setValue(key: string, value: unknown) {
  values[key] = value
  delete errors[key]
}

function toggleEmpty(key: string) {
  cleared[key] = !cleared[key]
  delete values[key]
  delete errors[key]
}

const fieldCount = computed(
  () => props.columns.filter((column) => cleared[column.key] || isSet(column.key)).length,
)

const summary = computed(() => {
  if (fieldCount.value === 0) return t('dataTable.bulkEdit.nothingSet')
  const changes = fieldCount.value * props.count
  return `${t('dataTable.bulkEdit.fields', { count: fieldCount.value }, fieldCount.value)} · ${t(
    'dataTable.bulkEdit.changes',
    { count: changes },
    changes,
  )}`
})

function apply() {
  const result: Record<string, unknown> = {}
  for (const column of props.columns) {
    if (cleared[column.key]) {
      result[column.key] = null
    } else if (isSet(column.key)) {
      if (isSelect(column)) {
        result[column.key] = values[column.key]
      } else {
        const parsed = parseCellInput(values[column.key], column, locale.value)
        if ('error' in parsed) errors[column.key] = parsed.error
        else result[column.key] = parsed.value
      }
    }
  }
  if (Object.keys(errors).length > 0) return
  emit('apply', result)
  emit('update:open', false)
}
</script>

<style scoped>
.bulk-edit__subtitle {
  margin: calc(var(--spacing) * -2) 0 0;
  color: var(--color-text-muted);
}

.bulk-edit__hint {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  margin: calc(var(--spacing) * 2) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.bulk-edit__fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: calc(var(--spacing) * 4) calc(var(--spacing) * 4);
  margin-top: calc(var(--spacing) * 4);
}

.bulk-edit__field {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
}

.bulk-edit__label {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.bulk-edit__unit {
  font-weight: var(--font-weight-regular);
  color: var(--color-text-subtle);
}

.bulk-edit__control {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
}

.bulk-edit__input {
  flex: 1;
  min-width: 0;
}

.bulk-edit__input.is-number :deep(input) {
  text-align: right;
}

.bulk-edit__empty {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}

.bulk-edit__empty:hover {
  background: var(--color-surface-hover);
}

.bulk-edit__empty.is-on {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--color-danger-strong);
}

.bulk-edit__required {
  flex: none;
  display: inline-flex;
  justify-content: center;
  width: 34px;
  color: var(--color-text-subtle);
}

.bulk-edit__error {
  font-size: var(--text-sm);
  color: var(--color-danger-strong);
}

.bulk-edit__summary {
  margin-right: auto;
  align-self: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
