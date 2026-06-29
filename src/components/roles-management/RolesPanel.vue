<template>
  <v-card class="roles-col" :elevation="1" rounded="lg">
    <div class="panel-header">
      <div class="panel-header__left">
        <v-icon size="18" color="var(--primary)">mdi-shield-key-outline</v-icon>
        <span class="section-subtitle">{{ $t('rolesManagement.rolesTitle') }}</span>
        <v-chip size="x-small" color="var(--primary)" variant="tonal">
          {{ roles.length }}
        </v-chip>
      </div>
    </div>

    <div class="roles-list" :class="{ 'is-loading': loading }">
      <!-- All users -->
      <button
        type="button"
        class="role-item role-item--all"
        :class="{ 'role-item--active': selectedRoleId === null }"
        @click="$emit('select', null)"
      >
        <div class="role-item__icon role-item__icon--neutral">
          <v-icon size="18">mdi-account-multiple-outline</v-icon>
        </div>
        <div class="role-item__body">
          <div class="role-item__title">{{ $t('rolesManagement.allUsers') }}</div>
          <div class="role-item__subtitle">
            {{ $t('rolesManagement.allUsersSubtitle') }}
          </div>
        </div>
        <v-chip size="x-small" variant="tonal" class="role-item__count">
          {{ totalUsers }}
        </v-chip>
      </button>

      <!-- Roles -->
      <button
        v-for="role in roles"
        :key="role.id"
        type="button"
        class="role-item"
        :class="{ 'role-item--active': selectedRoleId === role.id }"
        @click="$emit('select', role.id)"
      >
        <div
          class="role-item__icon"
          :class="`role-item__icon--${roleMeta.colorFor(role)}`"
        >
          <v-icon size="18">{{ roleMeta.iconFor(role) }}</v-icon>
        </div>
        <div class="role-item__body">
          <div class="role-item__title">{{ role.name }}</div>
          <div class="role-item__subtitle">{{ roleMeta.descriptionFor(role) }}</div>
        </div>

        <div class="role-item__right">
          <template v-if="selectedRoleId === role.id && allowEdit">
            <v-btn
              icon
              size="x-small"
              variant="text"
              @click.stop="$emit('edit', role)"
            >
              <v-icon size="15" color="var(--primary)">mdi-pencil-outline</v-icon>
            </v-btn>
            <v-btn
              icon
              size="x-small"
              variant="text"
              @click.stop="$emit('delete', role)"
            >
              <v-icon size="15" color="var(--danger)">mdi-delete-outline</v-icon>
            </v-btn>
          </template>
          <v-chip
            v-else
            size="x-small"
            variant="tonal"
            class="role-item__count"
          >
            {{ usersCountByRole[role.id] ?? 0 }}
          </v-chip>
        </div>
      </button>

      <div v-if="!loading && roles.length === 0" class="empty-state">
        <v-icon size="32" color="var(--subtitle)" class="mb-2">
          mdi-shield-off-outline
        </v-icon>
        <p class="text-body-2 text-medium-emphasis">
          {{ $t('rolesManagement.noRoles') }}
        </p>
      </div>
    </div>

    <!-- Permissions panel -->
    <div v-if="selectedRole" class="role-permissions">
      <div class="role-permissions__title">
        <v-icon size="14" class="mr-1">mdi-key-variant</v-icon>
        {{ $t('rolesManagement.rolePermissionsTitle') }}
      </div>
      <ul class="role-permissions__list">
        <li
          v-for="(perm, i) in selectedRolePermissions"
          :key="i"
          class="role-permissions__item"
        >
          <v-icon size="14" color="success">mdi-check-circle</v-icon>
          <span>{{ perm }}</span>
        </li>
        <li
          v-if="selectedRolePermissions.length === 0"
          class="role-permissions__empty"
        >
          {{ $t('rolesManagement.noPermissionsDefined') }}
        </li>
      </ul>
    </div>

    <!-- Add role -->
    <div v-if="allowEdit" class="roles-add">
      <v-btn
        block
        variant="outlined"
        color="var(--primary)"
        prepend-icon="mdi-plus"
        size="small"
        @click="$emit('create')"
      >
        {{ $t('rolesManagement.addRole') }}
      </v-btn>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoleMeta } from '@/composables/roles-management/useRoleMeta'
import type { Role } from '@/composables/roles-management/types'

interface Props {
  roles: Role[]
  selectedRoleId: number | null
  selectedRole: Role | null
  usersCountByRole: Record<number, number>
  totalUsers: number
  loading?: boolean
  allowEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  allowEdit: false,
})

defineEmits<{
  (e: 'select', roleId: number | null): void
  (e: 'create'): void
  (e: 'edit', role: Role): void
  (e: 'delete', role: Role): void
}>()

const roleMeta = useRoleMeta()

const selectedRolePermissions = computed<string[]>(() =>
  props.selectedRole ? roleMeta.permissionsFor(props.selectedRole) : [],
)
</script>

<style scoped>
.roles-col {
  flex: 0 0 340px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
}

.roles-list {
  padding: 8px 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 80px;
}

.roles-list.is-loading {
  opacity: 0.7;
}

.role-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;
  position: relative;
}

.role-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

.role-item--active {
  background: rgba(91, 107, 181, 0.1);
}

.role-item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--primary);
}

.role-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
}

.role-item__icon--neutral {
  background: rgba(0, 0, 0, 0.06);
  color: var(--subtitle);
}

.role-item__icon--primary {
  background: #ebedf6;
  color: #4a5aa5;
}

.role-item__icon--info {
  background: #e8f1f8;
  color: #2f7aad;
}

.role-item__icon--success {
  background: #e6f1ed;
  color: #257558;
}

.role-item__icon--warning {
  background: #f6efe8;
  color: #9a5f2e;
}

.role-item__icon--secondary {
  background: #efeaf6;
  color: #6841a0;
}

.role-item__body {
  flex: 1;
  min-width: 0;
}

.role-item__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--title);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-item__subtitle {
  font-size: 0.75rem;
  color: var(--subtitle);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-item__right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.role-item__count {
  min-width: 28px;
  justify-content: center;
}

.role-permissions {
  margin: 8px 12px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.025);
  border-radius: 10px;
}

.role-permissions__title {
  display: flex;
  align-items: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--subtitle);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.role-permissions__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.role-permissions__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--title);
}

.role-permissions__empty {
  font-size: 0.8rem;
  color: var(--subtitle);
  font-style: italic;
}

.roles-add {
  padding: 12px;
  margin-top: auto;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
</style>
<style scoped src="@/assets/styles/roles-management/panel-shared.css"></style>
