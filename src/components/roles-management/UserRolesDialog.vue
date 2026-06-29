<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card rounded="lg">
      <v-card-title class="dialog-title pt-5 px-6">
        <v-icon color="var(--primary)" class="mr-2" size="20">
          mdi-account-edit-outline
        </v-icon>
        {{ $t('rolesManagement.editRole') }}
      </v-card-title>

      <v-card-text class="px-6 pt-3 pb-2">
        <div class="user-info-pill mb-4">
          <v-icon size="15" color="var(--subtitle)">
            mdi-account-outline
          </v-icon>
          <span class="text-body-2 font-weight-medium ml-1">
            {{ user?.username }}
          </span>
          <span v-if="user?.email" class="text-body-2 text-disabled ml-2">
            {{ user.email }}
          </span>
        </div>

        <v-select
          v-model="selectedNames"
          :items="roleItems"
          :label="$t('rolesManagement.colRoles')"
          item-title="text"
          item-value="value"
          variant="outlined"
          density="comfortable"
          multiple
          chips
          closable-chips
          :placeholder="$t('rolesManagement.noRoles2')"
        />
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
          :text="$t('rolesManagement.save')"
          icon="mdi-content-save-outline"
          variant="filled"
          color="primary"
          size="small"
          :disabled="saving"
          @click="onSave"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import type { Role, UserRow } from '@cornflow-ui/core/composables/roles-management/types'

interface Props {
  modelValue: boolean
  user: UserRow | null
  roles: Role[]
  saving?: boolean
}

const props = withDefaults(defineProps<Props>(), { saving: false })

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: { user: UserRow; roleNames: string[] }): void
}>()

const selectedNames = ref<string[]>([])

// Seed the v-select each time the dialog opens for a (possibly different) user.
watch(
  () => [props.modelValue, props.user?.id] as const,
  ([open]) => {
    if (open && props.user) {
      selectedNames.value = [...props.user.role_names]
    }
  },
  { immediate: true },
)

const roleItems = computed(() =>
  props.roles.map((r) => ({ value: r.name, text: r.name })),
)

function onSave() {
  if (!props.user) return
  emit('save', { user: props.user, roleNames: selectedNames.value })
}
</script>

<style scoped>
.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--title);
  display: flex;
  align-items: center;
}

.user-info-pill {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 8px 12px;
  min-width: 0;
  overflow: hidden;
}

.user-info-pill .font-weight-medium {
  white-space: nowrap;
  flex-shrink: 0;
}

.user-info-pill .text-disabled {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 1;
}
</style>
