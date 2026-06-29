import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import UserRolesDialog from '@cornflow-ui/core/components/roles-management/UserRolesDialog.vue'

vi.mock('@cornflow-ui/core/components/core/CoreButton.vue', () => ({
  default: {
    name: 'CoreButton',
    template:
      '<button class="core-button" :data-text="text" :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button>',
    props: ['text', 'icon', 'variant', 'color', 'size', 'disabled'],
    emits: ['click'],
  },
}))

const user = (overrides: any = {}) => ({
  id: 1,
  username: 'jdoe',
  full_name: 'John Doe',
  email: 'john@example.com',
  role_names: ['admin'],
  _role_ids: [1],
  ...overrides,
})

describe('UserRolesDialog', () => {
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
    mount(UserRolesDialog, {
      props: {
        modelValue: true,
        user: user(),
        roles: [
          { id: 1, name: 'admin' },
          { id: 2, name: 'viewer' },
        ],
        saving: false,
        ...props,
      },
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
          'v-select': {
            template: '<div class="v-select" :data-items="JSON.stringify(items)"></div>',
            props: ['modelValue', 'items', 'label', 'placeholder'],
            emits: ['update:modelValue'],
          },
        },
      },
    })

  describe('rendering', () => {
    test('renders the user info pill with username and email', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.user-info-pill').text()).toContain('jdoe')
      expect(wrapper.find('.user-info-pill').text()).toContain('john@example.com')
    })

    test('omits the email span when user has no email', () => {
      wrapper = createWrapper({ user: user({ email: '' }) })
      expect(wrapper.find('.user-info-pill').text()).toContain('jdoe')
      expect(wrapper.find('.user-info-pill').text()).not.toContain('@example.com')
    })

    test('handles a null user gracefully', () => {
      wrapper = createWrapper({ user: null })
      expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })
  })

  describe('roleItems computed', () => {
    test('maps roles to value/text pairs', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.roleItems).toEqual([
        { value: 'admin', text: 'admin' },
        { value: 'viewer', text: 'viewer' },
      ])
    })
  })

  describe('selectedNames seeding', () => {
    test('seeds selectedNames from the user role names on open', async () => {
      wrapper = createWrapper({ user: user({ role_names: ['admin', 'viewer'] }) })
      await nextTick()
      expect(wrapper.vm.selectedNames).toEqual(['admin', 'viewer'])
    })

    test('re-seeds when reopened for a different user', async () => {
      wrapper = createWrapper({ modelValue: false, user: user({ id: 1, role_names: ['admin'] }) })
      await wrapper.setProps({
        modelValue: true,
        user: user({ id: 2, role_names: ['viewer'] }),
      })
      await nextTick()
      expect(wrapper.vm.selectedNames).toEqual(['viewer'])
    })
  })

  describe('save behaviour', () => {
    test('emits save with the user and selected role names', async () => {
      wrapper = createWrapper()
      await nextTick()
      wrapper.vm.selectedNames = ['admin', 'viewer']
      wrapper.vm.onSave()
      expect(wrapper.emitted('save')).toBeTruthy()
      const payload = wrapper.emitted('save')![0][0] as any
      expect(payload.user.id).toBe(1)
      expect(payload.roleNames).toEqual(['admin', 'viewer'])
    })

    test('does not emit save when user is null', () => {
      wrapper = createWrapper({ user: null })
      wrapper.vm.onSave()
      expect(wrapper.emitted('save')).toBeFalsy()
    })

    test('save button disabled while saving', async () => {
      wrapper = createWrapper({ saving: true })
      await nextTick()
      const saveBtn = wrapper.findAll('.core-button').find((b) => b.attributes('data-text') === 'rolesManagement.save')
      expect(saveBtn!.attributes('disabled')).toBeDefined()
    })

    test('clicking save button emits save', async () => {
      wrapper = createWrapper()
      await nextTick()
      const saveBtn = wrapper.findAll('.core-button').find((b) => b.attributes('data-text') === 'rolesManagement.save')
      await saveBtn!.trigger('click')
      expect(wrapper.emitted('save')).toBeTruthy()
    })
  })

  describe('close behaviour', () => {
    test('cancel button emits update:modelValue false', async () => {
      wrapper = createWrapper()
      await nextTick()
      const cancelBtn = wrapper.findAll('.core-button').find((b) => b.attributes('data-text') === 'rolesManagement.cancel')
      await cancelBtn!.trigger('click')
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })
  })
})
