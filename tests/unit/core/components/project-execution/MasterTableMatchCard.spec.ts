import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import MasterTableMatchCard from '@cornflow-ui/core/components/project-execution/MasterTableMatchCard.vue'

const passthrough = (name: string) => ({
  name,
  template: '<div><slot /></div>',
})
const VRadioGroupStub = {
  name: 'VRadioGroup',
  template: '<div class="v-radio-group"><slot /></div>',
  props: ['modelValue'],
  emits: ['update:modelValue'],
}
const VRadioStub = {
  name: 'VRadio',
  template: '<div class="v-radio"><slot name="label" /></div>',
  props: ['value', 'disabled', 'color'],
}
const VBtnStub = {
  name: 'VBtn',
  template: '<button class="v-btn" @click="$emit(\'click\', $event)"><slot /></button>',
  emits: ['click'],
}

// Stub the comparison modal (it pulls in heavy table machinery / overlays).
vi.mock('@cornflow-ui/core/components/project-execution/DataComparisonModal.vue', () => ({
  default: {
    name: 'DataComparisonModal',
    template: '<div data-testid="data-comparison-modal" />',
    props: [
      'modelValue',
      'tableName',
      'masterTableTitle',
      'instanceData',
      'masterData',
      'diffSummary',
      'masterTableConfig',
      'fullInstanceData',
      'instanceSchemaColumns',
    ],
    emits: ['update:modelValue'],
  },
}))

const baseMatch = (overrides: any = {}) => ({
  tableKey: 'orders',
  tableName: 'Orders',
  masterTableTitle: 'Master Orders',
  hasDifferences: true,
  userChoice: 'keep_uploaded',
  instanceData: [],
  masterData: [],
  masterTableConfig: {},
  fullInstanceData: [],
  instanceSchemaColumns: [],
  diffSummary: {
    totalInstance: 10,
    totalMaster: 8,
    onlyInInstance: 2,
    onlyInMaster: 1,
    different: 3,
    identical: 4,
  },
  ...overrides,
})

describe('MasterTableMatchCard', () => {
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
    mount(MasterTableMatchCard, {
      props: { match: baseMatch(), ...props },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-card': passthrough('VCard'),
          'v-card-title': passthrough('VCardTitle'),
          'v-card-subtitle': passthrough('VCardSubtitle'),
          'v-card-text': passthrough('VCardText'),
          'v-chip': passthrough('VChip'),
          'v-divider': { name: 'VDivider', template: '<hr />' },
          'v-icon': { name: 'VIcon', template: '<i><slot /></i>' },
          'v-btn': VBtnStub,
          'v-radio-group': VRadioGroupStub,
          'v-radio': VRadioStub,
        },
      },
    })

  describe('rendering', () => {
    test('renders the card with table name', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.master-table-match-card').exists()).toBe(true)
      expect(wrapper.find('.table-name').text()).toBe('Orders')
    })

    test('shows hasDifferences chip when match has differences', () => {
      wrapper = createWrapper({ match: baseMatch({ hasDifferences: true }) })
      expect(wrapper.text()).toContain('masterTableMatch.hasDifferences')
    })

    test('shows identical chip (not hasDifferences) when match has no differences', () => {
      wrapper = createWrapper({ match: baseMatch({ hasDifferences: false }) })
      // The identical chip key is rendered; hasDifferences chip is not.
      expect(wrapper.text()).toContain('masterTableMatch.identical')
      expect(wrapper.text()).not.toContain('masterTableMatch.hasDifferences')
    })

    test('renders the comparison modal child', () => {
      wrapper = createWrapper()
      expect(wrapper.find('[data-testid="data-comparison-modal"]').exists()).toBe(true)
    })
  })

  describe('diff summary branches', () => {
    test('renders all summary rows when all counts are positive', () => {
      wrapper = createWrapper()
      const text = wrapper.text()
      expect(text).toContain('masterTableMatch.newRows')
      expect(text).toContain('masterTableMatch.removedRows')
      expect(text).toContain('masterTableMatch.modifiedRows')
      expect(text).toContain('masterTableMatch.identicalRows')
    })

    test('hides optional summary rows when counts are zero', () => {
      wrapper = createWrapper({
        match: baseMatch({
          diffSummary: {
            totalInstance: 5,
            totalMaster: 5,
            onlyInInstance: 0,
            onlyInMaster: 0,
            different: 0,
            identical: 0,
          },
        }),
      })
      const text = wrapper.text()
      expect(text).not.toContain('masterTableMatch.newRows')
      expect(text).not.toContain('masterTableMatch.removedRows')
      expect(text).not.toContain('masterTableMatch.modifiedRows')
      expect(text).not.toContain('masterTableMatch.identicalRows')
      // totals always present
      expect(text).toContain('masterTableMatch.uploadedRows')
      expect(text).toContain('masterTableMatch.masterRows')
    })
  })

  describe('replace master option', () => {
    test('shows replace option by default (showReplaceMasterOption defaults true)', () => {
      wrapper = createWrapper()
      expect(wrapper.text()).toContain('masterTableMatch.option.replaceMaster.title')
    })

    test('hides replace option when showReplaceMasterOption is false', () => {
      wrapper = createWrapper({ showReplaceMasterOption: false })
      expect(wrapper.text()).not.toContain('masterTableMatch.option.replaceMaster.title')
    })

    test('shows notAvailable hint when canReplaceMaster is false', () => {
      wrapper = createWrapper({
        showReplaceMasterOption: true,
        canReplaceMaster: false,
      })
      expect(wrapper.text()).toContain('masterTableMatch.option.replaceMaster.notAvailable')
    })

    test('does not show notAvailable hint when canReplaceMaster is true', () => {
      wrapper = createWrapper({
        showReplaceMasterOption: true,
        canReplaceMaster: true,
      })
      expect(wrapper.text()).not.toContain('masterTableMatch.option.replaceMaster.notAvailable')
    })
  })

  describe('choice emit', () => {
    test('emits update:choice with tableKey and new value on radio change', () => {
      wrapper = createWrapper()
      const group = wrapper.findComponent({ name: 'VRadioGroup' })
      group.vm.$emit('update:modelValue', 'use_master')
      expect(wrapper.emitted('update:choice')).toBeTruthy()
      expect(wrapper.emitted('update:choice')![0]).toEqual(['orders', 'use_master'])
    })
  })

  describe('view differences button', () => {
    test('opens the diff modal when the view differences button is clicked', async () => {
      wrapper = createWrapper()
      expect(wrapper.vm.showDiffModal).toBe(false)
      // Find the text button in the title (first VBtn)
      const btn = wrapper.findComponent({ name: 'VBtn' })
      await btn.trigger('click')
      expect(wrapper.vm.showDiffModal).toBe(true)
    })
  })
})
