<!--
  DataGridEditor: the field that edits one cell of a data grid, by the column's type: a text box
  (text, numbers in the user's format, dates, times) or a dropdown (lists, references, yes/no).

  - `v-model`: the text being typed, or the picked value of a dropdown.
  - Enter commits and moves down (Shift+Enter up), Tab commits and moves sideways, Escape
    cancels: `commit` carries the move, `cancel` has none. With `commitOnPick`, picking an option
    commits at once.
  - `loading` shows that the options of a reference are still coming.
  - `bordered` draws the field's box (the row being added); without it the cell is the box.
-->
<template>
  <span v-if="loading" class="data-grid-editor__loading">
    <CoreSpinner :size="14" />
    {{ $t('dataTable.grid.loadingOptions') }}
  </span>
  <CoreSelect
    v-else-if="isSelect"
    ref="field"
    size="small"
    class="data-grid-editor"
    :class="{ 'is-bare': !bordered }"
    :model-value="modelValue"
    :options="selectOptions"
    :placeholder="column.required ? $t('dataTable.grid.choose') : $t('dataTable.grid.emptyOption')"
    :clearable="!column.required"
    :invalid="invalid"
    :aria-label="column.title"
    @update:model-value="pick"
    @keydown="onKey"
  />
  <CoreTextField
    v-else
    ref="field"
    size="small"
    class="data-grid-editor"
    :class="{ 'is-bare': !bordered, 'is-number': column.type === 'number' }"
    :type="inputType"
    :inputmode="column.type === 'number' ? 'decimal' : undefined"
    :model-value="modelValue as string"
    :invalid="invalid"
    :aria-label="column.title"
    @update:model-value="emit('update:modelValue', $event)"
    @keydown="onKey"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import type { DataColumn, DataColumnOption } from './types'

defineOptions({ name: 'DataGridEditor' })

/** Where the active cell goes after a commit: rows down (or up), columns right (or left). */
export interface GridMove {
  rows: number
  columns: number
}

const props = withDefaults(
  defineProps<{
    column: DataColumn
    modelValue: unknown
    options?: DataColumnOption[]
    loading?: boolean
    invalid?: boolean
    bordered?: boolean
    commitOnPick?: boolean
  }>(),
  { options: undefined, loading: false, invalid: false, bordered: false, commitOnPick: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  commit: [move: GridMove]
  cancel: []
}>()

const { t } = useI18n()

const isSelect = computed(() => ['list', 'reference', 'boolean'].includes(props.column.type))

const selectOptions = computed<DataColumnOption[]>(() => {
  if (props.column.type === 'boolean') {
    return [
      { value: true, label: t('table.yes') },
      { value: false, label: t('table.no') },
    ]
  }
  return props.options ?? props.column.options ?? []
})

const INPUT_TYPES: Partial<Record<DataColumn['type'], 'date' | 'time' | 'datetime-local'>> = {
  date: 'date',
  time: 'time',
  datetime: 'datetime-local',
}
const inputType = computed(() => INPUT_TYPES[props.column.type] ?? 'text')

function pick(value: unknown) {
  emit('update:modelValue', value)
  if (props.commitOnPick) emit('commit', { rows: 0, columns: 0 })
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('commit', { rows: event.shiftKey ? -1 : 1, columns: 0 })
  } else if (event.key === 'Tab') {
    event.preventDefault()
    emit('commit', { rows: 0, columns: event.shiftKey ? -1 : 1 })
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  } else {
    return
  }
  event.stopPropagation()
}

const field = ref<{ focus?: () => void; $el?: HTMLElement }>()

function focus() {
  if (field.value?.focus) {
    field.value.focus()
    return
  }
  field.value?.$el?.querySelector<HTMLElement>('select, input')?.focus()
}

// The options of a reference arrive after the editor opens: the dropdown takes the focus then.
watch(
  () => props.loading,
  (loading, wasLoading) => {
    if (wasLoading && !loading) nextTick(focus)
  },
)

defineExpose({ focus })
</script>

<style scoped>
.data-grid-editor {
  width: 100%;
}

.data-grid-editor.is-number :deep(input) {
  text-align: right;
}

/* In a cell the cell is the box: no border of its own, the cell's ring shows the focus. */
.data-grid-editor.is-bare,
.data-grid-editor.is-bare:hover,
.data-grid-editor.is-bare:focus-within {
  height: 100%;
  border-color: transparent;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.data-grid-editor.is-bare :deep(select) {
  height: 100%;
  border-color: transparent;
  border-radius: 0;
  background-color: transparent;
  box-shadow: none;
}

.data-grid-editor__loading {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}
</style>
