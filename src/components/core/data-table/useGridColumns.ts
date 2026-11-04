/**
 * The widths of CoreDataGrid's columns: the one each type starts with, the grid template that
 * fills the card, dragging a column's edge and fitting a column to its content.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { DataColumn, DataRow } from './types'

/** Width of the column of row marks (new, deleted, error…). */
export const MARK_WIDTH = 24
const SELECT_WIDTH = 40

const TYPE_WIDTHS: Record<DataColumn['type'], number> = {
  text: 200,
  number: 140,
  boolean: 100,
  list: 140,
  reference: 150,
  date: 130,
  datetime: 170,
  time: 110,
  switch: 96,
}

/** The width a column starts with: its own, or its type's, wider when its title needs it. */
export function defaultWidth(column: DataColumn): number {
  if (column.width) return column.width
  const label = column.title.length + (column.unit ? column.unit.length + 3 : 0)
  return Math.max(TYPE_WIDTHS[column.type], Math.min(320, Math.ceil(label * 7.2 + 62)))
}

let measureContext: CanvasRenderingContext2D | null | undefined

function textWidth(text: string, font: string): number {
  if (measureContext === undefined) {
    measureContext = document.createElement('canvas').getContext('2d')
  }
  if (!measureContext) return text.length * 7.5
  measureContext.font = font
  return measureContext.measureText(text).width
}

export function useGridColumns(options: {
  columns: ComputedRef<DataColumn[]>
  rows: ComputedRef<DataRow[]>
  selectable: ComputedRef<boolean>
  /** Widths the user set, by column key (the grid's `v-model:widths`). */
  widths: Ref<Record<string, number>>
  /** A cell as the grid shows it, to fit a column to its content. */
  displayOf: (row: DataRow, column: DataColumn) => string
}) {
  const { columns, rows, selectable, widths, displayOf } = options

  const selectWidth = computed(() => (selectable.value ? SELECT_WIDTH : 0))
  /** Width of the frozen columns at the left: the checkbox and the row marks. */
  const frozenLeft = computed(() => selectWidth.value + MARK_WIDTH)

  const widthOf = (column: DataColumn) => widths.value[column.key] ?? defaultWidth(column)

  /**
   * The columns without a width of their own grow in proportion to their default width to fill
   * the card; when every column has one, the last one takes what is left.
   */
  const gridTemplate = computed(() => {
    const flexible = columns.value.some((column) => widths.value[column.key] === undefined)
    const last = columns.value.length - 1
    const track = (column: DataColumn, index: number) => {
      const width = widthOf(column)
      if (widths.value[column.key] === undefined) return `minmax(${width}px, ${width}fr)`
      return !flexible && index === last ? `minmax(${width}px, 1fr)` : `${width}px`
    }
    return [selectable.value ? `${selectWidth.value}px` : '', `${MARK_WIDTH}px`, ...columns.value.map(track)]
      .filter(Boolean)
      .join(' ')
  })

  const totalWidth = computed(
    () => frozenLeft.value + columns.value.reduce((sum, column) => sum + widthOf(column), 0),
  )

  const resizing = ref<string | null>(null)
  const headers = new Map<string, Element>()

  function setHeader(key: string, element: unknown) {
    if (element instanceof Element) headers.set(key, element)
    else headers.delete(key)
  }

  const shownWidth = (column: DataColumn) =>
    Math.max(widthOf(column), Math.round(headers.get(column.key)?.getBoundingClientRect().width ?? 0))

  /**
   * The column and those at its left keep the width they show, so the handle follows the
   * pointer while the columns at its right share what is left.
   */
  function startResize(column: DataColumn, event: PointerEvent) {
    event.preventDefault()
    event.stopPropagation()
    const index = columns.value.indexOf(column)
    const shown = Object.fromEntries(columns.value.slice(0, index + 1).map((c) => [c.key, shownWidth(c)]))
    widths.value = { ...widths.value, ...shown }
    const startX = event.clientX
    const startWidth = shown[column.key]
    const maxWidth = Math.max(600, startWidth)
    resizing.value = column.key
    const move = (moveEvent: PointerEvent) => {
      const width = Math.max(56, Math.min(maxWidth, Math.round(startWidth + moveEvent.clientX - startX)))
      widths.value = { ...widths.value, [column.key]: width }
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      resizing.value = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  /** Fits a column to its title and the text of its first thousand rows. */
  function autoFit(column: DataColumn) {
    const title = column.title + (column.unit ? ` (${column.unit})` : '')
    let width = textWidth(title, '500 12px Roboto, sans-serif') + 60
    if (column.type !== 'switch') {
      for (const row of rows.value.slice(0, 1000)) {
        width = Math.max(width, textWidth(displayOf(row, column), '400 13px Roboto, sans-serif') + 24)
      }
    }
    widths.value = { ...widths.value, [column.key]: Math.max(56, Math.min(600, Math.ceil(width))) }
  }

  return { selectWidth, frozenLeft, widthOf, gridTemplate, totalWidth, resizing, setHeader, startResize, autoFit }
}
