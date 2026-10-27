import { describe, test, expect, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import BulkUploadDialog from '@cornflow-ui/core/components/core/data-table/BulkUploadDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      dataTable: {
        bulkUpload: {
          replaceWarning:
            'The {count} current row of {table} will be deleted. | The {count} current rows of {table} will be deleted.',
          errors: { format: '«{name}» does not have a valid format.' },
          progress: {
            loading: 'Loading data — {rows} row imported | Loading data — {rows} rows imported',
          },
        },
      },
    },
  },
})

let wrapper: VueWrapper | undefined

async function mountDialog(props: Record<string, unknown> = {}) {
  wrapper = mount(BulkUploadDialog, {
    props: { open: true, tableTitle: 'Lines', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const byTestId = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const all = (id: string) => document.body.querySelectorAll(`[data-testid="${id}"]`)

function file(name: string, size = 2048, lastModified = 1) {
  return new File(['x'.repeat(size)], name, { lastModified })
}

async function pick(...files: File[]) {
  const input = byTestId('bulk-upload-input') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  input.dispatchEvent(new Event('change'))
  await flushPromises()
}

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('BulkUploadDialog', () => {
  test('with one operation there are no mode cards; the picked file can be uploaded', async () => {
    const dialog = await mountDialog()

    expect(byTestId('bulk-upload-mode-post_bulk')).toBeNull()
    expect((byTestId('bulk-upload-submit') as HTMLButtonElement).disabled).toBe(true)

    const picked = file('lines.xlsx')
    await pick(picked)
    expect(byTestId('bulk-upload-file')?.textContent).toContain('lines.xlsx')
    expect(byTestId('bulk-upload-file')?.textContent).toContain('XLSX · 2 KB')

    byTestId('bulk-upload-submit')!.click()
    expect(dialog.emitted('upload')).toEqual([[{ files: [picked], operation: 'post_bulk' }]])
  })

  test('the first operation is picked; replacing everything warns how many rows go', async () => {
    const dialog = await mountDialog({
      operations: ['post_update_bulk', 'post_bulk', 'overwrite_all'],
      rowCount: 48,
    })

    expect(byTestId('bulk-upload-mode-post_update_bulk')?.getAttribute('aria-checked')).toBe('true')
    expect(byTestId('bulk-upload-replace-warning')).toBeNull()

    byTestId('bulk-upload-mode-overwrite_all')!.click()
    await flushPromises()
    expect(byTestId('bulk-upload-replace-warning')?.textContent).toContain(
      'The 48 current rows of Lines will be deleted.',
    )

    await pick(file('lines.csv'))
    byTestId('bulk-upload-submit')!.click()
    expect(dialog.emitted('upload')?.[0][0]).toMatchObject({ operation: 'overwrite_all' })
  })

  test('refuses a file of another format', async () => {
    await mountDialog()

    await pick(file('notes.txt'))

    expect(byTestId('bulk-upload-file-error')?.textContent).toContain('«notes.txt» does not have a valid format.')
    expect(byTestId('bulk-upload-file')).toBeNull()
  })

  test('with multiple, the files add up and the same file counts once', async () => {
    await mountDialog({ multiple: true })

    await pick(file('lines.xlsx'), file('products.xlsx'))
    await pick(file('lines.xlsx'))

    expect(all('bulk-upload-file')).toHaveLength(2)
  })

  test('the progress the host reports replaces the form, and an error lets the user pick again', async () => {
    const dialog = await mountDialog()
    await pick(file('lines.xlsx'))

    await dialog.setProps({ phase: 'loading', progressRows: 4200, totalRows: 12430 })
    expect(byTestId('bulk-upload-progress')?.textContent).toContain('Loading data — 4,200 rows imported')
    expect(byTestId('bulk-upload-submit')).toBeNull()

    await dialog.setProps({ phase: 'error', errorText: 'Row 14: unknown product.' })
    expect(byTestId('bulk-upload-progress')?.textContent).toContain('Row 14: unknown product.')

    byTestId('bulk-upload-another')!.click()
    await flushPromises()
    expect(byTestId('bulk-upload-drop')).not.toBeNull()
  })

  test('once done, "View data" asks for the data and closes', async () => {
    const dialog = await mountDialog({ phase: 'done', progressRows: 10 })

    byTestId('bulk-upload-view')!.click()

    expect(dialog.emitted('view-data')).toHaveLength(1)
    expect(dialog.emitted('update:open')).toEqual([[false]])
  })
})
