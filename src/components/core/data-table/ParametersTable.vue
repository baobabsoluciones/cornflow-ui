<!--
  ParametersTable: a table of one record (the parameters of a run: horizon, objective, time
  limit…) shown as a key–value list, one parameter per row.

  - Value: an editor by the type of its `column` (a number or text box, a date, a dropdown for
    lists and yes/no). Numbers are typed with the language's separators and checked when the
    field is left or Enter is pressed; an invalid one keeps what was typed and says why below.
    A modified value is tinted, with a mark in its corner, and its row offers to revert it.
  - Source: where each value comes from, when some row has a `source`. `switch` rows read it
    from the database or not; `choice` rows (a table re-uploaded from Excel) pick one of
    Default, From DB and Fixed. A parameter that can't come from the database says so.
  - `readOnly` shows the values as plain text and the sources without changing them.

  <ParametersTable :rows="rows" @update:value="setValue" @update:source="setSource"
    @revert="revert" />
-->
<template>
  <div
    class="parameters-table"
    :class="{ 'has-source': hasSource }"
    role="table"
    :aria-label="ariaLabel || undefined"
  >
    <div class="parameters-table__row parameters-table__head" role="row">
      <span class="parameters-table__th" role="columnheader">
        <CoreIcon name="mdi-lock-outline" :size="14" />
        {{ $t('dataTable.parameters.parameter') }}
      </span>
      <span class="parameters-table__th" role="columnheader">
        <CoreIcon :name="readOnly ? 'mdi-lock-outline' : 'mdi-pencil-outline'" :size="14" />
        {{ $t('dataTable.parameters.value') }}
      </span>
      <span v-if="hasSource" class="parameters-table__th" role="columnheader">
        <CoreIcon name="mdi-database-outline" :size="14" />
        {{ sourceTitle || $t('dataTable.parameters.source') }}
      </span>
      <span class="parameters-table__th" role="columnheader">
        <span class="parameters-table__sr">{{ $t('dataTable.parameters.revert') }}</span>
      </span>
    </div>

    <div
      v-for="row in rows"
      :key="row.id"
      class="parameters-table__row"
      role="row"
      :data-testid="`parameter-${row.id}`"
    >
      <span class="parameters-table__name" role="rowheader">
        {{ row.label }}
        <span v-if="row.unit" class="parameters-table__unit">({{ row.unit }})</span>
      </span>

      <span
        class="parameters-table__value"
        :class="{ 'is-modified': row.modified, 'is-number': row.column.type === 'number' }"
        role="cell"
      >
        <span v-if="readOnly" class="parameters-table__text">{{ shownValue(row) }}</span>
        <template v-else>
          <CoreSelect
            v-if="isChoice(row)"
            size="small"
            :model-value="row.value"
            :options="choicesOf(row)"
            :placeholder="row.column.required ? $t('dataTable.parameters.choose') : $t('dataTable.parameters.empty')"
            :clearable="!row.column.required"
            :invalid="!!errors[row.id]"
            :aria-label="row.label"
            :data-testid="`parameter-${row.id}-value`"
            @update:model-value="commit(row, $event)"
          />
          <CoreTextField
            v-else
            size="small"
            lazy
            :type="row.column.type === 'date' ? 'date' : 'text'"
            :model-value="drafts[row.id] ?? toEditText(row.value, row.column, locale)"
            :invalid="!!errors[row.id]"
            :inputmode="row.column.type === 'number' ? 'decimal' : undefined"
            :aria-label="row.label"
            :aria-describedby="errors[row.id] ? `parameter-${row.id}-error` : undefined"
            :data-testid="`parameter-${row.id}-value`"
            @update:model-value="commitText(row, $event)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
          <span
            v-if="errors[row.id]"
            :id="`parameter-${row.id}-error`"
            class="parameters-table__error"
          >
            {{ $t(errors[row.id]) }}
          </span>
        </template>
      </span>

      <span v-if="hasSource" class="parameters-table__source" role="cell">
        <span
          v-if="row.source?.mode === 'switch'"
          :title="switchTooltip(row.source)"
          class="parameters-table__switch"
        >
          <CoreSwitch
            :model-value="row.source.fromDatabase && !row.source.disabled"
            :disabled="readOnly || row.source.disabled"
            :label="switchLabel(row.source)"
            :aria-label="`${row.label}: ${$t('dataTable.parameters.fromDatabase')}`"
            :data-testid="`parameter-${row.id}-source`"
            @update:model-value="emit('update:source', row.id, $event)"
          />
        </span>
        <CoreSegmentedControl
          v-else-if="row.source?.mode === 'choice'"
          size="small"
          :model-value="row.source.value"
          :options="choiceOptions(row.source)"
          :data-testid="`parameter-${row.id}-source`"
          @update:model-value="emit('update:source', row.id, $event as SourceChoice)"
        />
      </span>

      <span class="parameters-table__revert" role="cell">
        <CoreButton
          v-if="row.modified && !readOnly"
          variant="icon"
          size="xs"
          icon="mdi-undo"
          :aria-label="$t('dataTable.parameters.revert')"
          :title="$t('dataTable.parameters.revert')"
          :data-testid="`parameter-${row.id}-revert`"
          @click="revert(row)"
        />
      </span>
    </div>

    <CoreEmptyState
      v-if="rows.length === 0"
      icon="mdi-tune-variant"
      :title="$t('dataTable.parameters.none')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSegmentedControl from '@cornflow-ui/core/components/core/CoreSegmentedControl.vue'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreSwitch from '@cornflow-ui/core/components/core/CoreSwitch.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import type { DataColumn, DataColumnOption } from '@cornflow-ui/core/components/core/data-table/types'
import { formatCellValue, parseCellInput, toEditText } from '@cornflow-ui/core/utils/dataTable'

defineOptions({ name: 'ParametersTable' })

/** Where a value of a re-uploaded table comes from. */
export type SourceChoice = 'default' | 'database' | 'fixed'

export type ParameterSource =
  | { mode: 'switch'; fromDatabase: boolean; disabled?: boolean }
  | { mode: 'choice'; value: SourceChoice; databaseDisabled?: boolean }

export interface ParameterRow {
  id: string
  label: string
  unit?: string
  /** Type, options, decimals and `required` of the value. */
  column: DataColumn
  value: unknown
  modified?: boolean
  source?: ParameterSource
}

const props = withDefaults(
  defineProps<{
    rows: ParameterRow[]
    readOnly?: boolean
    /** Header of the source column; "From database" by default. */
    sourceTitle?: string
    ariaLabel?: string
  }>(),
  { readOnly: false, sourceTitle: '', ariaLabel: '' },
)

const emit = defineEmits<{
  'update:value': [id: string, value: unknown]
  'update:source': [id: string, value: boolean | SourceChoice]
  revert: [id: string]
}>()

const { t, locale } = useI18n()

/** What was typed in a field that did not pass, so it stays until fixed. */
const drafts = reactive<Record<string, string>>({})
/** The i18n key of what is wrong with a field. */
const errors = reactive<Record<string, string>>({})

const hasSource = computed(() => props.rows.some((row) => !!row.source))

const isChoice = (row: ParameterRow) =>
  row.column.type === 'list' || row.column.type === 'boolean' || row.column.type === 'switch'

function choicesOf(row: ParameterRow): DataColumnOption[] {
  if (row.column.type === 'list') return row.column.options ?? []
  return [
    { value: true, label: t('table.yes') },
    { value: false, label: t('table.no') },
  ]
}

const shownValue = (row: ParameterRow) =>
  formatCellValue(row.value, row.column, locale.value, t) ?? '—'

function clear(id: string) {
  delete drafts[id]
  delete errors[id]
}

function commit(row: ParameterRow, value: unknown) {
  clear(row.id)
  if (value === row.value) return
  emit('update:value', row.id, value)
}

function commitText(row: ParameterRow, raw: string | number | null) {
  const parsed = parseCellInput(raw, row.column, locale.value)
  if ('error' in parsed) {
    drafts[row.id] = raw === null ? '' : String(raw)
    errors[row.id] = parsed.error
    return
  }
  commit(row, parsed.value)
}

function revert(row: ParameterRow) {
  clear(row.id)
  emit('revert', row.id)
}

function switchLabel(source: { fromDatabase: boolean; disabled?: boolean }) {
  if (source.disabled) return t('dataTable.parameters.notAvailable')
  return source.fromDatabase ? t('table.yes') : t('table.no')
}

function switchTooltip(source: { fromDatabase: boolean; disabled?: boolean }) {
  if (source.disabled) return t('dataTable.parameters.databaseNotAllowed')
  return source.fromDatabase
    ? t('dataTable.parameters.readFromDatabase')
    : t('dataTable.parameters.valueShownUsed')
}

function choiceOptions(source: { databaseDisabled?: boolean }) {
  return [
    {
      value: 'default',
      label: t('dataTable.parameters.default'),
      disabled: props.readOnly,
    },
    {
      value: 'database',
      label: t('dataTable.parameters.database'),
      disabled: props.readOnly || !!source.databaseDisabled,
      title: source.databaseDisabled ? t('dataTable.parameters.databaseNotAllowed') : undefined,
    },
    {
      value: 'fixed',
      label: t('dataTable.parameters.fixed'),
      disabled: props.readOnly,
    },
  ]
}
</script>

<style scoped>
.parameters-table {
  --parameters-columns: minmax(200px, 300px) minmax(200px, 320px) 44px;

  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-x: auto;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
}

.parameters-table.has-source {
  --parameters-columns: minmax(200px, 300px) minmax(200px, 320px) minmax(200px, 300px) 44px;
}

.parameters-table__row {
  display: grid;
  grid-template-columns: var(--parameters-columns);
  min-height: 40px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.parameters-table__row > * {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: calc(var(--spacing) * 1) calc(var(--spacing) * 3);
  border-right: 1px solid var(--color-border-subtle);
}

.parameters-table__row > :last-child {
  border-right: 0;
}

.parameters-table__head {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 38px;
  background: var(--color-surface-muted);
  border-bottom-color: var(--color-border);
}

.parameters-table__th {
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.parameters-table__name {
  gap: calc(var(--spacing) * 1.5);
}

.parameters-table__unit {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}

.parameters-table__value {
  position: relative;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 2px;
}

.parameters-table__value.is-modified {
  background: var(--color-warning-soft);
}

.parameters-table__value.is-modified::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  border-top: 7px solid var(--color-warning);
  border-left: 7px solid transparent;
}

.parameters-table__value.is-number :deep(input) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.parameters-table__value.is-number .parameters-table__text {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.parameters-table__value.is-modified :deep(.core-text-field),
.parameters-table__value.is-modified :deep(.core-select__control) {
  border-color: var(--color-warning-border);
}

.parameters-table__error {
  font-size: var(--text-xs);
  color: var(--color-danger);
}

.parameters-table__switch {
  display: inline-flex;
}

.parameters-table__revert {
  justify-content: center;
  padding: 0;
}

.parameters-table__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
