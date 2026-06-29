import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import CoreBulkUploadModal from '@/components/core/table/CoreBulkUploadModal.vue'

const dialogStub = {
  name: 'v-dialog',
  props: ['modelValue'],
  template: '<div class="v-dialog-stub"><slot /></div>',
}

const makeFile = (name: string, size = 100) => {
  const f = new File(['x'.repeat(size)], name, { type: 'text/plain' })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('CoreBulkUploadModal', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const createWrapper = (props = {}) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {} },
    })
    return mount(CoreBulkUploadModal, {
      props: { modelValue: true, ...props },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-dialog': dialogStub,
          'v-icon': true,
          'v-file-input': {
            name: 'v-file-input',
            props: ['modelValue'],
            template: '<div class="file-input-stub"></div>',
          },
          CoreButton: {
            name: 'CoreButton',
            props: ['text', 'loading', 'disabled'],
            template:
              '<button class="core-button-stub" :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button>',
          },
        },
      },
    })
  }

  test('renders title', () => {
    wrapper = createWrapper({ title: 'Import data' })
    expect(wrapper.text()).toContain('Import data')
  })

  test('showOperationSelection false with single operation', () => {
    wrapper = createWrapper({ availableOperations: ['post_bulk'] })
    expect((wrapper.vm as any).showOperationSelection).toBe(false)
  })

  test('showOperationSelection true with multiple operations', () => {
    wrapper = createWrapper({
      availableOperations: ['post_bulk', 'overwrite_all'],
    })
    expect((wrapper.vm as any).showOperationSelection).toBe(true)
    expect(wrapper.find('.core-bulk-upload-modal__operation-section').exists()).toBe(
      true,
    )
  })

  test('renders all three operation cards when available', () => {
    wrapper = createWrapper({
      availableOperations: ['post_update_bulk', 'post_bulk', 'overwrite_all'],
    })
    expect(
      wrapper.findAll('.core-bulk-upload-modal__option-card'),
    ).toHaveLength(3)
  })

  test('selecting an operation card sets selectedOperation', async () => {
    wrapper = createWrapper({
      availableOperations: ['post_update_bulk', 'post_bulk'],
    })
    await wrapper.findAll('.core-bulk-upload-modal__option-card')[0].trigger(
      'click',
    )
    expect((wrapper.vm as any).selectedOperation).toBe('post_update_bulk')
  })

  test('acceptedFormatsString joins formats', () => {
    wrapper = createWrapper({ acceptedFormats: ['.csv', '.json'] })
    expect((wrapper.vm as any).acceptedFormatsString).toBe('.csv, .json')
  })

  test('defaultOperation returns first available', () => {
    wrapper = createWrapper({ availableOperations: ['overwrite_all'] })
    expect((wrapper.vm as any).defaultOperation).toBe('overwrite_all')
  })

  test('getFileIcon maps extensions', () => {
    wrapper = createWrapper()
    const getFileIcon = (wrapper.vm as any).getFileIcon
    expect(getFileIcon('a.xlsx')).toBe('mdi-file-excel')
    expect(getFileIcon('a.xls')).toBe('mdi-file-excel')
    expect(getFileIcon('a.csv')).toBe('mdi-file-delimited')
    expect(getFileIcon('a.json')).toBe('mdi-code-json')
    expect(getFileIcon('a.pdf')).toBe('mdi-file-pdf-box')
    expect(getFileIcon('a.txt')).toBe('mdi-file-document')
  })

  test('formatFileSize formats bytes', () => {
    wrapper = createWrapper()
    const f = (wrapper.vm as any).formatFileSize
    expect(f(0)).toBe('0 Bytes')
    expect(f(1024)).toBe('1 KB')
    expect(f(1048576)).toBe('1 MB')
  })

  test('handleFileInputUpdate single file mode stores one file', async () => {
    wrapper = createWrapper({ multiple: false, acceptedFormats: ['.csv'] })
    ;(wrapper.vm as any).handleFileInputUpdate(makeFile('a.csv'))
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).normalizedSelectedFiles).toHaveLength(1)
  })

  test('handleFileInputUpdate single file mode with null clears', () => {
    wrapper = createWrapper({ multiple: false })
    ;(wrapper.vm as any).handleFileInputUpdate(null)
    expect((wrapper.vm as any).normalizedSelectedFiles).toHaveLength(0)
  })

  test('handleFileInputUpdate multiple merges unique files', async () => {
    wrapper = createWrapper({ multiple: true, acceptedFormats: ['.csv'] })
    const vm = wrapper.vm as any
    vm.handleFileInputUpdate([makeFile('a.csv')])
    await wrapper.vm.$nextTick()
    vm.handleFileInputUpdate([makeFile('b.csv')])
    await wrapper.vm.$nextTick()
    expect(vm.normalizedSelectedFiles).toHaveLength(2)
  })

  test('handleFileInputUpdate multiple with empty incoming sets empty', () => {
    wrapper = createWrapper({ multiple: true })
    ;(wrapper.vm as any).handleFileInputUpdate([])
    expect((wrapper.vm as any).normalizedSelectedFiles).toHaveLength(0)
  })

  test('validateFiles rejects oversize file and sets errorMessage', () => {
    wrapper = createWrapper({
      multiple: false,
      maxSize: 50,
      acceptedFormats: ['.csv'],
    })
    ;(wrapper.vm as any).validateFiles(makeFile('big.csv', 200))
    expect(wrapper.vm.errorMessage).toMatch(/maximum file size|exceeds/i)
  })

  test('validateFiles rejects unsupported format', () => {
    wrapper = createWrapper({ multiple: false, acceptedFormats: ['.csv'] })
    ;(wrapper.vm as any).validateFiles(makeFile('doc.pdf', 10))
    expect(wrapper.vm.errorMessage).toMatch(/not a supported file format/i)
  })

  test('validateFiles accepts valid file (no error)', () => {
    wrapper = createWrapper({ multiple: false, acceptedFormats: ['.csv'] })
    ;(wrapper.vm as any).validateFiles(makeFile('ok.csv', 10))
    expect(wrapper.vm.errorMessage).toBe('')
  })

  test('validateFiles is a no-op for null', () => {
    wrapper = createWrapper()
    ;(wrapper.vm as any).validateFiles(null)
    expect(wrapper.vm.errorMessage).toBe('')
  })

  test('removeFile removes a file', async () => {
    wrapper = createWrapper({ multiple: true, acceptedFormats: ['.csv'] })
    const vm = wrapper.vm as any
    const fileA = makeFile('a.csv')
    vm.handleFileInputUpdate([fileA, makeFile('b.csv')])
    await wrapper.vm.$nextTick()
    vm.removeFile(fileA)
    await wrapper.vm.$nextTick()
    expect(vm.normalizedSelectedFiles).toHaveLength(1)
  })

  test('hasValidFiles requires files, no error and operation', async () => {
    wrapper = createWrapper({
      multiple: false,
      acceptedFormats: ['.csv'],
      availableOperations: ['post_bulk'],
    })
    expect((wrapper.vm as any).hasValidFiles).toBeFalsy()
    ;(wrapper.vm as any).handleFileInputUpdate(makeFile('a.csv', 10))
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).hasValidFiles).toBeTruthy()
  })

  test('handleUpload emits upload with files and operation', async () => {
    wrapper = createWrapper({
      multiple: false,
      acceptedFormats: ['.csv'],
      availableOperations: ['post_bulk'],
    })
    ;(wrapper.vm as any).handleFileInputUpdate(makeFile('a.csv', 10))
    await wrapper.vm.$nextTick()
    ;(wrapper.vm as any).handleUpload()
    const ev = wrapper.emitted('upload')![0][0] as any
    expect(ev.operation).toBe('post_bulk')
    expect(ev.files).toHaveLength(1)
  })

  test('handleUpload does nothing when invalid', () => {
    wrapper = createWrapper({ availableOperations: ['post_bulk'] })
    ;(wrapper.vm as any).handleUpload()
    expect(wrapper.emitted('upload')).toBeFalsy()
  })

  test('handleCancel emits cancel and update:modelValue false', () => {
    wrapper = createWrapper()
    ;(wrapper.vm as any).handleCancel()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  test('closing modal via watcher resets state', async () => {
    wrapper = createWrapper({
      multiple: false,
      acceptedFormats: ['.csv'],
      modelValue: true,
    })
    ;(wrapper.vm as any).handleFileInputUpdate(makeFile('a.csv', 10))
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ modelValue: false })
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).normalizedSelectedFiles).toHaveLength(0)
    expect((wrapper.vm as any).selectedOperation).toBe(null)
  })
})
