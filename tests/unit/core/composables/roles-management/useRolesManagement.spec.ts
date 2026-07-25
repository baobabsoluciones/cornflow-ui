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
  userRepo: {
    getAllUsers: vi.fn(),
    updateUser: vi.fn(),
    unlockUser: vi.fn(),
  },
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
    expect(repo.assignRoleToUser).toHaveBeenCalledWith(7, 3)
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
})

describe('useRolesManagement - unlockUser', () => {
  test('unlocks the user and mutates the row in place', async () => {
    userRepo.unlockUser.mockResolvedValueOnce(true)
    const rm = useRolesManagement()
    const user: any = { id: 7, username: 'locked', locked: true }
    expect(await rm.unlockUser(user)).toBe(true)
    expect(userRepo.unlockUser).toHaveBeenCalledWith(7)
    expect(user.locked).toBe(false)
    expect(snackbar).toHaveBeenCalledWith(
      'rolesManagement.userUnlocked',
      'success',
    )
  })

  test('reports an error when the endpoint rejects', async () => {
    userRepo.unlockUser.mockRejectedValueOnce(new Error('x'))
    const rm = useRolesManagement()
    const user: any = { id: 7, username: 'locked', locked: true }
    expect(await rm.unlockUser(user)).toBe(false)
    expect(user.locked).toBe(true)
    expect(snackbar).toHaveBeenCalledWith(
      'rolesManagement.errorUnlockUser',
      'error',
    )
  })

  test('reports an error when the endpoint returns false', async () => {
    userRepo.unlockUser.mockResolvedValueOnce(false)
    const rm = useRolesManagement()
    const user: any = { id: 7, username: 'locked', locked: true }
    expect(await rm.unlockUser(user)).toBe(false)
    expect(user.locked).toBe(true)
    expect(snackbar).toHaveBeenCalledWith(
      'rolesManagement.errorUnlockUser',
      'error',
    )
  })
})
