<!--
  UsersPanel: the users of the app with their roles, to search and to edit.

  - The header counts the users, or the ones of the selected role out of all of them.
  - The search looks in the user name, the full name, the e-mail and the roles; the role selected
    in the RolesPanel shows as a filter that can be cleared.
  - The table sorts by user or e-mail from its headers and scrolls inside past the window height.
    While loading with no users yet it shows placeholder rows.

  <UsersPanel :users="users" :selected-role="role" v-model:search="search"
    @clear-filter="clearRole" @edit="openUser" />
-->
<template>
  <section class="panel users-panel" :aria-label="$t('rolesManagement.usersTitle')">
    <header class="panel-header">
      <CoreIcon name="mdi-account-group-outline" :size="18" class="panel-header__icon" />
      <h2 class="panel-header__title">{{ $t('rolesManagement.usersTitle') }}</h2>
      <CoreBadge :label="countLabel" tone="primary" size="sm" class="users-count" />
    </header>

    <div class="users-toolbar">
      <CoreSearchInput
        :model-value="search"
        :placeholder="$t('rolesManagement.searchUsers')"
        class="users-toolbar__search"
        @update:model-value="$emit('update:search', $event)"
        @search="$emit('update:search', $event)"
      />
      <span v-if="selectedRole" class="role-filter">
        <CoreIcon name="mdi-filter-variant" :size="14" />
        {{ $t('rolesManagement.filteringByRole') }} · {{ selectedRole.name }}
        <button
          type="button"
          class="role-filter__clear"
          :aria-label="$t('common.clear')"
          :title="$t('common.clear')"
          @click="$emit('clear-filter')"
        >
          <CoreIcon name="mdi-close" :size="14" />
        </button>
      </span>
    </div>

    <div class="users-table" :class="{ 'is-loading': loading }" :aria-busy="loading || undefined">
      <table class="users-table__table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              :class="`users-table__col--${column.key}`"
              :aria-sort="ariaSort(column.key)"
            >
              <button
                v-if="column.sortable"
                type="button"
                class="users-table__sort"
                :class="{ 'is-sorted': sort?.key === column.key }"
                @click="toggleSort(column.key as SortKey)"
              >
                {{ column.title }}
                <CoreIcon :name="sortIcon(column.key)" :size="14" class="users-table__sort-icon" />
              </button>
              <template v-else>{{ column.title }}</template>
            </th>
          </tr>
        </thead>

        <tbody v-if="loading && filteredUsers.length === 0">
          <tr v-for="n in 5" :key="n" class="users-table__skeleton">
            <td>
              <div class="user-cell">
                <CoreSkeleton :width="36" :height="36" shape="circle" />
                <CoreSkeleton width="60%" :height="12" />
              </div>
            </td>
            <td><CoreSkeleton width="70%" :height="12" /></td>
            <td><CoreSkeleton :width="64" :height="18" shape="pill" /></td>
            <td />
          </tr>
        </tbody>

        <tbody v-else>
          <tr v-for="user in sortedUsers" :key="user.id" class="users-table__row">
            <td>
              <div class="user-cell">
                <span class="user-avatar" :class="`is-${avatar.toneFor(user)}`" aria-hidden="true">
                  {{ avatar.initialsFor(user) }}
                </span>
                <span class="user-info">
                  <span class="user-name">{{ user.full_name }}</span>
                  <span class="user-handle">@{{ user.username }}</span>
                </span>
              </div>
            </td>
            <td class="users-table__email">{{ user.email }}</td>
            <td>
              <div class="roles-cell">
                <template v-if="user.role_names.length">
                  <CoreBadge
                    v-for="name in user.role_names"
                    :key="name"
                    :label="name"
                    :tone="roleMeta.toneForName(name)"
                    size="sm"
                    class="role-chip"
                  />
                </template>
                <span v-else class="roles-cell__none">
                  {{ $t('rolesManagement.noRoles2') }}
                </span>
              </div>
            </td>
            <td class="users-table__actions">
              <CoreButton
                variant="icon"
                size="small"
                icon="mdi-pencil-outline"
                class="users-table__edit"
                :aria-label="$t('rolesManagement.editUser')"
                :title="$t('rolesManagement.editUser')"
                @click="$emit('edit', user)"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <CoreEmptyState
        v-if="!loading && filteredUsers.length === 0"
        class="empty-state"
        icon="mdi-account-off-outline"
        :title="
          users.length ? $t('rolesManagement.noUsersMatch') : $t('rolesManagement.errorLoadUsers')
        "
        data-testid="users-empty"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSkeleton from '@cornflow-ui/core/components/core/CoreSkeleton.vue'
import CoreSearchInput from '@cornflow-ui/core/components/core/table/CoreSearchInput.vue'
import { useRoleMeta } from '@cornflow-ui/core/composables/roles-management/useRoleMeta'
import { useUserAvatar } from '@cornflow-ui/core/composables/roles-management/useUserAvatar'
import type { Role, UserRow } from '@cornflow-ui/core/composables/roles-management/types'

interface Props {
  users: UserRow[]
  selectedRole: Role | null
  search: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'clear-filter'): void
  (e: 'edit', user: UserRow): void
}>()

const { t } = useI18n()
const roleMeta = useRoleMeta()
const avatar = useUserAvatar()

type SortKey = 'username' | 'email'

const columns = computed(() => [
  { key: 'username', title: t('rolesManagement.colUsername'), sortable: true },
  { key: 'email', title: t('rolesManagement.colEmail'), sortable: true },
  { key: 'role_names', title: t('rolesManagement.colRoles'), sortable: false },
  { key: 'actions', title: '', sortable: false },
])

const filteredUsers = computed(() => {
  const q = props.search?.toLowerCase().trim()
  const selectedName = props.selectedRole?.name
  return props.users.filter((u) => {
    if (selectedName && !u.role_names.includes(selectedName)) return false
    if (!q) return true
    return (
      u.username.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role_names.some((rn) => rn.toLowerCase().includes(q))
    )
  })
})

const countLabel = computed(() =>
  props.selectedRole
    ? `${filteredUsers.value.length} / ${props.users.length}`
    : String(props.users.length),
)

// ── Sorting: a header click sorts ascending, then descending, then not at all ──
const sort = ref<{ key: SortKey; order: 'asc' | 'desc' } | null>(null)

function toggleSort(key: SortKey) {
  if (sort.value?.key !== key) sort.value = { key, order: 'asc' }
  else if (sort.value.order === 'asc') sort.value = { key, order: 'desc' }
  else sort.value = null
}

function ariaSort(key: string): 'ascending' | 'descending' | undefined {
  if (sort.value?.key !== key) return undefined
  return sort.value.order === 'asc' ? 'ascending' : 'descending'
}

function sortIcon(key: string): string {
  if (sort.value?.key !== key) return 'mdi-swap-vertical'
  return sort.value.order === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'
}

const sortedUsers = computed(() => {
  const current = sort.value
  if (!current) return filteredUsers.value
  const direction = current.order === 'asc' ? 1 : -1
  return [...filteredUsers.value].sort(
    (a, b) =>
      direction *
      (a[current.key] ?? '').localeCompare(b[current.key] ?? '', undefined, {
        sensitivity: 'base',
      }),
  )
})
</script>

<style scoped>
.users-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 4);
  border-bottom: 1px solid var(--color-divider);
}

.users-toolbar__search {
  flex: 1;
  min-width: 220px;
}

.role-filter {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 1) calc(var(--spacing) * 1) calc(var(--spacing) * 1)
    calc(var(--spacing) * 2.5);
  border-radius: var(--radius-full);
  background: var(--color-primary-subtle);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.role-filter__clear {
  display: inline-flex;
  padding: calc(var(--spacing) * 0.5);
  border: 0;
  border-radius: var(--radius-full);
  background: none;
  color: var(--color-primary);
  cursor: pointer;
}

.role-filter__clear:hover {
  background: var(--color-surface);
}

.role-filter__clear:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

/* Scrolls inside once the users pass the height the window leaves under the title. */
.users-table {
  max-height: clamp(280px, calc(100vh - 300px), 760px);
  padding: 0 calc(var(--spacing) * 3) calc(var(--spacing) * 1);
  overflow: auto;
}

.users-table.is-loading .users-table__row {
  opacity: 0.7;
}

.users-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-md);
}

.users-table__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: calc(var(--spacing) * 3);
  border-bottom: 1px solid var(--color-divider);
  background: var(--color-surface);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  text-align: left;
  white-space: nowrap;
  color: var(--color-text-muted);
}

.users-table__col--username {
  width: 280px;
}

.users-table__col--email {
  min-width: 200px;
}

.users-table__col--role_names {
  width: 200px;
}

.users-table__col--actions {
  width: 52px;
}

.users-table__sort {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
}

.users-table__sort:hover,
.users-table__sort.is-sorted {
  color: var(--color-text);
}

.users-table__sort:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.users-table__sort-icon {
  color: var(--color-text-subtle);
}

.users-table__sort.is-sorted .users-table__sort-icon {
  color: var(--color-primary);
}

.users-table__table td {
  padding: calc(var(--spacing) * 3);
  border-bottom: 1px solid var(--color-divider);
  vertical-align: middle;
  color: var(--color-text);
}

.users-table__table tbody tr:last-child td {
  border-bottom: 0;
}

.users-table__row {
  transition: background-color var(--duration-base) var(--ease-standard);
}

.users-table__row:hover {
  background: var(--color-surface-hover);
}

.users-table__email {
  color: var(--color-text-muted);
  word-break: break-all;
}

.users-table__actions {
  text-align: right;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  min-width: 0;
}

.user-avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.02em;
}

.user-avatar.is-primary {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.user-avatar.is-info {
  background: var(--color-info-soft);
  color: var(--color-info-strong);
}

.user-avatar.is-success {
  background: var(--color-success-soft);
  color: var(--color-success-strong);
}

.user-avatar.is-warning {
  background: var(--color-warning-soft);
  color: var(--color-warning-strong);
}

.user-avatar.is-danger {
  background: var(--color-danger-soft);
  color: var(--color-danger-strong);
}

.user-avatar.is-neutral {
  background: var(--color-neutral-soft);
  color: var(--color-neutral-strong);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 0.5);
  min-width: 0;
}

.user-name,
.user-handle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-name {
  font-weight: var(--font-weight-medium);
}

.user-handle {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.roles-cell {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 1);
}

.roles-cell__none {
  color: var(--color-text-subtle);
}

.empty-state {
  padding-block: calc(var(--spacing) * 8);
}
</style>
<style scoped src="@cornflow-ui/core/assets/styles/roles-management/panel-shared.css"></style>
