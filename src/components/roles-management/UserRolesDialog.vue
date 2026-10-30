<!--
  UserRolesDialog: edits a user's name, e-mail and roles.

  The e-mail may be left empty; otherwise it has to look like one before saving. The roles are a
  checkbox per role of the app. `save` gives the user, the trimmed profile and the role names.

  <UserRolesDialog v-model="open" :user="user" :roles="roles" :saving="saving" @save="saveUser" />
-->
<template>
  <CoreDialog
    :model-value="modelValue"
    :title="$t('rolesManagement.editUser')"
    icon="mdi-account-edit-outline"
    :width="560"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="user-roles">
      <div class="user-info-pill">
        <CoreIcon name="mdi-account-outline" :size="16" />
        <span class="user-info-pill__name">{{ user?.username }}</span>
      </div>

      <div class="user-roles__names">
        <label class="user-roles__label">
          {{ $t('rolesManagement.firstName') }}
          <CoreTextField v-model="firstName" autocomplete="off" />
        </label>
        <label class="user-roles__label">
          {{ $t('rolesManagement.lastName') }}
          <CoreTextField v-model="lastName" autocomplete="off" />
        </label>
      </div>

      <label class="user-roles__label">
        {{ $t('rolesManagement.colEmail') }}
        <CoreTextField
          v-model="email"
          type="email"
          autocomplete="off"
          :invalid="!isEmailValid"
          :aria-describedby="isEmailValid ? undefined : emailErrorId"
        />
      </label>
      <p v-if="!isEmailValid" :id="emailErrorId" class="user-roles__error">
        {{ $t('rolesManagement.invalidEmail') }}
      </p>

      <fieldset class="user-roles__roles">
        <legend class="user-roles__label">{{ $t('rolesManagement.colRoles') }}</legend>
        <CoreCheckbox
          v-for="option in roleOptions"
          :key="option.value"
          :model-value="selectedNames.includes(option.value)"
          :label="option.label"
          @update:model-value="toggleRole(option.value, $event)"
        />
        <span v-if="roleOptions.length === 0" class="user-roles__none">
          {{ $t('rolesManagement.noRoles') }}
        </span>
      </fieldset>
    </div>

    <template #actions>
      <CoreButton
        :text="$t('rolesManagement.cancel')"
        variant="outlined"
        size="small"
        @click="$emit('update:modelValue', false)"
      />
      <CoreButton
        :text="$t('rolesManagement.save')"
        icon="mdi-content-save-outline"
        size="small"
        :loading="saving"
        :disabled="!isEmailValid"
        @click="onSave"
      />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreCheckbox from '@cornflow-ui/core/components/core/CoreCheckbox.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import type {
  Role,
  UserRow,
  UserProfileValue,
} from '@cornflow-ui/core/composables/roles-management/types'

interface Props {
  modelValue: boolean
  user: UserRow | null
  roles: Role[]
  saving?: boolean
}

const props = withDefaults(defineProps<Props>(), { saving: false })

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (
    e: 'save',
    payload: {
      user: UserRow
      profile: UserProfileValue
      roleNames: string[]
    },
  ): void
}>()

const selectedNames = ref<string[]>([])
const firstName = ref('')
const lastName = ref('')
const email = ref('')
const emailErrorId = useId()

// Bounded quantifiers (local part max 64, domain parts max 63) to avoid ReDoS
// super-linear backtracking (SonarQube S5852).
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,63}\.[^\s@]{1,63}$/
const isEmailValid = computed(
  () => email.value.trim() === '' || EMAIL_RE.test(email.value.trim()),
)

// Seed the form each time the dialog opens for a (possibly different) user.
watch(
  () => [props.modelValue, props.user?.id] as const,
  ([open]) => {
    if (open && props.user) {
      selectedNames.value = [...props.user.role_names]
      firstName.value = props.user.first_name
      lastName.value = props.user.last_name
      email.value = props.user.email
    }
  },
  { immediate: true },
)

const roleOptions = computed(() =>
  props.roles.map((r) => ({ value: r.name, label: r.name })),
)

function toggleRole(name: string, checked: boolean) {
  selectedNames.value = checked
    ? [...selectedNames.value, name]
    : selectedNames.value.filter((n) => n !== name)
}

function onSave() {
  if (!props.user || !isEmailValid.value) return
  emit('save', {
    user: props.user,
    profile: {
      first_name: firstName.value.trim(),
      last_name: lastName.value.trim(),
      email: email.value.trim(),
    },
    roleNames: selectedNames.value,
  })
}
</script>

<style scoped>
.user-roles {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
}

.user-info-pill {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.user-info-pill__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.user-roles__names {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(var(--spacing) * 3);
}

.user-roles__label {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.user-roles__error {
  margin: calc(var(--spacing) * -1.5) 0 0;
  font-size: var(--text-sm);
  color: var(--color-danger-strong);
}

.user-roles__roles {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
  margin: 0;
  padding: 0;
  border: 0;
}

.user-roles__roles legend {
  margin-bottom: calc(var(--spacing) * 2);
  padding: 0;
}

.user-roles__none {
  font-size: var(--text-md);
  color: var(--color-text-subtle);
}
</style>
