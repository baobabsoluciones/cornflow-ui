<template>
  <v-card class="users-col" :elevation="1" rounded="lg">
    <div class="panel-header">
      <div class="panel-header__left">
        <v-icon size="18" color="var(--primary)">
          mdi-account-group-outline
        </v-icon>
        <span class="section-subtitle">
          {{ $t('rolesManagement.usersTitle') }}
        </span>
        <v-chip size="x-small" color="var(--primary)" variant="tonal">
          <template v-if="selectedRole">
            {{ filteredUsers.length }} / {{ users.length }}
          </template>
          <template v-else>{{ users.length }}</template>
        </v-chip>
      </div>
    </div>

    <div class="search-bar">
      <CoreSearchInput
        :model-value="search"
        :placeholder="$t('rolesManagement.searchUsers')"
        class="search-bar__input"
        @update:model-value="$emit('update:search', $event)"
        @search="$emit('update:search', $event)"
      />
      <v-chip
        v-if="selectedRole"
        class="search-bar__filter-chip"
        color="var(--primary)"
        variant="tonal"
        size="small"
        closable
        @click:close="$emit('clear-filter')"
      >
        <v-icon size="14" class="mr-1">mdi-filter-variant</v-icon>
        {{ $t('rolesManagement.filteringByRole') }} · {{ selectedRole.name }}
      </v-chip>
    </div>

    <div class="table-wrapper users-table-wrapper">
      <v-data-table-virtual
        :headers="headers"
        :items="filteredUsers"
        :loading="loading"
        :height="virtualHeight"
        :item-height="ROW_HEIGHT"
        item-value="id"
        density="comfortable"
        fixed-header
        hover
      >
        <template #item.username="{ item }">
          <div class="user-cell">
            <div
              class="user-avatar"
              :style="{ background: avatar.colorFor(item) }"
            >
              {{ avatar.initialsFor(item) }}
            </div>
            <div class="user-info">
              <div class="user-name">{{ item.full_name }}</div>
              <div class="user-handle">@{{ item.username }}</div>
            </div>
          </div>
        </template>

        <template #item.role_names="{ item }">
          <div class="roles-cell">
            <template v-if="item.role_names.length">
              <v-chip
                v-for="name in item.role_names"
                :key="name"
                size="small"
                variant="tonal"
                :color="roleMeta.colorForName(name)"
                class="mr-1 role-chip"
              >
                <span class="role-chip__dot" />
                {{ name }}
              </v-chip>
            </template>
            <span v-else class="text-disabled text-body-2">
              {{ $t('rolesManagement.noRoles2') }}
            </span>
          </div>
        </template>

        <template #item.actions="{ item }">
          <v-btn
            icon
            size="x-small"
            variant="text"
            @click="$emit('edit', item)"
          >
            <v-icon size="16" color="var(--primary)">
              mdi-pencil-outline
            </v-icon>
          </v-btn>
        </template>

        <template #no-data>
          <div class="empty-state">
            <v-icon size="32" color="var(--subtitle)" class="mb-2">
              mdi-account-off-outline
            </v-icon>
            <p class="text-body-2 text-medium-emphasis">
              {{ $t('rolesManagement.errorLoadUsers') }}
            </p>
          </div>
        </template>

        <template #loading>
          <v-skeleton-loader type="table-row@5" />
        </template>
      </v-data-table-virtual>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreSearchInput from '@/components/core/table/CoreSearchInput.vue'
import { useRoleMeta } from '@/composables/roles-management/useRoleMeta'
import { useUserAvatar } from '@/composables/roles-management/useUserAvatar'
import type { Role, UserRow } from '@/composables/roles-management/types'

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

const ROW_HEIGHT = 68
const virtualHeight = ref(520)

function updateVirtualHeight() {
  if (globalThis.window === undefined) return
  virtualHeight.value = Math.max(
    280,
    Math.min(Math.round(globalThis.window.innerHeight - 300), 760),
  )
}

onMounted(() => {
  updateVirtualHeight()
  window.addEventListener('resize', updateVirtualHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateVirtualHeight)
})

const headers = computed(() => [
  {
    title: t('rolesManagement.colUsername'),
    key: 'username',
    sortable: true,
    width: 280,
  },
  {
    title: t('rolesManagement.colEmail'),
    key: 'email',
    sortable: true,
    minWidth: 200,
  },
  {
    title: t('rolesManagement.colRoles'),
    key: 'role_names',
    sortable: false,
    width: 200,
  },
  {
    title: '',
    key: 'actions',
    sortable: false,
    align: 'end' as const,
    width: 52,
  },
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
</script>

<style scoped>
.users-col {
  flex: 1;
  min-width: 0;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;
}

.search-bar__input {
  flex: 1;
  min-width: 220px;
}

.search-bar__filter-chip {
  font-weight: 500;
}

.table-wrapper {
  padding: 8px 12px 4px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  min-width: 0;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #5b6bb5;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.user-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--title);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-handle {
  font-size: 0.75rem;
  color: var(--subtitle);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.roles-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0;
}

.role-chip {
  font-weight: 500;
}

.role-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  margin-right: 6px;
  display: inline-block;
}

.users-table-wrapper :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.users-table-wrapper :deep(.v-table__wrapper) {
  border-radius: 0 0 8px 8px;
}

.users-table-wrapper :deep(tbody td) {
  padding-top: 14px;
  padding-bottom: 14px;
  height: auto;
}

.users-table-wrapper :deep(tbody tr) {
  height: 68px;
}

.users-table-wrapper :deep(thead th) {
  padding-top: 12px;
  padding-bottom: 12px;
}
</style>
<style scoped src="@/assets/styles/roles-management/panel-shared.css"></style>
