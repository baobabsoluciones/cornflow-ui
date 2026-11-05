<!--
  RoleFormDialog: creates a role, or renames the one it is given.

  The name is required; Enter saves it. `save` gives the trimmed name, with the id when editing.

  <RoleFormDialog v-model="open" :role="roleBeingEdited" :saving="saving" @save="saveRole" />
-->
<template>
  <CoreDialog
    :model-value="modelValue"
    :title="isEdit ? $t('rolesManagement.editRole') : $t('rolesManagement.addRole')"
    :icon="isEdit ? 'mdi-pencil-outline' : 'mdi-plus-circle-outline'"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <label class="role-form__label">
      {{ $t('rolesManagement.roleName') }}
      <CoreTextField
        v-model="form.name"
        autocomplete="off"
        @keyup.enter="onSave"
      />
    </label>

    <template #actions>
      <CoreButton
        :text="$t('rolesManagement.cancel')"
        variant="outlined"
        size="small"
        @click="close"
      />
      <CoreButton
        :text="$t('rolesManagement.save')"
        icon="mdi-content-save-outline"
        size="small"
        :loading="saving"
        :disabled="!form.name?.trim()"
        @click="onSave"
      />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
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
.role-form__label {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}
</style>
