<!--
  RoleDeleteDialog: asks before deleting a role, which also takes it from the users that have it.

  <RoleDeleteDialog v-model="open" :role="roleToDelete" :deleting="deleting" @confirm="deleteRole" />
-->
<template>
  <CoreConfirmDialog
    :model-value="modelValue"
    :title="$t('rolesManagement.deleteRoleTitle')"
    :message="$t('rolesManagement.deleteRoleMessage', { name: role?.name })"
    :confirm-text="$t('rolesManagement.delete')"
    :cancel-text="$t('rolesManagement.cancel')"
    confirm-color="var(--danger)"
    icon="mdi-delete-outline"
    :loading="deleting"
    @update:model-value="$emit('update:modelValue', $event)"
    @confirm="$emit('confirm')"
  />
</template>

<script setup lang="ts">
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'
import type { Role } from '@cornflow-ui/core/composables/roles-management/types'

interface Props {
  modelValue: boolean
  role: Role | null
  deleting?: boolean
}

withDefaults(defineProps<Props>(), { deleting: false })

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
}>()
</script>
