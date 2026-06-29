<template>
  <v-dialog
    :model-value="modelValue"
    max-width="420"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card rounded="lg">
      <v-card-title class="dialog-title pt-5 px-6">
        <v-icon color="var(--danger)" class="mr-2" size="20">
          mdi-delete-alert-outline
        </v-icon>
        {{ $t('rolesManagement.deleteRoleTitle') }}
      </v-card-title>

      <v-card-text class="px-6 pt-3 pb-2 text-body-2">
        {{ $t('rolesManagement.deleteRoleMessage', { name: role?.name }) }}
      </v-card-text>

      <v-card-actions class="px-6 pb-5 pt-0 d-flex justify-end ga-2">
        <CoreButton
          :text="$t('rolesManagement.cancel')"
          variant="outlined"
          color="primary"
          size="small"
          @click="$emit('update:modelValue', false)"
        />
        <CoreButton
          :text="$t('rolesManagement.delete')"
          icon="mdi-delete-outline"
          variant="filled"
          color="danger"
          size="small"
          :disabled="deleting"
          @click="$emit('confirm')"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import CoreButton from '@/components/core/CoreButton.vue'
import type { Role } from '@/composables/roles-management/types'

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

<style scoped>
.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--title);
  display: flex;
  align-items: center;
}
</style>
