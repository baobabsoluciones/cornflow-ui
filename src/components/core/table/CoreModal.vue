<!--
/**
 * CoreModal component
 * 
 * A reusable modal component for adding/editing items with dynamic form fields.
 * Automatically generates form fields based on schema configuration.
 * 
 * Features:
 * - Dynamic field generation based on data types
 * - Support for string, number, boolean, date, email, textarea fields
 * - Integrated date picker with calendar
 * - Form validation
 * - Responsive layout
 * - Consistent styling with CoreButton
 * - Loading states
 * - i18n support
 * 
 * Props:
 * - modelValue (Boolean): Controls modal visibility
 * - title (String): Modal title
 * - fields (Object): Field configuration object
 * - formData (Object): Form data object
 * - loading (Boolean): Loading state for submit button
 * - mode (String): 'add' or 'edit' mode
 * 
 * Field configuration format:
 * {
 *   fieldName: {
 *     type: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'email' | 'textarea',
 *     title: 'Field Label',
 *     required: true/false,
 *     readOnly: true/false,
 *     placeholder: 'Placeholder text',
 *     min: number (for number/date fields),
 *     max: number (for number/date fields),
 *     pattern: 'regex pattern' (for string fields)
 *   }
 * }
 * 
 * Usage examples:
 * 
 * Basic usage:
 * <CoreModal
 *   v-model="showModal"
 *   :title="isEditing ? 'Edit Item' : 'Add Item'"
 *   :fields="formFields"
 *   :form-data="formData"
 *   :loading="saving"
 *   :mode="isEditing ? 'edit' : 'add'"
 *   @submit="handleSubmit"
 *   @cancel="handleCancel"
 * />
 * 
 * Events:
 * - @submit: Emitted when form is submitted with form data
 * - @cancel: Emitted when modal is cancelled
 * - @update:modelValue: Emitted when modal visibility changes
 * - @update:formData: Emitted when form data changes
 */
-->

<template>
  <v-dialog
    :model-value="modelValue && modelValue === true"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="480px"
    persistent
    class="core-modal"
  >
    <v-card class="core-modal-base__card core-modal__card">
      <!-- Header -->
      <v-card-title class="core-modal-base__header core-modal__header">
        <span class="core-modal-base__title core-modal__title">{{
          title
        }}</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          class="core-modal-base__close core-modal__close"
          @click="handleCancel"
        />
      </v-card-title>

      <!-- Content -->
      <v-card-text class="core-modal-base__content core-modal__content">
        <v-form
          ref="formRef"
          v-model="isFormValid"
          @submit.prevent="handleSubmit"
        >
          <v-container fluid class="pa-0">
            <v-row>
              <template v-for="(field, key) in visibleFields" :key="key">
                <v-col
                  v-if="field && field.key && field.type"
                  :cols="getFieldCols(field)"
                  :md="getFieldMd(field)"
                  class="pb-0"
                >
                  <!-- String/Email/Textarea Fields -->
                  <div
                    v-if="field && field.type && isTextType(field.type, field)"
                    class="core-modal__field-wrapper"
                  >
                    <label class="core-modal__field-label">
                      {{ field.title || field.label || formatFieldName(key) }}
                    </label>
                    <v-text-field
                      :model-value="formData[key]"
                      @update:model-value="updateField(key, $event)"
                      :type="field ? getInputType(field.type) : 'text'"
                      :required="field ? field.required : false"
                      :disabled="
                        field
                          ? field.readOnly || (mode === 'edit' && key === 'id')
                          : false
                      "
                      :rules="getFieldRules(field)"
                      variant="outlined"
                      density="compact"
                      persistent-hint
                      class="core-modal__field"
                    />
                  </div>

                  <!-- Textarea Field -->
                  <div
                    v-else-if="field && field.type === 'textarea'"
                    class="core-modal__field-wrapper"
                  >
                    <label class="core-modal__field-label">
                      {{ field.title || field.label || formatFieldName(key) }}
                    </label>
                    <v-textarea
                      :model-value="formData[key]"
                      @update:model-value="updateField(key, $event)"
                      :required="field ? field.required : false"
                      :disabled="field ? field.readOnly : false"
                      :rules="getFieldRules(field)"
                      variant="outlined"
                      density="compact"
                      rows="3"
                      persistent-hint
                      class="core-modal__field"
                    />
                  </div>

                  <!-- Number Fields -->
                  <div
                    v-else-if="field && field.type && isNumberType(field.type, field)"
                    class="core-modal__field-wrapper"
                  >
                    <label class="core-modal__field-label">
                      {{ field.title || field.label || formatFieldName(key) }}
                    </label>
                    <v-text-field
                      :model-value="formData[key]"
                      @update:model-value="updateField(key, $event)"
                      type="number"
                      :required="field ? field.required : false"
                      :disabled="field ? field.readOnly : false"
                      :rules="getFieldRules(field)"
                      :min="field ? field.min : undefined"
                      :max="field ? field.max : undefined"
                      variant="outlined"
                      density="compact"
                      persistent-hint
                      class="core-modal__field"
                    />
                  </div>

                  <!-- Boolean fields - Using selector with Yes/No -->
                  <div
                    v-else-if="field && field.type === 'boolean'"
                    class="core-modal__field-wrapper"
                  >
                    <label class="core-modal__field-label">
                      {{ field.title || field.label || formatFieldName(key) }}
                    </label>
                    <v-select
                      :model-value="formData[key]"
                      @update:model-value="updateField(key, $event)"
                      :items="formFieldsComposable.getChoicesOptions(field)"
                      item-value="value"
                      item-title="text"
                      :required="field ? field.required : false"
                      :disabled="field ? field.readOnly : false"
                      :rules="getFieldRules(field)"
                      variant="outlined"
                      density="compact"
                      persistent-hint
                      clearable
                      class="core-modal__field"
                    />
                  </div>

                  <!-- Date Fields -->
                  <div
                    v-else-if="field && field.type === 'date'"
                    class="core-modal__field-wrapper"
                  >
                    <label class="core-modal__field-label">
                      {{ field.title || field.label || formatFieldName(key) }}
                    </label>
                    <v-text-field
                      :model-value="formatDate(formData[key])"
                      :required="field ? field.required : false"
                      :disabled="field ? field.readOnly : false"
                      variant="outlined"
                      density="compact"
                      prepend-inner-icon="mdi-calendar"
                      persistent-hint
                      class="core-modal__field core-modal__date-field"
                      @click="openDatePicker(key)"
                    />

                    <!-- Date Picker Menu -->
                    <v-menu
                      v-model="datePickerMenus[key]"
                      :close-on-content-click="false"
                      transition="scale-transition"
                      offset-y
                      max-width="290px"
                    >
                      <template v-slot:activator="{ props }">
                        <div v-bind="props" style="display: none"></div>
                      </template>

                      <v-card class="core-modal__date-picker">
                        <v-date-picker
                          :model-value="
                            formData[key] ? new Date(formData[key]) : null
                          "
                          @update:model-value="updateDateField(key, $event)"
                          :min="field ? field.min : undefined"
                          :max="field ? field.max : undefined"
                          color="primary"
                          header-color="primary"
                          show-adjacent-months
                        />
                        <v-card-actions class="justify-end pa-2">
                          <CoreButton
                            :text="$t('table.cancel')"
                            variant="text"
                            size="small"
                            @click="datePickerMenus[key] = false"
                          />
                          <CoreButton
                            :text="$t('table.ok')"
                            variant="filled"
                            size="small"
                            color="primary"
                            @click="datePickerMenus[key] = false"
                          />
                        </v-card-actions>
                      </v-card>
                    </v-menu>
                  </div>

                  <!-- Selector Fields (Foreign Key or Choices) -->
                  <div
                    v-else-if="isSelectorType(field)"
                    class="core-modal__field-wrapper"
                  >
                    <label class="core-modal__field-label">
                      {{ field.title || field.label || formatFieldName(key) }}
                    </label>
                    <!-- Use v-select for choices/boolean fields, v-autocomplete for foreign keys -->
                    <v-select
                      v-if="
                        (field.choices &&
                          Array.isArray(field.choices) &&
                          field.choices.length > 0) ||
                        field.type === 'boolean'
                      "
                      :model-value="formData[key]"
                      @update:model-value="updateField(key, $event)"
                      :items="getChoicesOptions(field)"
                      item-value="value"
                      item-title="text"
                      :required="field ? field.required : false"
                      :disabled="field ? field.readOnly : false"
                      :rules="getFieldRules(field)"
                      variant="outlined"
                      density="compact"
                      persistent-hint
                      clearable
                      class="core-modal__field"
                    />
                    <v-autocomplete
                      v-else
                      :model-value="formData[key]"
                      @update:model-value="updateField(key, $event)"
                      :items="selectorOptions[key] || []"
                      item-value="value"
                      item-title="text"
                      :loading="loadingSelectorOptions[key] || false"
                      :required="field ? field.required : false"
                      :disabled="field ? field.readOnly : false"
                      :rules="getFieldRules(field)"
                      variant="outlined"
                      density="compact"
                      persistent-hint
                      clearable
                      no-data-text="No hay datos disponibles"
                      class="core-modal__field"
                      @focus="loadSelectorOptions(key, field)"
                    />
                  </div>
                </v-col>
              </template>
            </v-row>
          </v-container>
        </v-form>
      </v-card-text>

      <!-- Actions -->
      <v-card-actions class="core-modal-base__actions core-modal__actions">
        <v-spacer />
        <CoreButton
          :text="$t('table.cancel')"
          variant="text"
          color="grey"
          size="small"
          @click="handleCancel"
        />
        <CoreButton
          :text="mode === 'edit' ? $t('table.update') : $t('table.save')"
          variant="filled"
          color="primary"
          size="small"
          :loading="loading"
          @click="handleSubmit"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@/components/core/CoreButton.vue'
import { useFormFields } from '@/composables/core-table/useFormFields'
import type { FieldConfig } from '@/composables/core-table/useFormFields'

// Composables
const { t } = useI18n()

interface Props {
  modelValue: boolean
  title: string
  fields: Record<string, FieldConfig> | FieldConfig[]
  formData: Record<string, any>
  loading?: boolean
  mode?: 'add' | 'edit'
  // Foreign key data loading
  loadTableData?: (tableName: string) => Promise<any[]>
  tableData?: Record<string, any[]>
}

// Props
const props = withDefaults(defineProps<Props>(), {
  fields: () => [],
  formData: () => ({}),
  loading: false,
  mode: 'add',
  loadTableData: () => Promise.resolve([]),
  tableData: () => ({}),
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:formData': [data: Record<string, any>]
  submit: [data: Record<string, any>]
  cancel: []
}>()

// Use form fields composable
const formFieldsComposable = useFormFields({
  fields: computed(() => props.fields),
  formData: computed(() => props.formData),
  mode: computed(() => props.mode),
  loadTableData: props.loadTableData,
  tableData: computed(() => props.tableData),
})

// State
const datePickerMenus = ref<Record<string, boolean>>({})
const formRef = ref<any>(null)
const isFormValid = ref(false)

// Use composable computed properties
const visibleFields = formFieldsComposable.visibleFields
const selectorOptions = formFieldsComposable.selectorOptions
const loadingSelectorOptions = formFieldsComposable.loadingSelectorOptions

// Methods
const updateField = (key: string, value: any) => {
  const updatedData = { ...props.formData, [key]: value }

  // Handle dependent field updates using composable
  const updatedDataWithDependents = formFieldsComposable.updateDependentFields(
    key,
    value,
    updatedData,
  )

  emit('update:formData', updatedDataWithDependents)
}

// Load options for selector fields using composable
const loadSelectorOptions = (fieldKey: string, field: FieldConfig) => {
  formFieldsComposable.loadSelectorOptions(fieldKey, field)
}

const updateDateField = (key: string, date: Date | null) => {
  if (date) {
    const formattedDate = date.toISOString().split('T')[0]
    updateField(key, formattedDate)
  }
}

const openDatePicker = (key: string) => {
  if (!props.fields[key].readOnly) {
    datePickerMenus.value[key] = true
  }
}

// Use composable functions
const formatDate = formFieldsComposable.formatDate
const formatFieldName = formFieldsComposable.formatFieldName
const isTextType = formFieldsComposable.isTextType
const isNumberType = formFieldsComposable.isNumberType
const isSelectorType = formFieldsComposable.isSelectorType
const getInputType = formFieldsComposable.getInputType
const getFieldCols = formFieldsComposable.getFieldCols
const getFieldMd = formFieldsComposable.getFieldMd
const getFieldRules = formFieldsComposable.getFieldRules
const getChoicesOptions = formFieldsComposable.getChoicesOptions

const handleSubmit = async () => {
  // Validate form if formRef is available
  if (formRef.value) {
    const { valid } = await formRef.value.validate()
    if (!valid) {
      return // Don't submit if validation fails
    }
  }

  // Prepare form data for submission using composable
  // This filters out dependent fields and handles id field based on mode
  const preparedFormData = formFieldsComposable.prepareFormDataForSubmit(
    props.formData,
    props.mode,
  )

  emit('update:formData', preparedFormData)
  emit('submit', preparedFormData)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}

// Watchers
watch(
  () => props.fields,
  (newFields) => {
    // Initialize date picker menus for date fields
    const dateMenus: Record<string, boolean> = {}
    if (newFields && typeof newFields === 'object') {
      Object.entries(newFields).forEach(([key, field]) => {
        if (field && field.type === 'date') {
          dateMenus[key] = false
        }
      })
    }
    datePickerMenus.value = dateMenus
  },
  { immediate: true },
)

// Watch for modal opening to load selector options
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.fields) {
      // Load options for all selector fields
      const fields = Array.isArray(props.fields)
        ? props.fields.reduce(
            (acc, field) => ({ ...acc, [field.key || '']: field }),
            {},
          )
        : props.fields

      Object.entries(fields).forEach(([key, field]) => {
        if (formFieldsComposable.isSelectorType(field)) {
          loadSelectorOptions(key, field)
        }
      })
    }
  },
  { immediate: true },
)
</script>

<style>
@import '@/assets/styles/components/core/CoreModalBase.css';
@import '@/assets/styles/components/core/CoreModal.css';
</style>
