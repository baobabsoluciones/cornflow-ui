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
  first_name: 'John',
  last_name: 'Doe',
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
          'v-text-field': {
            template:
              '<input class="v-text-field" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue', 'label', 'type', 'rules'],
            emits: ['update:modelValue'],
          },
          'v-select': {
            template: '<div class="v-select" :data-items="JSON.stringify(items)"></div>',
            props: ['modelValue', 'items', 'label', 'placeholder'],
            emits: ['update:modelValue'],
          },
        },
      },
    })

  describe('rendering', () => {
    test('renders the user info pill with username', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.user-info-pill').text()).toContain('jdoe')
    })

    test('seeds profile fields from the user', async () => {
      wrapper = createWrapper()
      await nextTick()
      expect(wrapper.vm.firstName).toBe('John')
      expect(wrapper.vm.lastName).toBe('Doe')
      expect(wrapper.vm.email).toBe('john@example.com')
    })

    test('seeds empty email when user has no email', async () => {
      wrapper = createWrapper({ user: user({ email: '' }) })
      await nextTick()
      expect(wrapper.vm.email).toBe('')
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
    test('emits save with the user, profile and selected role names', async () => {
      wrapper = createWrapper()
      await nextTick()
      wrapper.vm.selectedNames = ['admin', 'viewer']
      wrapper.vm.onSave()
      expect(wrapper.emitted('save')).toBeTruthy()
      const payload = wrapper.emitted('save')![0][0] as any
      expect(payload.user.id).toBe(1)
      expect(payload.profile).toEqual({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      })
      expect(payload.roleNames).toEqual(['admin', 'viewer'])
    })

    test('shows the totp field only when a platform role is being added', async () => {
      wrapper = createWrapper({
        canAssignPlatformRoles: true,
        roles: [
          { id: 1, name: 'admin' },
          { id: 901, name: 'platform_viewer' },
        ],
      })
      await nextTick()
      expect(wrapper.vm.addsPlatformRole).toBe(false)
      wrapper.vm.selectedNames = ['admin', 'platform_viewer']
      await nextTick()
      expect(wrapper.vm.addsPlatformRole).toBe(true)
      // roles the user already holds do not re-trigger the step-up
      wrapper = createWrapper({
        canAssignPlatformRoles: true,
        user: user({ role_names: ['platform_viewer'], _role_ids: [901] }),
        roles: [{ id: 901, name: 'platform_viewer' }],
      })
      await nextTick()
      expect(wrapper.vm.addsPlatformRole).toBe(false)
    })

    test('includes the totp code in the save payload when filled', async () => {
      wrapper = createWrapper({
        canAssignPlatformRoles: true,
        roles: [
          { id: 1, name: 'admin' },
          { id: 901, name: 'platform_viewer' },
        ],
      })
      await nextTick()
      wrapper.vm.selectedNames = ['admin', 'platform_viewer']
      wrapper.vm.totpCode = ' 654321 '
      wrapper.vm.onSave()
      const payload = wrapper.emitted('save')![0][0] as any
      expect(payload.totpCode).toBe('654321')
    })

    test('blocks the save until the step-up code is valid', async () => {
      // The save used to go out with totpCode undefined: the server refused
      // the grant and the only feedback was a generic error, after the
      // revocations in the same save had already been applied
      wrapper = createWrapper({
        canAssignPlatformRoles: true,
        roles: [
          { id: 1, name: 'admin' },
          { id: 901, name: 'platform_viewer' },
        ],
      })
      await nextTick()
      wrapper.vm.selectedNames = ['admin', 'platform_viewer']
      await nextTick()

      expect(wrapper.vm.isTotpValid).toBe(false)
      wrapper.vm.onSave()
      expect(wrapper.emitted('save')).toBeFalsy()

      const saveBtn = wrapper
        .findAll('.core-button')
        .find((b: any) => b.attributes('data-text') === 'rolesManagement.save')
      expect(saveBtn!.attributes('disabled')).toBeDefined()

      // too short for either a TOTP or a backup code
      wrapper.vm.totpCode = '123'
      await nextTick()
      expect(wrapper.vm.isTotpValid).toBe(false)

      wrapper.vm.totpCode = '654321'
      await nextTick()
      expect(wrapper.vm.isTotpValid).toBe(true)
      wrapper.vm.onSave()
      expect(wrapper.emitted('save')).toBeTruthy()
    })

    test('the step-up rule tells an empty code from a malformed one', async () => {
      wrapper = createWrapper({
        canAssignPlatformRoles: true,
        roles: [{ id: 901, name: 'platform_viewer' }],
      })
      await nextTick()
      wrapper.vm.selectedNames = ['platform_viewer']
      await nextTick()

      const [rule] = wrapper.vm.totpRules
      expect(rule('')).toBe('rolesManagement.totpRequired')
      expect(rule('12')).toBe('rolesManagement.totpInvalid')
      expect(rule('654321')).toBe(true)
      expect(rule('A1B2C3D4')).toBe(true) // backup code
    })

    test('no code is demanded when no platform role is being added', async () => {
      wrapper = createWrapper()
      await nextTick()
      const [rule] = wrapper.vm.totpRules
      expect(rule('')).toBe(true)
      expect(wrapper.vm.isTotpValid).toBe(true)
    })

    test('omits the totp code from the payload when empty', async () => {
      wrapper = createWrapper()
      await nextTick()
      wrapper.vm.onSave()
      const payload = wrapper.emitted('save')![0][0] as any
      expect(payload.totpCode).toBeUndefined()
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

  describe('platform roles visibility', () => {
    const allRoles = [
      { id: 1, name: 'admin' },
      { id: 2, name: 'viewer' },
      { id: 5, name: 'platform_admin' },
      { id: 6, name: 'platform_viewer' },
      { id: 7, name: 'platform_planner' },
    ]

    test('platform roles are hidden by default (client admin)', async () => {
      wrapper = createWrapper({ roles: allRoles })
      await nextTick()
      const items = JSON.parse(
        wrapper.find('.v-select').attributes('data-items')!,
      )
      const names = items.map((i: any) => i.value)
      expect(names).toEqual(['admin', 'viewer'])
    })

    test('platform roles are offered to platform administrators', async () => {
      wrapper = createWrapper({
        roles: allRoles,
        canAssignPlatformRoles: true,
      })
      await nextTick()
      const items = JSON.parse(
        wrapper.find('.v-select').attributes('data-items')!,
      )
      const names = items.map((i: any) => i.value)
      expect(names).toContain('platform_admin')
      expect(names).toContain('platform_viewer')
      expect(names).toContain('platform_planner')
    })

    test('a non-platform admin cannot revoke the platform roles a user holds', async () => {
      // Hiding them from the options is not enough: the chips are closable, so
      // the selection can drop a platform_* role the user already has. Saving
      // that would be sent as a revocation.
      wrapper = createWrapper({
        roles: allRoles,
        user: user({ role_names: ['admin', 'platform_admin'], _role_ids: [1, 5] }),
      })
      await nextTick()

      // Simulate closing the platform_admin chip
      wrapper.vm.selectedNames = ['admin']
      wrapper.vm.onSave()

      const saved = wrapper.emitted('save')![0][0] as { roleNames: string[] }
      expect(saved.roleNames).toContain('platform_admin')
      expect(saved.roleNames).toContain('admin')
    })

    test('a platform admin can revoke platform roles', async () => {
      wrapper = createWrapper({
        roles: allRoles,
        canAssignPlatformRoles: true,
        user: user({ role_names: ['admin', 'platform_admin'], _role_ids: [1, 5] }),
      })
      await nextTick()

      wrapper.vm.selectedNames = ['admin']
      wrapper.vm.onSave()

      const saved = wrapper.emitted('save')![0][0] as { roleNames: string[] }
      expect(saved.roleNames).toEqual(['admin'])
    })
  })
})
