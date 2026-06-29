<template>
  <v-dialog
    :model-value="modelValue"
    max-width="680"
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="core-bulk-edit-modal">
      <!-- Header -->
      <div class="core-bulk-edit-modal__header">
        <div class="core-bulk-edit-modal__header-icon">
          <v-icon icon="mdi-pencil-box-multiple" size="20" color="primary" />
        </div>
        <div class="core-bulk-edit-modal__header-text">
          <span class="core-bulk-edit-modal__title">{{ $t('table.bulkEdit') }}</span>
          <span class="core-bulk-edit-modal__subtitle">
            {{ $t('table.bulkEditDescription', { count: selectedCount }) }}
          </span>
        </div>
      </div>

      <v-divider />

      <!-- Form -->
      <v-card-text class="core-bulk-edit-modal__body">
        <v-form ref="formRef">
          <v-row dense>
            <v-col
              v-for="header in editableHeaders"
              :key="header.key"
              cols="12"
              sm="6"
            >
              <div class="core-bulk-edit-modal__field-wrapper">
                <label class="core-bulk-edit-modal__field-label">{{ header.title }}</label>
                <v-select
                  v-if="header.choices && header.choices.length"
                  v-model="fieldValues[header.key]"
                  :items="header.choices.map((c: any) => ({ value: c, title: String(c) }))"
                  item-value="value"
                  item-title="title"
                  variant="outlined"
                  density="compact"
                  clearable
                  hide-details
                  :placeholder="$t('table.bulkEditNoChange')"
                />
                <v-select
                  v-else-if="header.type === 'boolean'"
                  v-model="fieldValues[header.key]"
                  :items="booleanOptions"
                  item-value="value"
                  item-title="text"
                  variant="outlined"
                  density="compact"
                  clearable
                  hide-details
                  :placeholder="$t('table.bulkEditNoChange')"
                />
                <v-text-field
                  v-else
                  v-model="fieldValues[header.key]"
                  :type="getInputType(header.type)"
                  variant="outlined"
                  density="compact"
                  clearable
                  hide-details
                  :placeholder="$t('table.bulkEditNoChange')"
                />
              </div>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>

      <v-divider />

      <!-- Actions -->
      <v-card-actions class="core-bulk-edit-modal__actions">
        <div class="core-bulk-edit-modal__hint">
          <v-icon icon="mdi-information-outline" size="14" class="mr-1" />
          {{ $t('table.bulkEditHint') }}
        </div>
        <v-spacer />
        <v-btn variant="text" class="core-bulk-edit-modal__cancel-btn" @click="$emit('cancel')">
          {{ $t('table.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          class="core-bulk-edit-modal__apply-btn"
          :disabled="!hasFilled"
          @click="handleApply"
        >
          <v-icon icon="mdi-check" size="16" class="mr-1" />
          {{ $t('table.applyToSelected', { count: selectedCount }) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Header {
  key: string
  title: string
  type?: string
  choices?: any[]
  frontendReadOnly?: boolean
  isForeignKey?: boolean
  columnsToJoin?: any[]
}

interface Props {
  modelValue: boolean
  headers: Header[]
  selectedCount: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  apply: [fieldValues: Record<string, any>]
  cancel: []
}>()

const editableHeaders = computed(() =>
  props.headers.filter(
    (h) =>
      h.key !== 'selection' &&
      h.key !== 'id' &&
      !h.frontendReadOnly &&
      !h.isForeignKey &&
      !(h.columnsToJoin && h.columnsToJoin.length),
  ),
)

const fieldValues = ref<Record<string, any>>({})

const booleanOptions = [
  { value: true, text: t('table.yes') },
  { value: false, text: t('table.no') },
]

const hasFilled = computed(() =>
  Object.values(fieldValues.value).some(
    (v) => v !== null && v !== undefined && v !== '',
  ),
)

const getInputType = (type?: string): string => {
  if (type === 'number') return 'number'
  if (type === 'date') return 'date'
  if (type === 'datetime') return 'datetime-local'
  if (type === 'time') return 'time'
  return 'text'
}

const handleApply = () => {
  const filled: Record<string, any> = {}
  for (const [key, value] of Object.entries(fieldValues.value)) {
    if (value !== null && value !== undefined && value !== '') {
      filled[key] = value
    }
  }
  emit('apply', filled)
}
</script>

<style src="@/assets/styles/components/core/CoreBulkEditModal.css"></style>
