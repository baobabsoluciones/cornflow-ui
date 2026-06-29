import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

// Hoisted mock state for the useFormFields composable
const formFieldsMock = vi.hoisted(() => {
  return { instance: null as any }
})

vi.mock('@/composables/core-table/useFormFields', () => {
  return {
    useFormFields: () => formFieldsMock.instance,
  }
})

import CoreModal from '@/components/core/table/CoreModal.vue'

const dialogStub = {
  name: 'v-dialog',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div class="v-dialog-stub"><slot /></div>',
}

describe('CoreModal', () => {
  let vuetify: any
  let wrapper: any

  const buildComposable = (visibleFields: Record<string, any>) => ({
    visibleFields: ref(visibleFields),
    selectorOptions: ref({}),
    loadingSelectorOptions: ref({}),
    isTextType: (type: string) => type === 'string' || type === 'email',
    isNumberType: (type: string) => type === 'number' || type === 'integer',
    isSelectorType: (field: any) => field?.type === 'selector',
    getInputType: (type: string) => (type === 'email' ? 'email' : 'text'),
    getFieldCols: () => 12,
    getFieldMd: () => 6,
    getFieldRules: () => [],
    getChoicesOptions: () => [
      { value: true, text: 'Yes' },
      { value: false, text: 'No' },
    ],
    formatFieldName: (k: string) => k,
    updateDependentFields: (_k: string, _v: any, data: any) => data,
    loadSelectorOptions: vi.fn(),
    prepareFormDataForSubmit: (data: any) => ({ ...data, prepared: true }),
  })

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
    formFieldsMock.instance = buildComposable({})
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    vi.clearAllMocks()
  })

  const createWrapper = (props = {}) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          table: { cancel: 'Cancel', save: 'Save', update: 'Update' },
        },
      },
    })
    return mount(CoreModal, {
      props: {
        modelValue: true,
        title: 'My Modal',
        fields: {},
        formData: {},
        ...props,
      },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-dialog': dialogStub,
          'v-icon': true,
          CoreButton: {
            name: 'CoreButton',
            props: ['text', 'loading'],
            template:
              '<button class="core-button-stub" @click="$emit(\'click\')">{{ text }}</button>',
          },
        },
      },
    })
  }

  test('renders title', () => {
    wrapper = createWrapper({ title: 'Add Item' })
    expect(wrapper.text()).toContain('Add Item')
  })

  test('isModalOpen true only when modelValue === true', () => {
    wrapper = createWrapper({ modelValue: true })
    expect((wrapper.vm as any).isModalOpen).toBe(true)
  })

  test('submitButtonText is Save in add mode and Update in edit mode', async () => {
    wrapper = createWrapper({ mode: 'add' })
    expect((wrapper.vm as any).submitButtonText).toBe('Save')
    await wrapper.setProps({ mode: 'edit' })
    expect((wrapper.vm as any).submitButtonText).toBe('Update')
  })

  test('renders string field input', () => {
    formFieldsMock.instance = buildComposable({
      name: { key: 'name', type: 'string', title: 'Name' },
    })
    wrapper = createWrapper({ formData: { name: 'Alice' } })
    expect(wrapper.findComponent({ name: 'VTextField' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('Name')
  })

  test('renders textarea field', () => {
    formFieldsMock.instance = buildComposable({
      bio: { key: 'bio', type: 'textarea', title: 'Bio' },
    })
    wrapper = createWrapper({ formData: { bio: '' } })
    expect(wrapper.findComponent({ name: 'VTextarea' }).exists()).toBe(true)
  })

  test('renders number field', () => {
    formFieldsMock.instance = buildComposable({
      age: { key: 'age', type: 'number', title: 'Age', min: 0, max: 99 },
    })
    wrapper = createWrapper({ formData: { age: 5 } })
    const tf = wrapper.findComponent({ name: 'VTextField' })
    expect(tf.exists()).toBe(true)
  })

  test('renders boolean field as select', () => {
    formFieldsMock.instance = buildComposable({
      active: { key: 'active', type: 'boolean', title: 'Active' },
    })
    wrapper = createWrapper({ formData: { active: true } })
    expect(wrapper.findComponent({ name: 'VSelect' }).exists()).toBe(true)
  })

  test('renders date field', () => {
    formFieldsMock.instance = buildComposable({
      created: { key: 'created', type: 'date', title: 'Created' },
    })
    wrapper = createWrapper({ formData: { created: '2024-01-01T00:00:00' } })
    expect(wrapper.findComponent({ name: 'VTextField' }).exists()).toBe(true)
  })

  test('skips non-renderable fields (missing key/type)', () => {
    formFieldsMock.instance = buildComposable({
      bad: { title: 'No type' },
    })
    wrapper = createWrapper({ formData: {} })
    expect(wrapper.findComponent({ name: 'VTextField' }).exists()).toBe(false)
  })

  test('updateField emits update:formData with new value', () => {
    formFieldsMock.instance = buildComposable({
      name: { key: 'name', type: 'string', title: 'Name' },
    })
    wrapper = createWrapper({ formData: { name: 'A' } })
    ;(wrapper.vm as any).updateField('name', 'B')
    expect(wrapper.emitted('update:formData')![0][0]).toEqual({ name: 'B' })
  })

  test('handleCancel emits cancel and update:modelValue false', async () => {
    wrapper = createWrapper()
    const btns = wrapper.findAll('.core-button-stub')
    await btns[0].trigger('click') // Cancel
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([false])
  })

  test('handleSubmit emits prepared formData and submit', async () => {
    wrapper = createWrapper({ formData: { name: 'A' } })
    await (wrapper.vm as any).handleSubmit()
    const submit = wrapper.emitted('submit')
    expect(submit).toBeTruthy()
    expect(submit![0][0]).toMatchObject({ prepared: true })
  })

  test('handleSubmit aborts when form validation fails', async () => {
    wrapper = createWrapper({ formData: { name: 'A' } })
    ;(wrapper.vm as any).formRef = {
      validate: vi.fn().mockResolvedValue({ valid: false }),
    }
    await (wrapper.vm as any).handleSubmit()
    expect(wrapper.emitted('submit')).toBeFalsy()
  })

  test('normalizeDateTimeOrTimeForInput handles empty, time and datetime', () => {
    wrapper = createWrapper()
    const fn = (wrapper.vm as any).normalizeDateTimeOrTimeForInput
    expect(fn('', 'datetime')).toBe('')
    expect(fn(null, 'time')).toBe('')
    expect(fn('14:30', 'time')).toBe('14:30')
    const out = fn('2024-01-02T10:00:00', 'datetime')
    expect(out).toMatch(/^2024-01-02T\d{2}:\d{2}$/)
  })

  test('updateDateTimeOrTimeField passes empty as undefined', () => {
    formFieldsMock.instance = buildComposable({
      created: { key: 'created', type: 'datetime', title: 'C' },
    })
    wrapper = createWrapper({ formData: { created: '' } })
    ;(wrapper.vm as any).updateDateTimeOrTimeField('created', '', 'datetime')
    expect(wrapper.emitted('update:formData')![0][0]).toEqual({
      created: undefined,
    })
  })

  test('updateDateTimeOrTimeField passes time value through', () => {
    formFieldsMock.instance = buildComposable({
      t: { key: 't', type: 'time', title: 'T' },
    })
    wrapper = createWrapper({ formData: { t: '' } })
    ;(wrapper.vm as any).updateDateTimeOrTimeField('t', '09:30', 'time')
    expect(wrapper.emitted('update:formData')![0][0]).toEqual({ t: '09:30' })
  })

  test('opening modal loads selector options for selector fields', async () => {
    const composable = buildComposable({})
    formFieldsMock.instance = composable
    wrapper = createWrapper({
      modelValue: false,
      fields: { fk: { key: 'fk', type: 'selector' } },
    })
    await wrapper.setProps({ modelValue: true })
    await wrapper.vm.$nextTick()
    expect(composable.loadSelectorOptions).toHaveBeenCalled()
  })
})
