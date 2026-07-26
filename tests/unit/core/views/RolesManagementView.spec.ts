import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'

// ── Hoisted controllable composable + appConfig ─────────────────────────────
const { rm, coreParams, platformAdmin } = vi.hoisted(() => ({
  platformAdmin: { value: false },
  rm: {
    roles: { value: [] as any[] },
    loadingRoles: { value: false },
    selectedRoleId: { value: null as number | null },
    selectedRole: { value: null as any },
    users: { value: [] as any[] },
    loadingUsers: { value: false },
    usersCountByRole: { value: {} as Record<number, number> },
    selectRole: vi.fn(),
    fetchRoles: vi.fn().mockResolvedValue(undefined),
    fetchUsers: vi.fn().mockResolvedValue(undefined),
    createRole: vi.fn().mockResolvedValue(true),
    updateRole: vi.fn().mockResolvedValue(true),
    deleteRole: vi.fn().mockResolvedValue(true),
    updateUserProfile: vi.fn().mockResolvedValue(true),
    saveUserRoleAssignments: vi.fn().mockResolvedValue(true),
    unlockUser: vi.fn().mockResolvedValue(true),
    resetUserMfa: vi.fn().mockResolvedValue(true),
  },
  coreParams: { value: { parameters: { allowEditRoles: true } } },
}))

vi.mock('@cornflow-ui/core/composables/roles-management/useRolesManagement', () => ({
  useRolesManagement: () => rm,
}))

vi.mock('@/app/config', () => ({
  default: { getCore: () => coreParams.value },
}))

vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => ({
    isPlatformAdmin: () => platformAdmin.value,
  }),
}))

// Stub heavy children. The factory must be self-contained (hoisted above any
// module-level helper), so the stub builder is defined inside vi.hoisted.
const { stubChild } = vi.hoisted(() => ({
  stubChild: (name: string, emits: string[] = []) => ({
    name,
    template: `<div data-testid="${name}" />`,
    props: [
      'roles',
      'selectedRoleId',
      'selectedRole',
      'usersCountByRole',
      'totalUsers',
      'loading',
      'allowEdit',
      'users',
      'search',
      'role',
      'saving',
      'deleting',
      'user',
      'modelValue',
      'icon',
      'title',
      'description',
      'canUnlock',
      'mfaEnabled',
    ],
    emits,
  }),
}))

vi.mock('@cornflow-ui/core/components/core/CoreTitleView.vue', () => ({ default: stubChild('CoreTitleView') }))
vi.mock('@cornflow-ui/core/components/roles-management/RolesPanel.vue', () => ({
  default: stubChild('RolesPanel', ['select', 'create', 'edit', 'delete']),
}))
vi.mock('@cornflow-ui/core/components/roles-management/UsersPanel.vue', () => ({
  default: stubChild('UsersPanel', [
    'update:search',
    'clear-filter',
    'edit',
    'unlock',
    'reset-mfa',
  ]),
}))
vi.mock('@cornflow-ui/core/components/roles-management/RoleFormDialog.vue', () => ({
  default: stubChild('RoleFormDialog', ['save', 'update:modelValue']),
}))
vi.mock('@cornflow-ui/core/components/roles-management/RoleDeleteDialog.vue', () => ({
  default: stubChild('RoleDeleteDialog', ['confirm', 'update:modelValue']),
}))
vi.mock('@cornflow-ui/core/components/roles-management/UserRolesDialog.vue', () => ({
  default: stubChild('UserRolesDialog', ['save', 'update:modelValue']),
}))

import RolesManagementView from '@cornflow-ui/core/views/RolesManagementView.vue'

describe('RolesManagementView', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
    vi.clearAllMocks()
    platformAdmin.value = false
    coreParams.value = { parameters: { allowEditRoles: true } }
    rm.roles.value = [
      { id: 1, name: 'admin' },
      { id: 2, name: 'viewer' },
    ]
    rm.users.value = [{ id: 1, username: 'jdoe', role_names: ['admin'] }]
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

  const createWrapper = () =>
    mount(RolesManagementView, {
      global: { plugins: [vuetify, i18n] },
    })

  describe('mount + lifecycle', () => {
    test('fetches roles and users on mount', async () => {
      wrapper = createWrapper()
      await flushPromises()
      expect(rm.fetchRoles).toHaveBeenCalled()
      expect(rm.fetchUsers).toHaveBeenCalled()
    })

    test('renders both panels', () => {
      wrapper = createWrapper()
      expect(wrapper.find('[data-testid="RolesPanel"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="UsersPanel"]').exists()).toBe(true)
    })

    test('renders role edit dialogs when allowEditRoles is true', () => {
      wrapper = createWrapper()
      expect(wrapper.find('[data-testid="RoleFormDialog"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="RoleDeleteDialog"]').exists()).toBe(true)
    })

    test('hides role edit dialogs when allowEditRoles is false', async () => {
      coreParams.value = { parameters: { allowEditRoles: false } }
      wrapper = createWrapper()
      await nextTick()
      expect(wrapper.find('[data-testid="RoleFormDialog"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="RoleDeleteDialog"]').exists()).toBe(false)
      // user dialog is always rendered
      expect(wrapper.find('[data-testid="UserRolesDialog"]').exists()).toBe(true)
    })
  })

  describe('role create / edit flow', () => {
    test('openRoleCreate clears editing role and opens the dialog', async () => {
      wrapper = createWrapper()
      wrapper.vm.openRoleCreate()
      await nextTick()
      expect(wrapper.vm.roleBeingEdited).toBeNull()
      expect(wrapper.vm.roleDialog).toBe(true)
    })

    test('openRoleEdit sets editing role and opens the dialog', async () => {
      wrapper = createWrapper()
      wrapper.vm.openRoleEdit({ id: 2, name: 'viewer' })
      await nextTick()
      expect(wrapper.vm.roleBeingEdited).toEqual({ id: 2, name: 'viewer' })
      expect(wrapper.vm.roleDialog).toBe(true)
    })

    test('onRoleFormSave calls createRole when id is missing and closes on success', async () => {
      wrapper = createWrapper()
      wrapper.vm.roleDialog = true
      await wrapper.vm.onRoleFormSave({ name: 'newRole' })
      expect(rm.createRole).toHaveBeenCalledWith('newRole')
      expect(wrapper.vm.roleDialog).toBe(false)
    })

    test('onRoleFormSave calls updateRole when id is present', async () => {
      wrapper = createWrapper()
      wrapper.vm.roleDialog = true
      await wrapper.vm.onRoleFormSave({ id: 5, name: 'renamed' })
      expect(rm.updateRole).toHaveBeenCalledWith(5, 'renamed')
      expect(wrapper.vm.roleDialog).toBe(false)
    })

    test('onRoleFormSave keeps the dialog open on failure', async () => {
      rm.createRole.mockResolvedValueOnce(false)
      wrapper = createWrapper()
      wrapper.vm.roleDialog = true
      await wrapper.vm.onRoleFormSave({ name: 'x' })
      expect(wrapper.vm.roleDialog).toBe(true)
      expect(wrapper.vm.savingRole).toBe(false)
    })
  })

  describe('role delete flow', () => {
    test('openRoleDelete sets the role and opens the dialog', async () => {
      wrapper = createWrapper()
      wrapper.vm.openRoleDelete({ id: 1, name: 'admin' })
      await nextTick()
      expect(wrapper.vm.roleToDelete).toEqual({ id: 1, name: 'admin' })
      expect(wrapper.vm.roleDeleteDialog).toBe(true)
    })

    test('onConfirmDelete deletes and closes on success', async () => {
      wrapper = createWrapper()
      wrapper.vm.openRoleDelete({ id: 1, name: 'admin' })
      await wrapper.vm.onConfirmDelete()
      expect(rm.deleteRole).toHaveBeenCalledWith(1)
      expect(wrapper.vm.roleDeleteDialog).toBe(false)
      expect(wrapper.vm.roleToDelete).toBeNull()
    })

    test('onConfirmDelete returns early when no role to delete', async () => {
      wrapper = createWrapper()
      wrapper.vm.roleToDelete = null
      await wrapper.vm.onConfirmDelete()
      expect(rm.deleteRole).not.toHaveBeenCalled()
    })

    test('onConfirmDelete keeps the dialog open on failure', async () => {
      rm.deleteRole.mockResolvedValueOnce(false)
      wrapper = createWrapper()
      wrapper.vm.openRoleDelete({ id: 1, name: 'admin' })
      await wrapper.vm.onConfirmDelete()
      expect(wrapper.vm.roleDeleteDialog).toBe(true)
    })
  })

  describe('user roles flow', () => {
    test('openUserEdit sets the user and opens the dialog', async () => {
      wrapper = createWrapper()
      wrapper.vm.openUserEdit({ id: 9, username: 'k' })
      await nextTick()
      expect(wrapper.vm.userToEdit).toEqual({ id: 9, username: 'k' })
      expect(wrapper.vm.userDialog).toBe(true)
    })

    test('onUserRolesSave saves and closes on success', async () => {
      wrapper = createWrapper()
      wrapper.vm.userDialog = true
      const user = { id: 9, username: 'k' }
      const profile = {
        first_name: 'Kate',
        last_name: 'Smith',
        email: 'k@example.com',
      }
      await wrapper.vm.onUserRolesSave({ user, profile, roleNames: ['admin'] })
      expect(rm.updateUserProfile).toHaveBeenCalledWith(user, profile)
      expect(rm.saveUserRoleAssignments).toHaveBeenCalledWith(user, ['admin'])
      expect(wrapper.vm.userDialog).toBe(false)
    })

    test('onUserRolesSave keeps dialog open when profile save fails', async () => {
      rm.updateUserProfile.mockResolvedValueOnce(false)
      wrapper = createWrapper()
      wrapper.vm.userDialog = true
      await wrapper.vm.onUserRolesSave({
        user: { id: 1 },
        profile: { first_name: '', last_name: '', email: '' },
        roleNames: [],
      })
      expect(rm.saveUserRoleAssignments).not.toHaveBeenCalled()
      expect(wrapper.vm.userDialog).toBe(true)
    })

    test('onUserRolesSave keeps dialog open when role save fails', async () => {
      rm.saveUserRoleAssignments.mockResolvedValueOnce(false)
      wrapper = createWrapper()
      wrapper.vm.userDialog = true
      await wrapper.vm.onUserRolesSave({
        user: { id: 1 },
        profile: { first_name: '', last_name: '', email: '' },
        roleNames: [],
      })
      expect(rm.updateUserProfile).toHaveBeenCalled()
      expect(wrapper.vm.userDialog).toBe(true)
    })
  })

  describe('child events', () => {
    test('RolesPanel select event calls selectRole', async () => {
      wrapper = createWrapper()
      wrapper.findComponent({ name: 'RolesPanel' }).vm.$emit('select', 2)
      expect(rm.selectRole).toHaveBeenCalledWith(2)
    })

    test('UsersPanel update:search updates usersSearch', async () => {
      wrapper = createWrapper()
      wrapper.findComponent({ name: 'UsersPanel' }).vm.$emit('update:search', 'foo')
      await nextTick()
      expect(wrapper.vm.usersSearch).toBe('foo')
    })

    test('UsersPanel clear-filter calls selectRole(null)', async () => {
      wrapper = createWrapper()
      wrapper.findComponent({ name: 'UsersPanel' }).vm.$emit('clear-filter')
      expect(rm.selectRole).toHaveBeenCalledWith(null)
    })
  })

  describe('account unlock', () => {
    const lockedUser = {
      id: 7,
      username: 'lockeduser',
      role_names: ['planner'],
      locked: true,
    }

    test('canUnlock is false for regular admins', () => {
      platformAdmin.value = false
      wrapper = createWrapper()
      expect(
        wrapper.findComponent({ name: 'UsersPanel' }).props('canUnlock'),
      ).toBe(false)
    })

    test('canUnlock is true for platform admins', () => {
      platformAdmin.value = true
      wrapper = createWrapper()
      expect(
        wrapper.findComponent({ name: 'UsersPanel' }).props('canUnlock'),
      ).toBe(true)
    })

    test('unlock event asks for confirmation and unlocks', async () => {
      platformAdmin.value = true
      const confirmSpy = vi
        .spyOn(window, 'confirm')
        .mockReturnValue(true)
      wrapper = createWrapper()
      wrapper.findComponent({ name: 'UsersPanel' }).vm.$emit('unlock', lockedUser)
      await flushPromises()
      expect(confirmSpy).toHaveBeenCalled()
      expect(rm.unlockUser).toHaveBeenCalledWith(lockedUser)
      confirmSpy.mockRestore()
    })

    test('declining the confirmation does not unlock', async () => {
      platformAdmin.value = true
      const confirmSpy = vi
        .spyOn(window, 'confirm')
        .mockReturnValue(false)
      wrapper = createWrapper()
      wrapper.findComponent({ name: 'UsersPanel' }).vm.$emit('unlock', lockedUser)
      await flushPromises()
      expect(rm.unlockUser).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })
  })

  describe('reset MFA', () => {
    const mfaUser = {
      id: 8,
      username: 'mfauser',
      role_names: ['planner'],
      mfaEnabled: true,
    }

    test('reset-mfa event asks for confirmation and resets', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      wrapper = createWrapper()
      wrapper
        .findComponent({ name: 'UsersPanel' })
        .vm.$emit('reset-mfa', mfaUser)
      await flushPromises()
      expect(confirmSpy).toHaveBeenCalled()
      expect(rm.resetUserMfa).toHaveBeenCalledWith(mfaUser)
      confirmSpy.mockRestore()
    })

    test('declining the confirmation does not reset', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      wrapper = createWrapper()
      wrapper
        .findComponent({ name: 'UsersPanel' })
        .vm.$emit('reset-mfa', mfaUser)
      await flushPromises()
      expect(rm.resetUserMfa).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })
  })
})
