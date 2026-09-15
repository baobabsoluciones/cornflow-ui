import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import RoleFormDialog from '@cornflow-ui/core/components/roles-management/RoleFormDialog.vue'

vi.mock('@cornflow-ui/core/components/core/CoreButton.vue', () => ({
  default: {
    name: 'CoreButton',
    template:
      '<button class="core-button" :data-text="text" :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button>',
    props: ['text', 'icon', 'variant', 'color', 'size', 'disabled'],
    emits: ['click'],
  },
}))

describe('RoleFormDialog', () => {
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
    mount(RoleFormDialog, {
      props: { modelValue: true, role: null, saving: false, ...props },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-dialog': {
            template: '<div class="v-dialog"><slot /></div>',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          'v-card': { template: '<div><slot /></div>' },
          'v-card-title': { template: '<div><slot /></div>' },
          'v-card-text': { template: '<div><slot /></div>' },
          'v-card-actions': { template: '<div><slot /></div>' },
          'v-icon': { template: '<i><slot /></i>' },
          'v-text-field': {
            template:
              '<input class="v-text-field" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keyup.enter="$emit(\'keyup\', $event)" />',
            props: ['modelValue', 'label', 'rules'],
            emits: ['update:modelValue', 'keyup'],
          },
        },
      },
    })

  describe('create vs edit mode', () => {
    test('opens in create mode with an empty form', async () => {
      wrapper = createWrapper({ role: null })
      await nextTick()
      expect(wrapper.vm.isEdit).toBe(false)
      expect(wrapper.vm.form.name).toBe('')
      expect(wrapper.text()).toContain('rolesManagement.addRole')
    })

    test('opens in edit mode pre-filled with the role values', async () => {
      wrapper = createWrapper({ role: { id: 7, name: 'admin' } })
      await nextTick()
      expect(wrapper.vm.isEdit).toBe(true)
      expect(wrapper.vm.form).toEqual({ id: 7, name: 'admin' })
      expect(wrapper.text()).toContain('rolesManagement.editRole')
    })

    test('re-seeds the form each time the dialog reopens', async () => {
      wrapper = createWrapper({ modelValue: false, role: null })
      await wrapper.setProps({ modelValue: true, role: { id: 3, name: 'planner' } })
      await nextTick()
      expect(wrapper.vm.isEdit).toBe(true)
      expect(wrapper.vm.form.name).toBe('planner')
    })

    test('does nothing when modelValue toggles to closed', async () => {
      wrapper = createWrapper({ modelValue: true, role: { id: 1, name: 'admin' } })
      await nextTick()
      await wrapper.setProps({ modelValue: false })
      await nextTick()
      // form remains as last seeded (watcher returns early when not open)
      expect(wrapper.vm.form.name).toBe('admin')
    })
  })

  describe('save behaviour', () => {
    test('emits save with trimmed name', async () => {
      wrapper = createWrapper({ role: null })
      wrapper.vm.form.name = '  newRole  '
      wrapper.vm.onSave()
      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')![0][0]).toEqual({ name: 'newRole' })
    })

    test('does not emit save when name is blank', () => {
      wrapper = createWrapper({ role: null })
      wrapper.vm.form.name = '   '
      wrapper.vm.onSave()
      expect(wrapper.emitted('save')).toBeFalsy()
    })

    test('save button is disabled when name is empty', async () => {
      wrapper = createWrapper({ role: null })
      await nextTick()
      const saveBtn = wrapper.findAll('.core-button').find((b) => b.attributes('data-text') === 'rolesManagement.save')
      expect(saveBtn!.attributes('disabled')).toBeDefined()
    })

    test('save button is disabled while saving', async () => {
      wrapper = createWrapper({ role: { id: 1, name: 'admin' }, saving: true })
      await nextTick()
      const saveBtn = wrapper.findAll('.core-button').find((b) => b.attributes('data-text') === 'rolesManagement.save')
      expect(saveBtn!.attributes('disabled')).toBeDefined()
    })

    test('enter key on text field triggers onSave', async () => {
      wrapper = createWrapper({ role: { id: 1, name: 'admin' } })
      await nextTick()
      await wrapper.find('.v-text-field').trigger('keyup.enter')
      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')![0][0]).toEqual({ id: 1, name: 'admin' })
    })
  })

  describe('close behaviour', () => {
    test('cancel button emits update:modelValue false', async () => {
      wrapper = createWrapper()
      await nextTick()
      const cancelBtn = wrapper.findAll('.core-button').find((b) => b.attributes('data-text') === 'rolesManagement.cancel')
      await cancelBtn!.trigger('click')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })
  })
})
