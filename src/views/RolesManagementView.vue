<template>
  <div class="view-container">
    <CoreTitleView
      :icon="'mdi-shield-account'"
      :title="$t('rolesManagement.title')"
      :description="$t('rolesManagement.description')"
    />

    <div class="roles-layout mt-4">
      <RolesPanel
        :roles="roles"
        :selected-role-id="selectedRoleId"
        :selected-role="selectedRole"
        :users-count-by-role="usersCountByRole"
        :total-users="users.length"
        :loading="loadingRoles"
        :allow-edit="allowEditRoles"
        @select="selectRole"
        @create="openRoleCreate"
        @edit="openRoleEdit"
        @delete="openRoleDelete"
      />

      <UsersPanel
        :users="users"
        :selected-role="selectedRole"
        :search="usersSearch"
        :loading="loadingUsers"
        @update:search="usersSearch = $event"
        @clear-filter="selectRole(null)"
        @edit="openUserEdit"
      />
    </div>

    <RoleFormDialog
      v-if="allowEditRoles"
      v-model="roleDialog"
      :role="roleBeingEdited"
      :saving="savingRole"
      @save="onRoleFormSave"
    />

    <RoleDeleteDialog
      v-if="allowEditRoles"
      v-model="roleDeleteDialog"
      :role="roleToDelete"
      :deleting="deletingRole"
      @confirm="onConfirmDelete"
    />

    <UserRolesDialog
      v-model="userDialog"
      :user="userToEdit"
      :roles="roles"
      :saving="savingUser"
      @save="onUserRolesSave"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import RolesPanel from '@cornflow-ui/core/components/roles-management/RolesPanel.vue'
import UsersPanel from '@cornflow-ui/core/components/roles-management/UsersPanel.vue'
import RoleFormDialog from '@cornflow-ui/core/components/roles-management/RoleFormDialog.vue'
import RoleDeleteDialog from '@cornflow-ui/core/components/roles-management/RoleDeleteDialog.vue'
import UserRolesDialog from '@cornflow-ui/core/components/roles-management/UserRolesDialog.vue'
import { useRolesManagement } from '@cornflow-ui/core/composables/roles-management/useRolesManagement'
import type {
  Role,
  RoleFormValue,
  UserRow,
  UserProfileValue,
} from '@cornflow-ui/core/composables/roles-management/types'
import appConfig from '@/app/config'

const {
  roles,
  loadingRoles,
  selectedRoleId,
  selectedRole,
  users,
  loadingUsers,
  usersCountByRole,
  selectRole,
  fetchRoles,
  fetchUsers,
  createRole,
  updateRole,
  deleteRole,
  updateUserProfile,
  saveUserRoleAssignments,
} = useRolesManagement()

const allowEditRoles = computed(
  () => appConfig.getCore().parameters.allowEditRoles,
)

const usersSearch = ref('')

// ── Role create / edit ───────────────────────────────────────────────────────
const roleDialog = ref(false)
const roleBeingEdited = ref<Role | null>(null)
const savingRole = ref(false)

function openRoleCreate() {
  roleBeingEdited.value = null
  roleDialog.value = true
}

function openRoleEdit(role: Role) {
  roleBeingEdited.value = role
  roleDialog.value = true
}

async function onRoleFormSave(value: RoleFormValue) {
  savingRole.value = true
  const ok =
    value.id == null
      ? await createRole(value.name)
      : await updateRole(value.id, value.name)
  savingRole.value = false
  if (ok) roleDialog.value = false
}

// ── Role delete ──────────────────────────────────────────────────────────────
const roleDeleteDialog = ref(false)
const roleToDelete = ref<Role | null>(null)
const deletingRole = ref(false)

function openRoleDelete(role: Role) {
  roleToDelete.value = role
  roleDeleteDialog.value = true
}

async function onConfirmDelete() {
  if (!roleToDelete.value) return
  deletingRole.value = true
  const ok = await deleteRole(roleToDelete.value.id)
  deletingRole.value = false
  if (ok) {
    roleDeleteDialog.value = false
    roleToDelete.value = null
  }
}

// ── User roles edit ──────────────────────────────────────────────────────────
const userDialog = ref(false)
const userToEdit = ref<UserRow | null>(null)
const savingUser = ref(false)

function openUserEdit(user: UserRow) {
  userToEdit.value = user
  userDialog.value = true
}

async function onUserRolesSave(payload: {
  user: UserRow
  profile: UserProfileValue
  roleNames: string[]
}) {
  savingUser.value = true
  const profileOk = await updateUserProfile(payload.user, payload.profile)
  if (!profileOk) {
    savingUser.value = false
    return
  }
  const rolesOk = await saveUserRoleAssignments(
    payload.user,
    payload.roleNames,
  )
  savingUser.value = false
  if (rolesOk) userDialog.value = false
}

onMounted(async () => {
  await fetchRoles()
  await fetchUsers()
})
</script>

<style scoped>
.roles-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

@media (max-width: 960px) {
  .roles-layout {
    flex-direction: column;
  }
}
</style>
