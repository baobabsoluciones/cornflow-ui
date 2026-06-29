<template>
  <div class="metadata-switch" :class="`metadata-switch--${variant}`">
    <div class="metadata-switch__info">
      <v-icon size="16" class="metadata-switch__icon">{{ icon }}</v-icon>
      <span class="metadata-switch__label">{{ label }}</span>
    </div>
    <v-switch
      v-if="variant !== 'reuploaded'"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      density="compact"
      hide-details
      color="primary"
      class="metadata-switch__toggle"
    />
    <v-btn-toggle
      v-else
      :model-value="triStateValue"
      @update:model-value="handleTriState"
      density="compact"
      variant="outlined"
      divided
      class="metadata-switch__tri-toggle"
    >
      <v-btn size="x-small" :value="null">
        {{ t('externalEtl.switch.default') }}
      </v-btn>
      <v-btn size="x-small" :value="false">
        {{ t('externalEtl.switch.fromDb') }}
      </v-btn>
      <v-btn size="x-small" :value="true">
        {{ t('externalEtl.switch.fixed') }}
      </v-btn>
    </v-btn-toggle>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TableSwitchVariant } from '@/types/etlFlow'

const { t } = useI18n()

interface Props {
  variant: TableSwitchVariant
  modelValue: boolean | null
  tableName: string
}

const props = defineProps<Props>()
const emit = defineEmits<
  (e: 'update:modelValue', value: boolean | null) => void
>()

const icon = computed(() => {
  switch (props.variant) {
    case 'from_db':
      return 'mdi-database'
    case 'from_excel':
      return 'mdi-file-excel'
    case 'edited_from_db':
      return 'mdi-database-edit'
    case 'reuploaded':
      return 'mdi-file-replace'
    default:
      return 'mdi-table'
  }
})

const label = computed(() => {
  switch (props.variant) {
    case 'from_db':
      return t('externalEtl.switch.fromDbLabel')
    case 'from_excel':
      return t('externalEtl.switch.fromExcelLabel')
    case 'edited_from_db':
      return t('externalEtl.switch.editedFromDbLabel')
    case 'reuploaded':
      return t('externalEtl.switch.reuploadedLabel')
    default:
      return ''
  }
})

const triStateValue = computed(() => props.modelValue)

function handleTriState(value: boolean | null) {
  emit('update:modelValue', value)
}
</script>

<style scoped>
.metadata-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.metadata-switch--from_db {
  background: #e3f2fd;
}

.metadata-switch--from_excel {
  background: #e8f5e9;
}

.metadata-switch--edited_from_db {
  background: #fff3e0;
}

.metadata-switch--reuploaded {
  background: #f3e5f5;
}

.metadata-switch__info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.metadata-switch__icon {
  flex-shrink: 0;
  color: var(--subtitle);
}

.metadata-switch__label {
  color: var(--subtitle);
  line-height: 1.3;
}

.metadata-switch__toggle {
  flex-shrink: 0;
  margin-left: 12px;
}

.metadata-switch__tri-toggle {
  flex-shrink: 0;
  margin-left: 12px;
}
</style>
