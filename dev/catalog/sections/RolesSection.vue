<template>
  <div class="catalog-section">
    <h1 class="catalog-section__title">Roles management</h1>
    <p class="catalog-section__lead">
      The pieces of the roles screen, with the role presets of
      <code>useRoleMeta</code> and sample users.
    </p>

    <CatalogBlock
      name="RolesPanel"
      api="roles · selectedRoleId · selectedRole · usersCountByRole · totalUsers · loading · allowEdit → select, create, edit, delete"
      note="Pick a role: its permissions show under the list and its row offers edit and delete."
    >
      <div class="roles-frame">
        <RolesPanel
          :roles="roles"
          :selected-role-id="selectedRoleId"
          :selected-role="selectedRole"
          :users-count-by-role="usersCountByRole"
          :total-users="users.length"
          allow-edit
          @select="selectedRoleId = $event"
          @create="openRoleForm(null)"
          @edit="openRoleForm"
          @delete="openRoleDelete"
        />
      </div>
      <div class="roles-frame">
        <RolesPanel
          :roles="[]"
          :selected-role-id="null"
          :selected-role="null"
          :users-count-by-role="{}"
          :total-users="0"
          loading
        />
      </div>
      <div class="roles-frame">
        <RolesPanel
          :roles="[]"
          :selected-role-id="null"
          :selected-role="null"
          :users-count-by-role="{}"
          :total-users="0"
        />
      </div>
    </CatalogBlock>

    <CatalogBlock
      name="UsersPanel"
      api="users · selectedRole · search · loading → update:search, clear-filter, edit"
      note="Filtered by the role picked in the RolesPanel above; sort by user or e-mail from the headers."
      column
    >
      <UsersPanel
        :users="users"
        :selected-role="selectedRole"
        :search="search"
        @update:search="search = $event"
        @clear-filter="selectedRoleId = null"
        @edit="openUser"
      />
      <UsersPanel :users="[]" :selected-role="null" search="" loading />
    </CatalogBlock>

    <CatalogBlock
      name="RoleFormDialog · RoleDeleteDialog · UserRolesDialog"
      api="v-model · role · saving → save · v-model · role · deleting → confirm · v-model · user · roles · saving → save"
    >
      <CoreButton variant="outlined" text="Add role" icon="mdi-plus" @click="openRoleForm(null)" />
      <CoreButton variant="outlined" text="Rename role" icon="mdi-pencil-outline" @click="openRoleForm(roles[1])" />
      <CoreButton
        variant="outlined"
        color="danger"
        text="Delete role"
        icon="mdi-delete-outline"
        @click="openRoleDelete(roles[1])"
      />
      <CoreButton variant="outlined" text="Edit user" icon="mdi-account-edit-outline" @click="openUser(users[0])" />

      <RoleFormDialog v-model="roleFormOpen" :role="roleBeingEdited" @save="roleFormOpen = false" />
      <RoleDeleteDialog
        v-model="roleDeleteOpen"
        :role="roleToDelete"
        :deleting="deleting"
        @confirm="fakeDelete"
      />
      <UserRolesDialog
        v-model="userDialogOpen"
        :user="userToEdit"
        :roles="roles"
        @save="userDialogOpen = false"
      />
    </CatalogBlock>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import RoleDeleteDialog from '@cornflow-ui/core/components/roles-management/RoleDeleteDialog.vue'
import RoleFormDialog from '@cornflow-ui/core/components/roles-management/RoleFormDialog.vue'
import RolesPanel from '@cornflow-ui/core/components/roles-management/RolesPanel.vue'
import UserRolesDialog from '@cornflow-ui/core/components/roles-management/UserRolesDialog.vue'
import UsersPanel from '@cornflow-ui/core/components/roles-management/UsersPanel.vue'
import type { Role, UserRow } from '@cornflow-ui/core/composables/roles-management/types'
import CatalogBlock from '../CatalogBlock.vue'

const roles: Role[] = [
  { id: 1, name: 'admin' },
  { id: 2, name: 'planner' },
  { id: 3, name: 'viewer' },
  { id: 4, name: 'service' },
  { id: 5, name: 'auditor' },
]

const makeUser = (
  id: number,
  username: string,
  firstName: string,
  lastName: string,
  roleNames: string[],
): UserRow => ({
  id,
  username,
  first_name: firstName,
  last_name: lastName,
  full_name: `${firstName} ${lastName}`.trim(),
  email: firstName ? `${username}@example.com` : '',
  role_names: roleNames,
  _role_ids: roleNames.map((name) => roles.find((r) => r.name === name)!.id),
})

const users: UserRow[] = [
  makeUser(1, 'agarcia', 'Ana', 'García', ['admin', 'planner']),
  makeUser(2, 'jmartin', 'Javier', 'Martín', ['planner']),
  makeUser(3, 'lsanchez', 'Lucía', 'Sánchez', ['viewer']),
  makeUser(4, 'pnavarro', 'Pablo', 'Navarro', ['viewer', 'auditor']),
  makeUser(5, 'integration', '', '', ['service']),
  makeUser(6, 'mlopez', 'Marta', 'López', []),
]

const usersCountByRole = Object.fromEntries(
  roles.map((role) => [role.id, users.filter((u) => u.role_names.includes(role.name)).length]),
)

const selectedRoleId = ref<number | null>(null)
const selectedRole = computed(() => roles.find((r) => r.id === selectedRoleId.value) ?? null)
const search = ref('')

const roleFormOpen = ref(false)
const roleBeingEdited = ref<Role | null>(null)
function openRoleForm(role: Role | null) {
  roleBeingEdited.value = role
  roleFormOpen.value = true
}

const roleDeleteOpen = ref(false)
const roleToDelete = ref<Role | null>(null)
const deleting = ref(false)
function openRoleDelete(role: Role) {
  roleToDelete.value = role
  roleDeleteOpen.value = true
}
function fakeDelete() {
  deleting.value = true
  setTimeout(() => {
    deleting.value = false
    roleDeleteOpen.value = false
  }, 1200)
}

const userDialogOpen = ref(false)
const userToEdit = ref<UserRow | null>(null)
function openUser(user: UserRow) {
  userToEdit.value = user
  userDialogOpen.value = true
}
</script>

<style scoped>
.catalog-section__lead {
  margin: 0;
  color: var(--color-text-muted);
}

.roles-frame {
  width: 320px;
}
</style>
