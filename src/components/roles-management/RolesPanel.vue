<!--
  RolesPanel: the roles of the app, to filter the users by one.

  - "All users" first, then a row per role with its icon, description and number of users.
  - The selected role shows its permissions under the list. With `allowEdit`, its row offers edit
    and delete instead of the count, and the foot of the panel "Add role".

  <RolesPanel :roles="roles" :selected-role-id="1" :selected-role="roles[0]"
    :users-count-by-role="{ 1: 3 }" :total-users="8" allow-edit @select="select" />
-->
<template>
  <section class="panel roles-panel" :aria-label="$t('rolesManagement.rolesTitle')">
    <header class="panel-header">
      <CoreIcon name="mdi-shield-key-outline" :size="18" class="panel-header__icon" />
      <h2 class="panel-header__title">{{ $t('rolesManagement.rolesTitle') }}</h2>
      <CoreBadge :label="String(roles.length)" tone="primary" size="sm" />
    </header>

    <div
      class="roles-list"
      :class="{ 'is-loading': loading }"
      :aria-busy="loading || undefined"
    >
      <div
        class="role-item role-item--all"
        :class="{ 'role-item--active': selectedRoleId === null }"
      >
        <button
          type="button"
          class="role-item__main"
          :aria-pressed="selectedRoleId === null"
          @click="$emit('select', null)"
        >
          <span class="role-item__icon is-neutral">
            <CoreIcon name="mdi-account-multiple-outline" :size="18" />
          </span>
          <span class="role-item__body">
            <span class="role-item__title">{{ $t('rolesManagement.allUsers') }}</span>
            <span class="role-item__subtitle">
              {{ $t('rolesManagement.allUsersSubtitle') }}
            </span>
          </span>
          <CoreBadge :label="String(totalUsers)" size="sm" class="role-item__count" />
        </button>
      </div>

      <div
        v-for="role in roles"
        :key="role.id"
        class="role-item"
        :class="{ 'role-item--active': selectedRoleId === role.id }"
      >
        <button
          type="button"
          class="role-item__main"
          :aria-pressed="selectedRoleId === role.id"
          @click="$emit('select', role.id)"
        >
          <span class="role-item__icon" :class="`is-${roleMeta.toneFor(role)}`">
            <CoreIcon :name="roleMeta.iconFor(role)" :size="18" />
          </span>
          <span class="role-item__body">
            <span class="role-item__title">{{ role.name }}</span>
            <span class="role-item__subtitle">{{ roleMeta.descriptionFor(role) }}</span>
          </span>
          <CoreBadge
            v-if="!isEditable(role)"
            :label="String(usersCountByRole[role.id] ?? 0)"
            size="sm"
            class="role-item__count"
          />
        </button>
        <div v-if="isEditable(role)" class="role-item__actions">
          <CoreButton
            variant="icon"
            size="small"
            icon="mdi-pencil-outline"
            :aria-label="$t('rolesManagement.editRole')"
            :title="$t('rolesManagement.editRole')"
            @click="$emit('edit', role)"
          />
          <CoreButton
            variant="icon"
            size="small"
            color="danger"
            icon="mdi-delete-outline"
            :aria-label="$t('rolesManagement.delete')"
            :title="$t('rolesManagement.delete')"
            @click="$emit('delete', role)"
          />
        </div>
      </div>

      <template v-if="loading && roles.length === 0">
        <div v-for="n in 3" :key="n" class="role-skeleton">
          <CoreSkeleton :width="36" :height="36" shape="block" />
          <span class="role-skeleton__text">
            <CoreSkeleton width="45%" :height="12" />
            <CoreSkeleton width="75%" :height="10" />
          </span>
        </div>
      </template>

      <CoreEmptyState
        v-if="!loading && roles.length === 0"
        class="empty-state"
        icon="mdi-shield-off-outline"
        :title="$t('rolesManagement.noRoles')"
      />
    </div>

    <div v-if="selectedRole" class="role-permissions">
      <h3 class="role-permissions__title">
        <CoreIcon name="mdi-key-variant" :size="14" />
        {{ $t('rolesManagement.rolePermissionsTitle') }}
      </h3>
      <ul class="role-permissions__list">
        <li
          v-for="(perm, i) in selectedRolePermissions"
          :key="i"
          class="role-permissions__item"
        >
          <CoreIcon name="mdi-check-circle" :size="14" class="role-permissions__check" />
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

    <div v-if="allowEdit" class="roles-add">
      <CoreButton
        :text="$t('rolesManagement.addRole')"
        icon="mdi-plus"
        variant="outlined"
        size="small"
        block
        @click="$emit('create')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSkeleton from '@cornflow-ui/core/components/core/CoreSkeleton.vue'
import { useRoleMeta } from '@cornflow-ui/core/composables/roles-management/useRoleMeta'
import type { Role } from '@cornflow-ui/core/composables/roles-management/types'

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

/** The selected role's row offers edit and delete when the app allows editing roles. */
function isEditable(role: Role): boolean {
  return props.allowEdit && props.selectedRoleId === role.id
}

const selectedRolePermissions = computed<string[]>(() =>
  props.selectedRole ? roleMeta.permissionsFor(props.selectedRole) : [],
)
</script>

<style scoped>
.roles-list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 0.5);
  min-height: 80px;
  padding: calc(var(--spacing) * 2);
}

.roles-list.is-loading {
  opacity: 0.7;
}

.role-item {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: var(--radius-md);
  transition: background-color var(--duration-base) var(--ease-standard);
}

.role-item:hover {
  background: var(--color-surface-hover);
}

.role-item--active,
.role-item--active:hover {
  background: var(--color-primary-subtle);
}

.role-item--active::before {
  content: '';
  position: absolute;
  top: calc(var(--spacing) * 2);
  bottom: calc(var(--spacing) * 2);
  left: 0;
  width: 3px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--color-primary);
}

.role-item__main {
  display: flex;
  flex: 1;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  min-width: 0;
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
  border: 0;
  border-radius: inherit;
  background: none;
  font: inherit;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.role-item__main:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.role-item__icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
}

.role-item__icon.is-neutral {
  background: var(--color-neutral-soft);
  color: var(--color-neutral-strong);
}

.role-item__icon.is-primary {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.role-item__icon.is-info {
  background: var(--color-info-soft);
  color: var(--color-info-strong);
}

.role-item__icon.is-success {
  background: var(--color-success-soft);
  color: var(--color-success-strong);
}

.role-item__icon.is-warning {
  background: var(--color-warning-soft);
  color: var(--color-warning-strong);
}

.role-item__icon.is-danger {
  background: var(--color-danger-soft);
  color: var(--color-danger-strong);
}

.role-item--active .role-item__icon.is-primary {
  background: var(--color-surface);
}

.role-item__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: calc(var(--spacing) * 0.5);
  min-width: 0;
}

.role-item__title,
.role-item__subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-item__title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.role-item--active .role-item__title {
  color: var(--color-primary);
}

.role-item__subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.role-item__count {
  flex: none;
  justify-content: center;
  min-width: 28px;
}

.role-item__actions {
  display: flex;
  flex: none;
  gap: calc(var(--spacing) * 0.5);
  padding-right: calc(var(--spacing) * 2);
}

.role-skeleton {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
}

.role-skeleton__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
}

.empty-state {
  padding-block: calc(var(--spacing) * 8);
}

.role-permissions {
  margin: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 3.5);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.role-permissions__title {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  margin: 0 0 calc(var(--spacing) * 2);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.role-permissions__list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.role-permissions__item {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  font-size: var(--text-md);
  color: var(--color-text);
}

.role-permissions__check {
  color: var(--color-success);
}

.role-permissions__empty {
  font-size: var(--text-sm);
  font-style: italic;
  color: var(--color-text-muted);
}

.roles-add {
  margin-top: auto;
  padding: calc(var(--spacing) * 3);
  border-top: 1px solid var(--color-divider);
}
</style>
<style scoped src="@cornflow-ui/core/assets/styles/roles-management/panel-shared.css"></style>
