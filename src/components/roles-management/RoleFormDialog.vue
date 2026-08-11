<template>
  <v-dialog
    :model-value="modelValue"
    max-width="420"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card rounded="lg">
      <v-card-title class="dialog-title pt-5 px-6">
        <v-icon color="var(--primary)" class="mr-2" size="20">
          {{ isEdit ? 'mdi-pencil-outline' : 'mdi-plus-circle-outline' }}
        </v-icon>
        {{
          isEdit
            ? $t('rolesManagement.editRole')
            : $t('rolesManagement.addRole')
        }}
      </v-card-title>

      <v-card-text class="px-6 pt-3 pb-2">
        <v-text-field
          v-model="form.name"
          :label="$t('rolesManagement.roleName')"
          variant="outlined"
          density="comfortable"
          autofocus
          :rules="[(v: string) => !!v?.trim() || $t('rolesManagement.roleName')]"
          @keyup.enter="onSave"
        />
      </v-card-text>

      <v-card-actions class="px-6 pb-5 pt-0 d-flex justify-end ga-2">
        <CoreButton
          :text="$t('rolesManagement.cancel')"
          variant="outlined"
          color="primary"
          size="small"
          @click="close"
        />
        <CoreButton
          :text="$t('rolesManagement.save')"
          icon="mdi-content-save-outline"
          variant="filled"
          color="primary"
          size="small"
          :disabled="saving || !form.name?.trim()"
          @click="onSave"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import type { Role, RoleFormValue } from '@cornflow-ui/core/composables/roles-management/types'

interface Props {
  modelValue: boolean
  /** When provided, the dialog opens in edit mode with these values pre-filled. */
  role?: Role | null
  saving?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  role: null,
  saving: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', value: RoleFormValue): void
}>()

const form = ref<RoleFormValue>({ name: '' })
const isEdit = ref(false)

// Reset the form whenever the dialog opens so create/edit transitions are
// clean (otherwise leftover state from the previous open would bleed in).
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    if (props.role) {
      form.value = { id: props.role.id, name: props.role.name }
      isEdit.value = true
    } else {
      form.value = { name: '' }
      isEdit.value = false
    }
  },
  { immediate: true },
)

function close() {
  emit('update:modelValue', false)
}

function onSave() {
  const name = form.value.name?.trim()
  if (!name) return
  emit('save', { ...form.value, name })
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
</style>
