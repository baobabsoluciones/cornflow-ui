import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import MetadataTableSwitch from '@/components/project-execution/MetadataTableSwitch.vue'

const VSwitchStub = {
  name: 'VSwitch',
  template:
    '<div class="v-switch-stub" @click="$emit(\'update:modelValue\', !modelValue)"></div>',
  props: ['modelValue'],
  emits: ['update:modelValue'],
}
const VBtnToggleStub = {
  name: 'VBtnToggle',
  template: '<div class="v-btn-toggle-stub"><slot /></div>',
  props: ['modelValue'],
  emits: ['update:modelValue'],
}

describe('MetadataTableSwitch', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

  const createWrapper = (props = {}) =>
    mount(MetadataTableSwitch, {
      props: {
        variant: 'from_db',
        modelValue: false,
        tableName: 'orders',
        ...props,
      },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-switch': VSwitchStub,
          'v-btn-toggle': VBtnToggleStub,
          'v-btn': { template: '<button><slot /></button>' },
          'v-icon': { template: '<i><slot /></i>' },
        },
      },
    })

  describe('rendering and variant class', () => {
    test('renders with variant modifier class', () => {
      wrapper = createWrapper({ variant: 'from_db' })
      expect(wrapper.find('.metadata-switch').exists()).toBe(true)
      expect(wrapper.find('.metadata-switch--from_db').exists()).toBe(true)
    })

    test('renders the label span', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.metadata-switch__label').exists()).toBe(true)
    })

    test('renders a v-switch for non-reuploaded variants', () => {
      wrapper = createWrapper({ variant: 'from_db' })
      expect(wrapper.findComponent(VSwitchStub).exists()).toBe(true)
      expect(wrapper.findComponent(VBtnToggleStub).exists()).toBe(false)
    })

    test('renders a tri-state v-btn-toggle for reuploaded variant', () => {
      wrapper = createWrapper({ variant: 'reuploaded', modelValue: null })
      expect(wrapper.findComponent(VBtnToggleStub).exists()).toBe(true)
      expect(wrapper.findComponent(VSwitchStub).exists()).toBe(false)
    })
  })

  describe('icon computed', () => {
    const cases: Array<[string, string]> = [
      ['from_db', 'mdi-database'],
      ['from_excel', 'mdi-file-excel'],
      ['edited_from_db', 'mdi-database-edit'],
      ['reuploaded', 'mdi-file-replace'],
      ['something_else', 'mdi-table'],
    ]
    test.each(cases)('variant %s -> icon %s', (variant, icon) => {
      wrapper = createWrapper({
        variant,
        modelValue: variant === 'reuploaded' ? null : false,
      })
      expect(wrapper.vm.icon).toBe(icon)
    })
  })

  describe('label computed', () => {
    test.each([
      ['from_db', 'externalEtl.switch.fromDbLabel'],
      ['from_excel', 'externalEtl.switch.fromExcelLabel'],
      ['edited_from_db', 'externalEtl.switch.editedFromDbLabel'],
      ['reuploaded', 'externalEtl.switch.reuploadedLabel'],
    ])('variant %s -> label key %s', (variant, key) => {
      wrapper = createWrapper({
        variant,
        modelValue: variant === 'reuploaded' ? null : false,
      })
      expect(wrapper.vm.label).toBe(key)
    })

    test('unknown variant returns empty label', () => {
      wrapper = createWrapper({ variant: 'unknown', modelValue: false })
      expect(wrapper.vm.label).toBe('')
    })
  })

  describe('emit behaviour', () => {
    test('triStateValue mirrors modelValue', () => {
      wrapper = createWrapper({ variant: 'reuploaded', modelValue: true })
      expect(wrapper.vm.triStateValue).toBe(true)
    })

    test('handleTriState emits update:modelValue', () => {
      wrapper = createWrapper({ variant: 'reuploaded', modelValue: null })
      wrapper.vm.handleTriState(false)
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    test('v-switch update emits update:modelValue', async () => {
      wrapper = createWrapper({ variant: 'from_db', modelValue: false })
      wrapper.findComponent({ name: 'VSwitch' }).vm.$emit('update:modelValue', true)
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([true])
    })
  })
})
