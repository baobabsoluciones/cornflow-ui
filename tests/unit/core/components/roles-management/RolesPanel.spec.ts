import { describe, test, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RolesPanel from '@cornflow-ui/core/components/roles-management/RolesPanel.vue'

const role = (id: number, name: string) => ({ id, name })

describe('RolesPanel', () => {
  let wrapper: any

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: {} },
  })

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
      global: { plugins: [i18n] },
    })

  const roleItems = () => wrapper.findAll('.role-item')
  const counts = () => wrapper.findAll('.role-item__count').map((b: any) => b.text())

  describe('rendering', () => {
    test('renders the all-users row plus one row per role', () => {
      wrapper = createWrapper()
      expect(roleItems()).toHaveLength(3)
      expect(wrapper.find('.role-item--all').exists()).toBe(true)
    })

    test('counts the roles in the header', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.panel-header').text()).toContain('2')
    })

    test('renders role names, the total and per-role user counts', () => {
      wrapper = createWrapper()
      expect(wrapper.text()).toContain('admin')
      expect(wrapper.text()).toContain('viewer')
      expect(counts()).toEqual(['8', '3', '5'])
    })

    test('counts 0 for a role missing in usersCountByRole', () => {
      wrapper = createWrapper({ usersCountByRole: {} })
      expect(counts()).toEqual(['8', '0', '0'])
    })

    test('gives each role the icon and tone of its preset', () => {
      wrapper = createWrapper()
      const adminIcon = roleItems()[1].find('.role-item__icon')
      expect(adminIcon.classes()).toContain('is-primary')
      expect(adminIcon.find('.mdi-shield-crown-outline').exists()).toBe(true)
      expect(roleItems()[2].find('.role-item__icon').classes()).toContain('is-success')
    })

    test('a role without a preset takes the fallback icon and the primary tone', () => {
      wrapper = createWrapper({ roles: [role(9, 'auditor')] })
      const icon = roleItems()[1].find('.role-item__icon')
      expect(icon.classes()).toContain('is-primary')
      expect(icon.find('.mdi-shield-account-outline').exists()).toBe(true)
    })

    test('marks the all-users row active when selectedRoleId is null', () => {
      wrapper = createWrapper({ selectedRoleId: null })
      expect(wrapper.find('.role-item--all').classes()).toContain('role-item--active')
      expect(wrapper.find('.role-item--all .role-item__main').attributes('aria-pressed')).toBe('true')
    })

    test('marks the matching role row active', () => {
      wrapper = createWrapper({ selectedRoleId: 1 })
      expect(roleItems()[1].classes()).toContain('role-item--active')
      expect(roleItems()[1].find('.role-item__main').attributes('aria-pressed')).toBe('true')
      expect(wrapper.find('.role-item--all').classes()).not.toContain('role-item--active')
    })
  })

  describe('empty and loading states', () => {
    test('renders the empty state when there are no roles and not loading', () => {
      wrapper = createWrapper({ roles: [], loading: false })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('rolesManagement.noRoles')
    })

    test('shows placeholder rows instead of the empty state while the roles load', () => {
      wrapper = createWrapper({ roles: [], loading: true })
      expect(wrapper.find('.empty-state').exists()).toBe(false)
      expect(wrapper.findAll('.role-skeleton')).toHaveLength(3)
      expect(wrapper.find('.roles-list').classes()).toContain('is-loading')
      expect(wrapper.find('.roles-list').attributes('aria-busy')).toBe('true')
    })

    test('keeps the roles on screen while they reload', () => {
      wrapper = createWrapper({ loading: true })
      expect(roleItems()).toHaveLength(3)
      expect(wrapper.find('.role-skeleton').exists()).toBe(false)
    })
  })

  describe('select emits', () => {
    test('emits select with null when all-users is clicked', async () => {
      wrapper = createWrapper()
      await wrapper.find('.role-item--all .role-item__main').trigger('click')
      expect(wrapper.emitted('select')![0]).toEqual([null])
    })

    test('emits select with role id when a role is clicked', async () => {
      wrapper = createWrapper()
      await roleItems()[1].find('.role-item__main').trigger('click')
      expect(wrapper.emitted('select')![0]).toEqual([1])
    })
  })

  describe('edit controls (allowEdit)', () => {
    test('offers no edit, delete or add when allowEdit is false', () => {
      wrapper = createWrapper({ allowEdit: false, selectedRoleId: 1 })
      expect(wrapper.find('.role-item__actions').exists()).toBe(false)
      expect(wrapper.find('.roles-add').exists()).toBe(false)
    })

    test('shows the add role button when allowEdit is true', () => {
      wrapper = createWrapper({ allowEdit: true })
      expect(wrapper.find('.roles-add').exists()).toBe(true)
      expect(wrapper.find('.roles-add').text()).toContain('rolesManagement.addRole')
    })

    test('emits create when the add role button is clicked', async () => {
      wrapper = createWrapper({ allowEdit: true })
      await wrapper.find('.roles-add button').trigger('click')
      expect(wrapper.emitted('create')).toBeTruthy()
    })

    test('the selected role offers edit and delete in place of its count', async () => {
      wrapper = createWrapper({ allowEdit: true, selectedRoleId: 1 })
      const active = roleItems()[1]
      expect(active.find('.role-item__count').exists()).toBe(false)
      const buttons = active.findAll('.role-item__actions button')
      expect(buttons.map((b: any) => b.attributes('aria-label'))).toEqual([
        'rolesManagement.editRole',
        'rolesManagement.delete',
      ])

      await buttons[0].trigger('click')
      expect(wrapper.emitted('edit')![0][0]).toMatchObject({ id: 1, name: 'admin' })
      await buttons[1].trigger('click')
      expect(wrapper.emitted('delete')![0][0]).toMatchObject({ id: 1 })
      expect(wrapper.emitted('select')).toBeFalsy()
    })

    test('only the selected role offers edit and delete', () => {
      wrapper = createWrapper({ allowEdit: true, selectedRoleId: 1 })
      expect(wrapper.findAll('.role-item__actions')).toHaveLength(1)
      expect(roleItems()[2].find('.role-item__count').text()).toBe('5')
    })
  })

  describe('permissions panel', () => {
    test('does not render the permissions panel when no role is selected', () => {
      wrapper = createWrapper({ selectedRole: null })
      expect(wrapper.find('.role-permissions').exists()).toBe(false)
    })

    test('renders the permissions panel with the empty fallback for an unknown role', () => {
      wrapper = createWrapper({
        selectedRole: role(99, 'unknown-role'),
        selectedRoleId: 99,
      })
      expect(wrapper.find('.role-permissions').exists()).toBe(true)
      expect(wrapper.text()).toContain('rolesManagement.noPermissionsDefined')
      expect(wrapper.vm.selectedRolePermissions).toEqual([])
    })

    test('lists the permissions of the selected role', () => {
      const withPermissions = createI18n({
        legacy: false,
        locale: 'en',
        missingWarn: false,
        fallbackWarn: false,
        messages: {
          en: {
            rolesManagement: {
              roleMeta: {
                planner: { permissions: ['Read instances', 'Create executions'] },
              },
            },
          },
        },
      })
      wrapper = mount(RolesPanel, {
        props: {
          roles: [role(3, 'Planner')],
          selectedRoleId: 3,
          selectedRole: role(3, 'Planner'),
          usersCountByRole: {},
          totalUsers: 0,
        },
        global: { plugins: [withPermissions] },
      })
      const items = wrapper.findAll('.role-permissions__item').map((li: any) => li.text())
      expect(items).toEqual(['Read instances', 'Create executions'])
    })
  })
})
