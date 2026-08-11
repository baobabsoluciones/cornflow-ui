import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import RolesPanel from '@cornflow-ui/core/components/roles-management/RolesPanel.vue'

const role = (id: number, name: string) => ({ id, name })

describe('RolesPanel', () => {
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
    mount(RolesPanel, {
      props: {
        roles: [role(1, 'admin'), role(2, 'viewer')],
        selectedRoleId: null,
        selectedRole: null,
        usersCountByRole: { 1: 3, 2: 5 },
        totalUsers: 8,
        loading: false,
        allowEdit: false,
        ...props,
      },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-card': { template: '<div><slot /></div>' },
          'v-icon': { template: '<i><slot /></i>' },
          'v-chip': { template: '<span class="v-chip"><slot /></span>' },
          'v-btn': {
            template: '<button class="v-btn" @click="$emit(\'click\', $event)"><slot /></button>',
            emits: ['click'],
          },
        },
      },
    })

  describe('rendering', () => {
    test('renders the all-users button plus one button per role', () => {
      wrapper = createWrapper()
      // 1 "all users" + 2 roles
      expect(wrapper.findAll('.role-item')).toHaveLength(3)
      expect(wrapper.find('.role-item--all').exists()).toBe(true)
    })

    test('renders role names and per-role user counts', () => {
      wrapper = createWrapper()
      expect(wrapper.text()).toContain('admin')
      expect(wrapper.text()).toContain('viewer')
      // counts present
      expect(wrapper.text()).toContain('3')
      expect(wrapper.text()).toContain('5')
    })

    test('renders count 0 fallback for a role missing in usersCountByRole', () => {
      wrapper = createWrapper({ usersCountByRole: {} })
      expect(wrapper.text()).toContain('0')
    })

    test('marks the all-users item active when selectedRoleId is null', () => {
      wrapper = createWrapper({ selectedRoleId: null })
      expect(wrapper.find('.role-item--all').classes()).toContain('role-item--active')
    })

    test('marks the matching role item active', () => {
      wrapper = createWrapper({ selectedRoleId: 1 })
      const items = wrapper.findAll('.role-item')
      // index 0 is all-users, index 1 is first role (admin)
      expect(items[1].classes()).toContain('role-item--active')
    })
  })

  describe('empty state', () => {
    test('renders empty state when there are no roles and not loading', () => {
      wrapper = createWrapper({ roles: [], loading: false })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('rolesManagement.noRoles')
    })

    test('does not render empty state while loading', () => {
      wrapper = createWrapper({ roles: [], loading: true })
      expect(wrapper.find('.empty-state').exists()).toBe(false)
      expect(wrapper.find('.roles-list').classes()).toContain('is-loading')
    })
  })

  describe('select emits', () => {
    test('emits select with null when all-users is clicked', async () => {
      wrapper = createWrapper()
      await wrapper.find('.role-item--all').trigger('click')
      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual([null])
    })

    test('emits select with role id when a role is clicked', async () => {
      wrapper = createWrapper()
      const roleButtons = wrapper.findAll('.role-item:not(.role-item--all)')
      await roleButtons[0].trigger('click')
      expect(wrapper.emitted('select')![0]).toEqual([1])
    })
  })

  describe('edit controls (allowEdit)', () => {
    test('does not show edit/delete buttons when allowEdit is false', () => {
      wrapper = createWrapper({ allowEdit: false, selectedRoleId: 1 })
      expect(wrapper.find('.roles-add').exists()).toBe(false)
    })

    test('shows the add role button when allowEdit is true', () => {
      wrapper = createWrapper({ allowEdit: true })
      expect(wrapper.find('.roles-add').exists()).toBe(true)
      expect(wrapper.text()).toContain('rolesManagement.addRole')
    })

    test('emits create when add role button is clicked', async () => {
      wrapper = createWrapper({ allowEdit: true })
      await wrapper.find('.roles-add .v-btn').trigger('click')
      expect(wrapper.emitted('create')).toBeTruthy()
    })

    test('shows edit/delete buttons for the active role when allowEdit is true', async () => {
      wrapper = createWrapper({ allowEdit: true, selectedRoleId: 1 })
      // active role row shows two action buttons (edit + delete)
      const activeItem = wrapper.findAll('.role-item')[1]
      const btns = activeItem.findAll('.v-btn')
      expect(btns.length).toBe(2)
      await btns[0].trigger('click')
      expect(wrapper.emitted('edit')).toBeTruthy()
      expect(wrapper.emitted('edit')![0][0]).toMatchObject({ id: 1, name: 'admin' })
      await btns[1].trigger('click')
      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')![0][0]).toMatchObject({ id: 1 })
    })
  })

  describe('permissions panel', () => {
    test('does not render permissions panel when no role selected', () => {
      wrapper = createWrapper({ selectedRole: null })
      expect(wrapper.find('.role-permissions').exists()).toBe(false)
    })

    test('renders permissions panel with empty fallback for an unknown role', () => {
      wrapper = createWrapper({
        selectedRole: role(99, 'unknown-role'),
        selectedRoleId: 99,
      })
      expect(wrapper.find('.role-permissions').exists()).toBe(true)
      // unknown role has no preset permissions -> empty placeholder shown
      expect(wrapper.text()).toContain('rolesManagement.noPermissionsDefined')
      expect(wrapper.vm.selectedRolePermissions).toEqual([])
    })
  })
})
