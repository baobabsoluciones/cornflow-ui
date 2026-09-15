import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import CoreBulkEditModal from '@cornflow-ui/core/components/core/table/CoreBulkEditModal.vue'

const dialogStub = {
  name: 'v-dialog',
  props: ['modelValue'],
  template: '<div class="v-dialog-stub"><slot /></div>',
}

describe('CoreBulkEditModal', () => {
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
      messages: {
        en: {
          table: {
            bulkEdit: 'Bulk Edit',
            bulkEditDescription: '{count} selected',
            bulkEditNoChange: 'No change',
            bulkEditHint: 'Only filled fields apply',
            cancel: 'Cancel',
            applyToSelected: 'Apply to {count}',
            yes: 'Yes',
            no: 'No',
          },
        },
      },
    })
    return mount(CoreBulkEditModal, {
      props: {
        modelValue: true,
        headers: [{ key: 'name', title: 'Name', type: 'string' }],
        selectedCount: 3,
        ...props,
      },
      global: {
        plugins: [vuetify, i18n],
        stubs: { 'v-dialog': dialogStub, 'v-icon': true },
      },
    })
  }

  test('renders title and description with count', () => {
    wrapper = createWrapper()
    expect(wrapper.text()).toContain('Bulk Edit')
    expect(wrapper.text()).toContain('3 selected')
  })

  test('editableHeaders excludes selection, id, readonly, fk and joined columns', () => {
    wrapper = createWrapper({
      headers: [
        { key: 'selection', title: 'Sel' },
        { key: 'id', title: 'Id' },
        { key: 'ro', title: 'RO', frontendReadOnly: true },
        { key: 'fk', title: 'FK', isForeignKey: true },
        { key: 'joined', title: 'Joined', columnsToJoin: ['a'] },
        { key: 'name', title: 'Name', type: 'string' },
        { key: 'active', title: 'Active', type: 'boolean' },
      ],
    })
    const editable = (wrapper.vm as any).editableHeaders
    expect(editable.map((h: any) => h.key)).toEqual(['name', 'active'])
  })

  test('renders boolean select for boolean header and text field otherwise', () => {
    wrapper = createWrapper({
      headers: [
        { key: 'active', title: 'Active', type: 'boolean' },
        { key: 'name', title: 'Name', type: 'string' },
      ],
    })
    expect(wrapper.findComponent({ name: 'VSelect' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VTextField' }).exists()).toBe(true)
  })

  test('renders choices select when header has choices', () => {
    wrapper = createWrapper({
      headers: [{ key: 'status', title: 'Status', choices: ['A', 'B'] }],
    })
    expect(wrapper.findComponent({ name: 'VSelect' }).exists()).toBe(true)
  })

  test('getInputType maps types', () => {
    wrapper = createWrapper()
    const getInputType = (wrapper.vm as any).getInputType
    expect(getInputType('number')).toBe('number')
    expect(getInputType('date')).toBe('date')
    expect(getInputType('datetime')).toBe('datetime-local')
    expect(getInputType('time')).toBe('time')
    expect(getInputType('string')).toBe('text')
    expect(getInputType()).toBe('text')
  })

  test('hasFilled false initially, true after a value set', async () => {
    wrapper = createWrapper()
    expect((wrapper.vm as any).hasFilled).toBe(false)
    ;(wrapper.vm as any).fieldValues.name = 'X'
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).hasFilled).toBe(true)
  })

  test('apply button disabled until a field filled', async () => {
    wrapper = createWrapper()
    const applyBtn = wrapper.find('.core-bulk-edit-modal__apply-btn')
    expect(applyBtn.attributes('disabled')).toBeDefined()
    ;(wrapper.vm as any).fieldValues.name = 'X'
    await wrapper.vm.$nextTick()
    expect(applyBtn.attributes('disabled')).toBeUndefined()
  })

  test('handleApply emits only filled fields', () => {
    wrapper = createWrapper()
    ;(wrapper.vm as any).fieldValues = {
      name: 'New',
      empty: '',
      nul: null,
      und: undefined,
    }
    ;(wrapper.vm as any).handleApply()
    expect(wrapper.emitted('apply')![0][0]).toEqual({ name: 'New' })
  })

  test('cancel button emits cancel', async () => {
    wrapper = createWrapper()
    await wrapper.find('.core-bulk-edit-modal__cancel-btn').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
