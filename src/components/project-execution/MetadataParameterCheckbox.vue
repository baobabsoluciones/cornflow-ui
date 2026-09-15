<template>
  <v-checkbox
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :label="label"
    :disabled="disabled"
    density="compact"
    hide-details
    color="primary"
    class="metadata-param-checkbox"
  >
    <template #label>
      <span class="metadata-param-checkbox__label">
        <v-icon v-if="isFromDb" size="14" class="mr-1">mdi-database</v-icon>
        <v-icon v-else size="14" class="mr-1">mdi-lock</v-icon>
        {{ label }}
      </span>
    </template>
  </v-checkbox>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: boolean | null
  parameterKey: string
  parameterName?: string
  isFromDb: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  parameterName: '',
  disabled: false,
})

defineEmits<(e: 'update:modelValue', value: boolean | null) => void>()

const label = computed(() => {
  const name = props.parameterName || props.parameterKey
  if (props.disabled) {
    return `${name} — ${t('externalEtl.parameter.cannotBeFromDb')}`
  }
  return props.modelValue
    ? `${name} — ${t('externalEtl.parameter.fixed')}`
    : `${name} — ${t('externalEtl.parameter.fromDb')}`
})
</script>

<style scoped>
.metadata-param-checkbox {
  margin: 0;
}

.metadata-param-checkbox__label {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--subtitle);
}
</style>
