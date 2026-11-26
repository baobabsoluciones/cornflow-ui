<!--
  RolesManagementView: the roles of the app and its users, side by side.

  - Roles: pick one to see its permissions and filter the users by it; with `allowEditRoles`, add,
    rename and delete roles.
  - Users: search them and edit a user's name, e-mail and roles; unlock a locked account and reset
    a user's two-factor authentication, as far as Cornflow allows. Granting a platform role asks for
    the administrator's two-factor code when they have it.
  - On a Cornflow that keeps its roles to platform administrators, anyone else is told so and keeps
    the users, without editing them.
-->
<template>
  <div class="view-container">
    <CoreTitleView
      icon="mdi-shield-account"
      :title="$t('rolesManagement.title')"
      :description="$t('rolesManagement.description')"
    />

    <CoreAlert
      v-if="rolesForbidden"
      class="roles-forbidden"
      tone="info"
      :message="$t('rolesManagement.platformAdminRequired')"
      data-testid="roles-platform-admin-required"
    />

    <div class="roles-layout" :class="{ 'roles-layout--users-only': rolesForbidden }">
      <RolesPanel
        v-if="!rolesForbidden"
        data-tour="roles-roles"
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
        :can-edit-users="!rolesForbidden"
        @update:search="usersSearch = $event"
        @clear-filter="selectRole(null)"
        @edit="openUserEdit"
        @unlock="askUserAction('unlock', $event)"
        @reset-mfa="askUserAction('reset-mfa', $event)"
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
      :ask-totp="askTotp"
      @save="onUserRolesSave"
    />

    <CoreConfirmDialog
      :model-value="userAction !== null"
      :title="userAction ? $t(USER_ACTIONS[userAction.kind].title) : ''"
      :message="userAction ? $t(USER_ACTIONS[userAction.kind].message, { username: userAction.user.username }) : ''"
      :confirm-text="userAction ? $t(USER_ACTIONS[userAction.kind].title) : ''"
      :cancel-text="$t('rolesManagement.cancel')"
      :icon="userAction ? USER_ACTIONS[userAction.kind].icon : ''"
      :loading="runningUserAction"
      @confirm="runUserAction"
      @cancel="userAction = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'
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
import { getAppParameters } from '@cornflow-ui/core/utils/appParameters'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

const {
  roles,
  loadingRoles,
  rolesForbidden,
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
  unlockUser,
  resetUserMfa,
} = useRolesManagement()

const store = useGeneralStore()
/** Cornflow asks an administrator with two-factor authentication for a code to grant a platform role. */
const askTotp = computed(() => !!store.getUser?.mfaEnabled)

const allowEditRoles = computed(
  () => getAppParameters().allowEditRoles,
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
  totpCode?: string
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
    payload.totpCode,
  )
  savingUser.value = false
  if (rolesOk) userDialog.value = false
}

// ── Unlock / reset two-factor, once confirmed ────────────────────────────────
const USER_ACTIONS = {
  unlock: {
    title: 'rolesManagement.unlockUser',
    message: 'rolesManagement.unlockConfirm',
    icon: 'mdi-lock-open-variant-outline',
    run: unlockUser,
  },
  'reset-mfa': {
    title: 'rolesManagement.resetMfa',
    message: 'rolesManagement.resetMfaConfirm',
    icon: 'mdi-shield-off-outline',
    run: resetUserMfa,
  },
} as const

const userAction = ref<{ kind: keyof typeof USER_ACTIONS; user: UserRow } | null>(null)
const runningUserAction = ref(false)

function askUserAction(kind: keyof typeof USER_ACTIONS, user: UserRow) {
  userAction.value = { kind, user }
}

async function runUserAction() {
  if (!userAction.value) return
  runningUserAction.value = true
  await USER_ACTIONS[userAction.value.kind].run(userAction.value.user)
  runningUserAction.value = false
  userAction.value = null
}

onMounted(async () => {
  await fetchRoles()
  await fetchUsers()
})
</script>

<style scoped>
.roles-forbidden {
  max-width: 720px;
  margin-top: calc(var(--spacing) * 4);
}

.roles-layout {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  align-items: start;
  gap: calc(var(--spacing) * 5);
  margin-top: calc(var(--spacing) * 4);
}

.roles-layout--users-only {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 960px) {
  .roles-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
