/**
 * Orchestrates roles and users state for the RolesManagementView: fetching,
 * selection, and CRUD operations. UI concerns (icons, colors, avatars) live
 * in sibling composables (useRoleMeta, useUserAvatar) so the view can wire
 * everything together without owning any of the logic.
 */

import { ref, computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import type { Role, UserRow } from './types'

export function useRolesManagement() {
  const { t } = useI18n()
  const store = useGeneralStore()
  const showSnackbar = inject<(msg: string, type?: string) => void>(
    'showSnackbar',
  )

  // ── State: roles ────────────────────────────────────────────────────────────
  const roles = ref<Role[]>([])
  const loadingRoles = ref(false)
  const selectedRoleId = ref<number | null>(null)

  // ── State: users ────────────────────────────────────────────────────────────
  const users = ref<UserRow[]>([])
  const loadingUsers = ref(false)

  // ── Computed ────────────────────────────────────────────────────────────────
  const selectedRole = computed<Role | null>(() => {
    if (selectedRoleId.value == null) return null
    return roles.value.find((r) => r.id === selectedRoleId.value) ?? null
  })

  const usersCountByRole = computed<Record<number, number>>(() => {
    const counts: Record<number, number> = {}
    for (const u of users.value) {
      for (const id of u._role_ids) counts[id] = (counts[id] ?? 0) + 1
    }
    return counts
  })

  // ── Actions ─────────────────────────────────────────────────────────────────
  function selectRole(id: number | null) {
    selectedRoleId.value = id
  }

  async function fetchRoles() {
    loadingRoles.value = true
    try {
      roles.value = await store.roleRepository.getRoles()
      // Drop selection if the previously selected role no longer exists.
      if (
        selectedRoleId.value !== null &&
        !roles.value.some((r) => r.id === selectedRoleId.value)
      ) {
        selectedRoleId.value = null
      }
    } catch {
      showSnackbar?.(t('rolesManagement.errorLoadRoles'), 'error')
    } finally {
      loadingRoles.value = false
    }
  }

  async function fetchUsers() {
    loadingUsers.value = true
    try {
      const [rawUsers, allAssignments] = await Promise.all([
        store.userRepository.getAllUsers(),
        store.roleRepository.getAllUserRoleAssignments(),
      ])

      const userRolesMap = new Map<number, { id: number; name: string }[]>()
      for (const a of allAssignments) {
        const list = userRolesMap.get(a.user_id) ?? []
        list.push({ id: a.role_id, name: a.role })
        userRolesMap.set(a.user_id, list)
      }

      users.value = rawUsers.map((u) => {
        const userRoles = userRolesMap.get(u.id) ?? []
        return {
          id: u.id,
          username: u.username,
          full_name:
            [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username,
          email: u.email,
          _role_ids: userRoles.map((r) => r.id),
          role_names: userRoles.map((r) => r.name),
        }
      })
    } catch {
      showSnackbar?.(t('rolesManagement.errorLoadUsers'), 'error')
    } finally {
      loadingUsers.value = false
    }
  }

  async function createRole(name: string): Promise<boolean> {
    try {
      await store.roleRepository.createRole(name)
      showSnackbar?.(t('rolesManagement.roleCreated'), 'success')
      await fetchRoles()
      return true
    } catch {
      showSnackbar?.(t('rolesManagement.errorSaveRole'), 'error')
      return false
    }
  }

  async function updateRole(id: number, name: string): Promise<boolean> {
    try {
      await store.roleRepository.updateRole(id, name)
      showSnackbar?.(t('rolesManagement.roleUpdated'), 'success')
      await fetchRoles()
      return true
    } catch {
      showSnackbar?.(t('rolesManagement.errorSaveRole'), 'error')
      return false
    }
  }

  async function deleteRole(id: number): Promise<boolean> {
    try {
      await store.roleRepository.deleteRole(id)
      showSnackbar?.(t('rolesManagement.roleDeleted'), 'success')
      await Promise.all([fetchRoles(), fetchUsers()])
      return true
    } catch {
      showSnackbar?.(t('rolesManagement.errorDeleteRole'), 'error')
      return false
    }
  }

  /**
   * Diffs the user's current role IDs against the new role names and issues
   * one assign / unassign per change. Mutates the user row in place on
   * success so the table reflects the new state without a full refetch.
   */
  async function saveUserRoleAssignments(
    user: UserRow,
    newNames: string[],
  ): Promise<boolean> {
    const oldIds = new Set(user._role_ids)
    const newIds = new Set(
      newNames
        .map((name) => roles.value.find((r) => r.name === name)?.id)
        .filter((id): id is number => id != null),
    )

    const toRemove = [...oldIds].filter((id) => !newIds.has(id))
    const toAdd = [...newIds].filter((id) => !oldIds.has(id))

    try {
      await Promise.all([
        ...toRemove.map((id) =>
          store.roleRepository.removeRoleFromUser(user.id, id),
        ),
        ...toAdd.map((id) =>
          store.roleRepository.assignRoleToUser(user.id, id),
        ),
      ])
      user._role_ids = [...newIds]
      user.role_names = [...newNames]
      showSnackbar?.(t('rolesManagement.roleAssigned'), 'success')
      return true
    } catch {
      showSnackbar?.(t('rolesManagement.errorAssignRole'), 'error')
      return false
    }
  }

  return {
    // State
    roles,
    loadingRoles,
    selectedRoleId,
    users,
    loadingUsers,

    // Computed
    selectedRole,
    usersCountByRole,

    // Actions
    selectRole,
    fetchRoles,
    fetchUsers,
    createRole,
    updateRole,
    deleteRole,
    saveUserRoleAssignments,
  }
}
