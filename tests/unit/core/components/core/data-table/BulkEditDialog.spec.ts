import { describe, test, expect, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import BulkEditDialog from '@cornflow-ui/core/components/core/data-table/BulkEditDialog.vue'
import type { DataColumn } from '@cornflow-ui/core/components/core/data-table/types'

const i18n = createI18n({
  legacy: false,
  locale: 'es',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    es: {
      table: { yes: 'Sí', no: 'No' },
      dataTable: {
        bulkEdit: {
          noChange: 'Sin cambios',
          nothingSet: 'Ningún campo rellenado',
          fields: '{count} campo | {count} campos',
          changes: '{count} cambio pendiente | {count} cambios pendientes',
        },
      },
    },
  },
})

const columns: DataColumn[] = [
  { key: 'line', title: 'Línea', type: 'text', required: true },
  { key: 'capacity', title: 'Capacidad', type: 'number', unit: 'uds/sem' },
  { key: 'type', title: 'Tipo', type: 'list', options: [{ value: 'Envasado', label: 'Envasado' }] },
  { key: 'active', title: 'Activa', type: 'boolean' },
  { key: 'pinned', title: 'Fijar', type: 'switch' },
]

let wrapper: VueWrapper | undefined

async function mountDialog() {
  wrapper = mount(BulkEditDialog, {
    props: { open: true, columns, count: 3, tableTitle: 'Líneas' },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const field = (key: string) =>
  document.body.querySelector(`[data-testid="bulk-edit-field-${key}"]`) as HTMLElement
const applyButton = () =>
  document.body.querySelector('[data-testid="bulk-edit-apply"]') as HTMLButtonElement
const summary = () => document.body.querySelector('[data-testid="bulk-edit-summary"]')?.textContent

async function type(key: string, value: string) {
  const input = field(key).querySelector('input') as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('BulkEditDialog', () => {
  test('shows a field per column and cannot apply until one is set', async () => {
    await mountDialog()

    expect(columns.every((column) => field(column.key))).toBe(true)
    expect(field('capacity').textContent).toContain('(uds/sem)')
    expect(applyButton().disabled).toBe(true)
    expect(summary()).toBe('Ningún campo rellenado')
  })

  test('applies only the fields set, parsing numbers in the user language', async () => {
    const dialog = await mountDialog()

    await type('capacity', '1.250,5')
    const select = field('type').querySelector('select') as HTMLSelectElement
    select.value = '0'
    select.dispatchEvent(new Event('change'))
    await flushPromises()

    expect(summary()).toBe('2 campos · 6 cambios pendientes')
    applyButton().click()
    await flushPromises()

    expect(dialog.emitted('apply')).toEqual([[{ capacity: 1250.5, type: 'Envasado' }]])
    expect(dialog.emitted('update:open')).toEqual([[false]])
  })

  test('the eraser empties a field in every row; required fields and switches have none', async () => {
    const dialog = await mountDialog()
    const eraser = (key: string) =>
      document.body.querySelector(`[data-testid="bulk-edit-empty-${key}"]`) as HTMLButtonElement | null

    expect(eraser('line')).toBeNull()
    expect(eraser('pinned')).toBeNull()

    eraser('capacity')!.click()
    await flushPromises()
    expect(eraser('capacity')!.getAttribute('aria-pressed')).toBe('true')

    applyButton().click()
    await flushPromises()
    expect(dialog.emitted('apply')).toEqual([[{ capacity: null }]])
  })

  test('a number that does not parse keeps the dialog open and marks the field', async () => {
    const dialog = await mountDialog()

    await type('capacity', 'mucho')
    applyButton().click()
    await flushPromises()

    expect(dialog.emitted('apply')).toBeUndefined()
    expect(field('capacity').textContent).toContain('dataTable.errors.number')
  })
})
