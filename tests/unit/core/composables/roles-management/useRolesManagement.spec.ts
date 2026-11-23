import { describe, test, expect, vi, beforeEach } from 'vitest'

const { snackbar, repo, userRepo } = vi.hoisted(() => ({
  snackbar: vi.fn(),
  repo: {
    getRoles: vi.fn(),
    getAllUserRoleAssignments: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    assignRoleToUser: vi.fn(),
    removeRoleFromUser: vi.fn(),
  },
  userRepo: { getAllUsers: vi.fn(), unlockUser: vi.fn(), resetMfa: vi.fn() },
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('vue', async (orig) => ({
  ...(await (orig as () => Promise<any>)()),
  inject: () => snackbar,
}))
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => ({ roleRepository: repo, userRepository: userRepo }),
}))

import { useRolesManagement } from '@cornflow-ui/core/composables/roles-management/useRolesManagement'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useRolesManagement - selection & computed', () => {
  test('selectRole drives the selectedRole computed', () => {
    const rm = useRolesManagement()
    rm.roles.value = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ] as any
    expect(rm.selectedRole.value).toBeNull()
    rm.selectRole(2)
    expect(rm.selectedRole.value).toEqual({ id: 2, name: 'b' })
    rm.selectRole(99) // non-existent
    expect(rm.selectedRole.value).toBeNull()
  })

  test('usersCountByRole tallies role ids across users', () => {
    const rm = useRolesManagement()
    rm.users.value = [
      { _role_ids: [1, 2] },
      { _role_ids: [1] },
    ] as any
    expect(rm.usersCountByRole.value).toEqual({ 1: 2, 2: 1 })
  })
})

describe('useRolesManagement - fetchRoles', () => {
  test('loads roles and clears a stale selection', async () => {
    repo.getRoles.mockResolvedValueOnce([{ id: 1, name: 'a' }])
    const rm = useRolesManagement()
    rm.selectRole(99) // will no longer exist after fetch
    await rm.fetchRoles()
    expect(rm.roles.value).toEqual([{ id: 1, name: 'a' }])
    expect(rm.selectedRoleId.value).toBeNull()
    expect(rm.loadingRoles.value).toBe(false)
  })

  test('shows an error snackbar on failure', async () => {
    repo.getRoles.mockRejectedValueOnce(new Error('x'))
    const rm = useRolesManagement()
    await rm.fetchRoles()
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.errorLoadRoles', 'error')
    expect(rm.loadingRoles.value).toBe(false)
  })

  test('a Cornflow that keeps its roles to platform administrators is told apart from a failure', async () => {
    repo.getRoles.mockRejectedValueOnce(new Error('platform_admin_required'))
    const rm = useRolesManagement()
    await rm.fetchRoles()
    expect(rm.rolesForbidden.value).toBe(true)
    expect(snackbar).not.toHaveBeenCalled()
  })
})

describe('useRolesManagement - fetchUsers', () => {
  test('maps users with role names and a full_name fallback', async () => {
    userRepo.getAllUsers.mockResolvedValueOnce([
      { id: 1, username: 'jdoe', first_name: 'John', last_name: 'Doe', email: 'j@x' },
      { id: 2, username: 'anon', first_name: '', last_name: '', email: 'a@x' },
    ])
    repo.getAllUserRoleAssignments.mockResolvedValueOnce([
      { user_id: 1, role_id: 10, role: 'admin' },
    ])
    const rm = useRolesManagement()
    await rm.fetchUsers()
    expect(rm.users.value[0]).toMatchObject({
      full_name: 'John Doe',
      _role_ids: [10],
      role_names: ['admin'],
    })
    // no first/last name -> falls back to username
    expect(rm.users.value[1].full_name).toBe('anon')
    expect(rm.users.value[1]._role_ids).toEqual([])
    expect(rm.users.value[1]).toMatchObject({ locked: false, mfaEnabled: false })
  })

  test('says which accounts are locked and which have two-factor authentication', async () => {
    userRepo.getAllUsers.mockResolvedValueOnce([
      { id: 1, username: 'jdoe', email: 'j@x', locked: true, mfa_enabled: true },
    ])
    repo.getAllUserRoleAssignments.mockResolvedValueOnce([])
    const rm = useRolesManagement()
    await rm.fetchUsers()
    expect(rm.users.value[0]).toMatchObject({ locked: true, mfaEnabled: true })
  })

  test('shows an error snackbar on failure', async () => {
    userRepo.getAllUsers.mockRejectedValueOnce(new Error('x'))
    repo.getAllUserRoleAssignments.mockResolvedValueOnce([])
    const rm = useRolesManagement()
    await rm.fetchUsers()
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.errorLoadUsers', 'error')
  })
})

describe('useRolesManagement - role CRUD', () => {
  test('createRole succeeds and refetches', async () => {
    repo.createRole.mockResolvedValueOnce({ id: 1, name: 'a' })
    repo.getRoles.mockResolvedValueOnce([{ id: 1, name: 'a' }])
    const rm = useRolesManagement()
    expect(await rm.createRole('a')).toBe(true)
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.roleCreated', 'success')
    expect(repo.getRoles).toHaveBeenCalled()
  })

  test('createRole returns false on error', async () => {
    repo.createRole.mockRejectedValueOnce(new Error('x'))
    const rm = useRolesManagement()
    expect(await rm.createRole('a')).toBe(false)
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.errorSaveRole', 'error')
  })

  test('updateRole succeeds and fails', async () => {
    repo.updateRole.mockResolvedValueOnce({})
    repo.getRoles.mockResolvedValueOnce([])
    const rm = useRolesManagement()
    expect(await rm.updateRole(1, 'b')).toBe(true)

    repo.updateRole.mockRejectedValueOnce(new Error('x'))
    expect(await rm.updateRole(1, 'b')).toBe(false)
  })

  test('deleteRole succeeds (refetches roles + users) and fails', async () => {
    repo.deleteRole.mockResolvedValueOnce(true)
    repo.getRoles.mockResolvedValueOnce([])
    userRepo.getAllUsers.mockResolvedValueOnce([])
    repo.getAllUserRoleAssignments.mockResolvedValueOnce([])
    const rm = useRolesManagement()
    expect(await rm.deleteRole(1)).toBe(true)
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.roleDeleted', 'success')

    repo.deleteRole.mockRejectedValueOnce(new Error('x'))
    expect(await rm.deleteRole(1)).toBe(false)
  })
})

describe('useRolesManagement - saveUserRoleAssignments', () => {
  test('diffs role names and issues assign/remove calls', async () => {
    repo.assignRoleToUser.mockResolvedValue({})
    repo.removeRoleFromUser.mockResolvedValue({})
    const rm = useRolesManagement()
    rm.roles.value = [
      { id: 1, name: 'admin' },
      { id: 2, name: 'editor' },
      { id: 3, name: 'viewer' },
    ] as any
    const user: any = { id: 7, _role_ids: [1, 2], role_names: ['admin', 'editor'] }

    // keep admin(1), drop editor(2), add viewer(3)
    const ok = await rm.saveUserRoleAssignments(user, ['admin', 'viewer'])
    expect(ok).toBe(true)
    expect(repo.removeRoleFromUser).toHaveBeenCalledWith(7, 2)
    expect(repo.assignRoleToUser).toHaveBeenCalledWith(7, 3, undefined)
    // user row mutated in place
    expect(user._role_ids).toEqual([1, 3])
    expect(user.role_names).toEqual(['admin', 'viewer'])
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.roleAssigned', 'success')
  })

  test('returns false and reports when a call fails', async () => {
    repo.assignRoleToUser.mockRejectedValueOnce(new Error('x'))
    const rm = useRolesManagement()
    rm.roles.value = [{ id: 3, name: 'viewer' }] as any
    const user: any = { id: 7, _role_ids: [], role_names: [] }
    expect(await rm.saveUserRoleAssignments(user, ['viewer'])).toBe(false)
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.errorAssignRole', 'error')
  })

  test('the two-factor code goes only with a platform role', async () => {
    repo.assignRoleToUser.mockResolvedValue({})
    const rm = useRolesManagement()
    rm.roles.value = [
      { id: 3, name: 'viewer' },
      { id: 903, name: 'platform_admin' },
    ] as any
    const user: any = { id: 7, _role_ids: [], role_names: [] }

    await rm.saveUserRoleAssignments(user, ['viewer', 'platform_admin'], '123456')

    expect(repo.assignRoleToUser).toHaveBeenCalledWith(7, 3, undefined)
    expect(repo.assignRoleToUser).toHaveBeenCalledWith(7, 903, '123456')
  })

  test('a platform role without a valid code says so and shows the roles as they are', async () => {
    repo.assignRoleToUser.mockRejectedValueOnce(new Error('totp_required'))
    userRepo.getAllUsers.mockResolvedValueOnce([])
    repo.getAllUserRoleAssignments.mockResolvedValueOnce([])
    const rm = useRolesManagement()
    rm.roles.value = [{ id: 903, name: 'platform_admin' }] as any
    const user: any = { id: 7, _role_ids: [], role_names: [] }

    expect(await rm.saveUserRoleAssignments(user, ['platform_admin'], '000000')).toBe(false)
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.errorPlatformRoleTotp', 'error')
    expect(userRepo.getAllUsers).toHaveBeenCalled()
  })
})

describe('useRolesManagement - unlock and two-factor reset', () => {
  test('unlocking marks the row unlocked', async () => {
    userRepo.unlockUser.mockResolvedValueOnce(true)
    const rm = useRolesManagement()
    const user: any = { id: 3, locked: true }

    expect(await rm.unlockUser(user)).toBe(true)
    expect(userRepo.unlockUser).toHaveBeenCalledWith(3)
    expect(user.locked).toBe(false)
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.userUnlocked', 'success')
  })

  test('an unlock cornflow refuses says so and keeps the row locked', async () => {
    userRepo.unlockUser.mockResolvedValueOnce(false)
    const rm = useRolesManagement()
    const user: any = { id: 3, locked: true }

    expect(await rm.unlockUser(user)).toBe(false)
    expect(user.locked).toBe(true)
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.errorUnlockUser', 'error')
  })

  test('resetting two-factor authentication marks the row without it', async () => {
    userRepo.resetMfa.mockResolvedValueOnce(true)
    const rm = useRolesManagement()
    const user: any = { id: 3, mfaEnabled: true }

    expect(await rm.resetUserMfa(user)).toBe(true)
    expect(userRepo.resetMfa).toHaveBeenCalledWith(3)
    expect(user.mfaEnabled).toBe(false)
  })

  test('a reset that fails says so', async () => {
    userRepo.resetMfa.mockRejectedValueOnce(new Error('offline'))
    const rm = useRolesManagement()
    const user: any = { id: 3, mfaEnabled: true }

    expect(await rm.resetUserMfa(user)).toBe(false)
    expect(user.mfaEnabled).toBe(true)
    expect(snackbar).toHaveBeenCalledWith('rolesManagement.errorResetMfa', 'error')
  })
})
