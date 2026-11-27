<!--
  CoreFigureGrid: a table of figures, rows by columns (resources by day, products by week), where
  each cell holds a number and an optional caption under it ("96%", "+1 shift"). The first column
  stays in view when the table scrolls sideways.

  - `columns`: `title` and `subtitle` head each column. `emphasis` shades a column and makes its
    figures bold (a subtotal); `divider` draws a line before it (the start of a group);
    `reference` greys a column of figures to compare against (a capacity, a target), which are
    not picked.
  - `rows`: each with its `label` and its `cells`, by column key. A missing cell shows a dot.
  - `total`: a row at the foot, in bold.
  - Each figure takes a `tone` only when it needs attention, so a coloured figure stands out.
  - `selectable`: the figures are buttons; `v-model:selected` is the { row, column } picked.
  - `detail` slot: what the picked figure opens, in a panel next to it, with `{ row, column, close }`.

  <CoreFigureGrid row-header="Line" :columns="columns" :rows="rows" :total="total" selectable
    v-model:selected="picked">
    <template #detail="{ row, column }">…</template>
  </CoreFigureGrid>
-->
<template>
  <div class="core-figure-grid">
    <table class="core-figure-grid__table">
      <thead>
        <tr>
          <th class="core-figure-grid__row-head" scope="col">{{ rowHeader }}</th>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            class="core-figure-grid__head"
            :class="columnClasses(column)"
          >
            <span class="core-figure-grid__head-title">{{ column.title }}</span>
            <span v-if="column.subtitle" class="core-figure-grid__head-subtitle">{{ column.subtitle }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <th class="core-figure-grid__row-label" scope="row">{{ row.label }}</th>
          <td
            v-for="column in columns"
            :key="column.key"
            class="core-figure-grid__cell"
            :class="[columnClasses(column), { 'is-selected': isSelected(row.key, column.key) }]"
          >
            <template v-if="row.cells[column.key]">
              <PopoverRoot
                v-if="selectable && !column.reference && $slots.detail"
                :open="isSelected(row.key, column.key)"
                @update:open="(open) => onOpen(row.key, column.key, open)"
              >
                <PopoverTrigger as-child>
                  <button type="button" class="core-figure-grid__figure is-button">
                    <FigureContent :figure="row.cells[column.key]!" />
                  </button>
                </PopoverTrigger>
                <CorePopoverPanel side="bottom" align="center" :width="detailWidth">
                  <slot name="detail" :row="row.key" :column="column.key" :close="close" />
                </CorePopoverPanel>
              </PopoverRoot>
              <button
                v-else-if="selectable && !column.reference"
                type="button"
                class="core-figure-grid__figure is-button"
                :aria-pressed="isSelected(row.key, column.key)"
                @click="onOpen(row.key, column.key, !isSelected(row.key, column.key))"
              >
                <FigureContent :figure="row.cells[column.key]!" />
              </button>
              <span v-else class="core-figure-grid__figure">
                <FigureContent :figure="row.cells[column.key]!" />
              </span>
            </template>
            <span v-else class="core-figure-grid__figure core-figure-grid__empty">·</span>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="total">
        <tr>
          <th class="core-figure-grid__row-label" scope="row">{{ total.label }}</th>
          <td
            v-for="column in columns"
            :key="column.key"
            class="core-figure-grid__cell"
            :class="columnClasses(column)"
          >
            <span v-if="total.cells[column.key]" class="core-figure-grid__figure">
              <FigureContent :figure="total.cells[column.key]!" />
            </span>
            <span v-else class="core-figure-grid__figure core-figure-grid__empty">·</span>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h, type PropType } from 'vue'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import CorePopoverPanel from '@cornflow-ui/core/components/core/CorePopoverPanel.vue'
import type { CoreTone } from '@cornflow-ui/core/types/ui'

defineOptions({ name: 'CoreFigureGrid' })

export interface CoreFigure {
  /** The figure, already formatted. */
  value: string
  caption?: string
  tone?: CoreTone
}

export interface CoreFigureColumn {
  key: string
  title: string
  subtitle?: string
  emphasis?: boolean
  divider?: boolean
  reference?: boolean
}

export interface CoreFigureRow {
  key: string
  label: string
  cells: Record<string, CoreFigure | undefined>
}

export interface CoreFigureSelection {
  row: string
  column: string
}

withDefaults(
  defineProps<{
    rowHeader?: string
    columns: CoreFigureColumn[]
    rows: CoreFigureRow[]
    total?: CoreFigureRow | null
    selectable?: boolean
    detailWidth?: number
  }>(),
  { rowHeader: '', total: null, selectable: false, detailWidth: 380 },
)

const selected = defineModel<CoreFigureSelection | null>('selected', { default: null })

/** The value and the caption of one figure. */
const FigureContent = defineComponent({
  props: { figure: { type: Object as PropType<CoreFigure>, required: true } },
  setup(props) {
    return () => [
      h(
        'span',
        { class: ['core-figure-grid__value', props.figure.tone && `core-tone--${props.figure.tone} is-toned`] },
        props.figure.value,
      ),
      props.figure.caption
        ? h(
            'span',
            { class: ['core-figure-grid__caption', props.figure.tone && `core-tone--${props.figure.tone} is-toned`] },
            props.figure.caption,
          )
        : null,
    ]
  },
})

const columnClasses = (column: CoreFigureColumn) => ({
  'is-emphasis': column.emphasis,
  'has-divider': column.divider,
  'is-reference': column.reference,
})

const isSelected = (row: string, column: string) => selected.value?.row === row && selected.value?.column === column

function onOpen(row: string, column: string, open: boolean) {
  if (open) selected.value = { row, column }
  else if (isSelected(row, column)) selected.value = null
}

function close() {
  selected.value = null
}
</script>

<style scoped>
.core-figure-grid {
  --core-figure-grid-inset: calc(var(--spacing) * 5);
  overflow-x: auto;
  font-family: var(--font-sans);
  color: var(--color-text);
}

.core-figure-grid__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-md);
  font-variant-numeric: tabular-nums;
}

.core-figure-grid__table th,
.core-figure-grid__table td {
  padding: 0;
  border-bottom: 1px solid var(--color-divider);
  text-align: right;
  white-space: nowrap;
}

/* Head */

.core-figure-grid__table thead th {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  vertical-align: bottom;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.core-figure-grid__head-title {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.core-figure-grid__head-subtitle {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

/* First column, kept in view */

.core-figure-grid__row-head,
.core-figure-grid__row-label {
  position: sticky;
  left: 0;
  z-index: 1;
  padding-left: var(--core-figure-grid-inset) !important;
  padding-right: calc(var(--spacing) * 4) !important;
  text-align: left !important;
  background: var(--color-surface);
}

.core-figure-grid__row-head {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.core-figure-grid__row-label {
  font-weight: var(--font-weight-medium);
}

/* Figures */

.core-figure-grid__figure {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  min-height: 52px;
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  box-sizing: border-box;
}

.core-figure-grid__figure.is-button {
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

.core-figure-grid__figure.is-button:hover {
  background: var(--color-surface-hover);
}

.core-figure-grid__figure.is-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.core-figure-grid__cell.is-selected .core-figure-grid__figure {
  background: var(--color-primary-subtle);
  box-shadow: inset 0 0 0 1.5px var(--color-primary);
}

:deep(.core-figure-grid__value) {
  font-weight: var(--font-weight-medium);
}

:deep(.core-figure-grid__caption) {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

:deep(.core-figure-grid__value.is-toned),
:deep(.core-figure-grid__caption.is-toned) {
  color: var(--tone-strong);
}

.core-figure-grid__empty {
  color: var(--color-border-strong);
}

/* Emphasis and dividers */

.core-figure-grid__table .is-emphasis {
  background: var(--color-surface-muted);
}

.core-figure-grid__table thead th.is-emphasis {
  background: var(--color-surface-muted);
}

.is-emphasis :deep(.core-figure-grid__value) {
  font-weight: var(--font-weight-bold);
}

.is-reference :deep(.core-figure-grid__value) {
  font-weight: var(--font-weight-regular);
  color: var(--color-text-muted);
}

.core-figure-grid__table .has-divider {
  border-left: 1px solid var(--color-border);
}

/* Last column keeps the inset of the card */

.core-figure-grid__table tr > :last-child {
  padding-right: calc(var(--core-figure-grid-inset) - var(--spacing) * 3);
}

.core-figure-grid__table thead tr > :last-child {
  padding-right: var(--core-figure-grid-inset);
}

/* Rows */

.core-figure-grid__table tbody tr:hover > * {
  background-color: var(--color-surface-hover);
}

.core-figure-grid__table tbody tr:hover > .is-emphasis {
  background-color: color-mix(in srgb, var(--color-surface-muted) 60%, var(--color-surface-hover));
}

/* Total */

.core-figure-grid__table tfoot th,
.core-figure-grid__table tfoot td {
  border-top: 1px solid var(--color-border);
  border-bottom: 0;
  background: var(--color-surface-muted);
}

.core-figure-grid__table tfoot :deep(.core-figure-grid__value) {
  font-weight: var(--font-weight-bold);
}
</style>
