<template>
  <div class="core-table-container">
    <v-card :elevation="elevation">
      <!-- Search and Action buttons -->
      <div class="d-flex justify-space-between align-center ma-4 ga-2">
        <!-- Search and Filter -->
        <div class="d-flex align-center ga-2">
          <!-- Search Input -->
          <CoreSearchInput
            v-if="enableSearch"
            :model-value="searchValue || ''"
            :placeholder="computedSearchPlaceholder"
            @update:model-value="handleSearch"
            @search="handleSearch"
          />
          <!-- Filter Button -->
          <div
            v-if="enableFilters"
            class="core-filter-button"
            :class="{
              'core-filter-button--active': hasActiveFilters,
            }"
            @click="toggleFiltersPanel"
          >
            <v-badge
              v-if="hasActiveFilters"
              :content="activeFiltersCount"
              color="var(--secondary)"
              inline
            />
            <span class="core-filter-button__text">
              {{ $t('table.filters.title') }}
            </span>
            <v-icon
              :icon="showFiltersPanel ? 'mdi-chevron-up' : 'mdi-chevron-down'"
              size="16"
              class="core-filter-button__chevron"
            />
          </div>

          <!-- Clear All Filters Button -->
          <v-tooltip v-if="enableFilters && hasActiveFilters" location="bottom">
            <template v-slot:activator="{ props }">
              <div
                class="core-clear-filters-button"
                @click="handleClearAllFilters"
                v-bind="props"
              >
                <v-icon
                  icon="mdi-delete-sweep"
                  size="16"
                  class="core-clear-filters-button__icon"
                />
              </div>
            </template>
            <span>{{ $t('table.filters.clearAll') }}</span>
          </v-tooltip>
        </div>

        <!-- Action Menu -->
        <div v-if="canAdd || canBulkUpload || canDownloadExcel">
          <CoreDropdownMenu
            :items="tableActionItems"
            @item-click="handleTableActionClick"
          />
        </div>
      </div>

      <!-- Filters Panel -->
      <CoreFiltersPanel
        v-if="enableFilters"
        :show-panel="showFiltersPanel"
        :active-filters="safeActiveFilters"
        :available-fields="availableFilterFields"
        :has-active-filters="hasActiveFilters"
        :active-filters-count="activeFiltersCount"
        :get-operators-for-field-type="getOperatorsForFieldType || (() => [])"
        :get-operator-text="getOperatorText || (() => '')"
        :operator-needs-value="operatorNeedsValue || (() => false)"
        :operator-needs-second-value="operatorNeedsSecondValue || (() => false)"
        :generate-filter-id="generateFilterId || (() => '')"
        @add-filter="handleAddFilter"
        @remove-filter="handleRemoveFilter"
        @clear-all-filters="handleClearAllFilters"
      />

      <!-- Virtual Table with infinite scroll -->
      <div class="table-container" ref="tableContainer">
        <v-data-table-virtual
          :key="`table-${forceRerender}-${tableKey}`"
          :headers="safeHeaders"
          :items="safeItems"
          :loading="localLoading"
          :height="tableHeight"
          fixed-header
          class="pr-5 pl-5 pt-2"
          item-value="id"
        >
          <template v-slot:loading>
            <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
          </template>

          <template v-slot:no-data>
            <v-alert
              type="info"
              color="var(--primary)"
              class="ma-4 no-data-alert"
            >
              {{ $t('table.noDataAvailable') }}
            </v-alert>
          </template>

          <!-- Custom header for selection column -->
          <template v-slot:header.selection="{ column }">
            <CoreCheckbox
              v-if="enableSelection && canDelete && safeItems.length > 0"
              :model-value="
                safeSelectedItems.length === safeItems.length &&
                safeItems.length > 0
              "
              :indeterminate="
                safeSelectedItems.length > 0 &&
                safeSelectedItems.length < safeItems.length
              "
              @update:model-value="handleSelectAll"
            />
          </template>

          <!-- Selection column slot -->
          <template v-slot:item.selection="{ item }">
            <CoreCheckbox
              v-if="enableSelection && canDelete"
              :model-value="
                safeSelectedItems.some((selected) => selected.id === item.id)
              "
              @update:model-value="() => handleSelectItem(item)"
            />
          </template>

          <!-- Dynamic column slots for inline editing -->
          <template
            v-for="header in safeHeaders.filter((h) => h.key !== 'selection')"
            :key="header.key"
            v-slot:[`item.${header.key}`]="{ item }"
          >
            <div
              class="inline-edit-cell"
              :class="{ editing: isRowEditing(item.id) }"
            >
              <!-- Editing mode -->
              <template v-if="isRowEditing(item.id)">
                <!-- Read-only field display -->
                <span v-if="header.readOnly" class="inline-edit-readonly">
                  {{
                    formatCellValue(
                      editingData[header.key],
                      getFieldType(header.key),
                    )
                  }}
                </span>

                <!-- Text or Number field -->
                <v-text-field
                  v-else-if="isTextOrNumberField(header)"
                  :model-value="editingData[header.key]"
                  @update:model-value="
                    (value) => updateInlineField(header.key, value)
                  "
                  :type="
                    getFieldType(header.key) === 'number' ? 'number' : 'text'
                  "
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="inline-edit-input"
                />

                <!-- Boolean selector -->
                <v-select
                  v-else-if="getFieldType(header.key) === 'boolean'"
                  :model-value="editingData[header.key]"
                  @update:model-value="
                    (value) => updateInlineField(header.key, value)
                  "
                  :items="getBooleanOptions()"
                  item-value="value"
                  item-title="text"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="inline-edit-input"
                />

                <!-- Foreign key selector or choices field -->
                <v-select
                  v-else-if="
                    isSelectorField(header) ||
                    hasChoices(header) ||
                    getFieldType(header.key) === 'boolean'
                  "
                  :model-value="editingData[header.key]"
                  @update:model-value="
                    (value) => updateInlineField(header.key, value)
                  "
                  :items="getSelectorOrChoicesOptions(header)"
                  :loading="isSelectorLoading(header.key)"
                  item-title="text"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="inline-edit-input"
                />

                <!-- Fallback for other types -->
                <span v-else>{{ editingData[header.key] }}</span>
              </template>

              <!-- Display mode -->
              <template v-else>
                <span
                  class="inline-edit-display"
                  :class="{
                    'inline-edit-display--disabled':
                      !canEdit || header.readOnly,
                  }"
                  @click="
                    canEdit && !header.readOnly
                      ? startInlineEdit(item)
                      : undefined
                  "
                  :title="
                    canEdit && !header.readOnly
                      ? $t('table.clickToEdit')
                      : undefined
                  "
                >
                  {{ formatCellValueForDisplay(item[header.key], header) }}
                </span>
              </template>

              <!-- Save/Cancel buttons (only show for the editing row at the end) -->
              <div
                v-if="isRowEditing(item.id) && isLastEditableColumn(header.key)"
                class="inline-edit-actions ml-2"
              >
                <CoreButton
                  icon="mdi-check"
                  variant="icon"
                  color="success"
                  size="small"
                  :loading="saving"
                  @click="saveInlineEdit"
                  :title="$t('table.save')"
                />
                <CoreButton
                  icon="mdi-close"
                  variant="icon"
                  color="error"
                  size="small"
                  @click="cancelInlineEdit"
                  :title="$t('table.cancel')"
                />
              </div>
            </div>
          </template>
        </v-data-table-virtual>
      </div>
    </v-card>

    <!-- Floating Selection Actions Bar -->
    <FloatingSelectionBar
      v-if="enableBulkActions && hasSelectedItems"
      :selected-count="selectedItemsCount"
      @clear="handleClearSelection"
      @delete="() => emit('update:showBulkDeleteDialog', true)"
    />

    <!-- Add/Edit Modal -->
    <CoreModal
      v-if="showAddEditModal && (canAdd || canEdit)"
      :model-value="showAddEditModal"
      :title="isEditing ? $t('table.editItem') : $t('table.addItem')"
      :fields="formFields"
      :form-data="formData"
      :loading="saving"
      :mode="isEditing ? 'edit' : 'add'"
      :load-table-data="loadTableData"
      :table-data="tableData"
      @submit="handleSaveItem"
      @cancel="handleCancelEdit"
      @update:model-value="(value) => emit('update:showAddEditModal', value)"
      @update:form-data="(data) => emit('update:formData', data)"
    />

    <!-- Delete Confirmation Dialog -->
    <CoreConfirmDialog
      v-if="showDeleteDialog && canDelete"
      :model-value="showDeleteDialog"
      :title="$t('table.confirmDelete')"
      :message="$t('table.deleteMessage')"
      :confirm-text="$t('table.delete')"
      :cancel-text="$t('table.cancel')"
      confirm-color="var(--danger)"
      :loading="deleting"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
      @update:model-value="(value) => emit('update:showDeleteDialog', value)"
    />

    <!-- Bulk Delete Confirmation Dialog -->
    <CoreConfirmDialog
      v-if="showBulkDeleteDialog && enableBulkActions"
      :model-value="showBulkDeleteDialog"
      :title="$t('table.confirmBulkDelete')"
      :message="$t('table.bulkDeleteMessage', { count: selectedItemsCount })"
      :confirm-text="$t('table.deleteSelected')"
      :cancel-text="$t('table.cancel')"
      confirm-color="var(--danger)"
      :loading="bulkDeleting"
      @confirm="handleConfirmBulkDelete"
      @cancel="handleCancelBulkDelete"
      @update:model-value="
        (value) => emit('update:showBulkDeleteDialog', value)
      "
    />

    <!-- Bulk Upload Modal -->
    <CoreBulkUploadModal
      v-if="showBulkUploadModal && canBulkUpload"
      :model-value="showBulkUploadModal"
      :title="$t('table.bulkUpload')"
      :accepted-formats="['.xlsx', '.json', '.csv']"
      :available-operations="['post_bulk', 'overwrite_all']"
      :loading="uploading"
      :multiple="false"
      @upload="handleBulkUpload"
      @cancel="handleCancelBulkUpload"
      @update:model-value="(value) => emit('update:showBulkUploadModal', value)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@/components/core/CoreButton.vue'
import CoreModal from '@/components/core/table/CoreModal.vue'
import CoreConfirmDialog from '@/components/core/table/CoreConfirmDialog.vue'
import CoreSearchInput from '@/components/core/table/CoreSearchInput.vue'
import CoreBulkUploadModal from '@/components/core/table/CoreBulkUploadModal.vue'
import FloatingSelectionBar from '@/components/core/table/FloatingSelectionBar.vue'
import CoreCheckbox from '@/components/core/CoreCheckbox.vue'
import CoreFiltersPanel from '@/components/core/table/CoreFiltersPanel.vue'
import CoreDropdownMenu from '@/components/core/CoreDropdownMenu.vue'
import { useTableHeight } from '@/composables/core-table/useTableHeight'
import { useFormFields } from '@/composables/core-table/useFormFields'

// Props - Presentational Component Interface
interface Props {
  // Data
  items: any[]
  headers: any[]
  loading?: boolean

  // Table Configuration
  tableTitle?: string
  searchPlaceholder?: string
  elevation?: number

  // Features Enabled
  enableSearch?: boolean
  enableFilters?: boolean
  enableSelection?: boolean
  enableActions?: boolean
  enableBulkActions?: boolean

  // Action Permissions
  canAdd?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canBulkUpload?: boolean
  canDownloadExcel?: boolean

  // Current States
  searchValue?: string
  activeFilters?: any[]
  selectedItems?: any[]

  // Filter Configuration
  availableFilterFields?: any[]

  // Filter Helper Functions
  getOperatorsForFieldType?: (fieldType: string) => string[]
  getOperatorText?: (operator: string) => string
  operatorNeedsValue?: (operator: string) => boolean
  operatorNeedsSecondValue?: (operator: string) => boolean
  generateFilterId?: () => string

  // Modal States
  showAddEditModal?: boolean
  showDeleteDialog?: boolean
  showBulkDeleteDialog?: boolean
  showBulkUploadModal?: boolean

  // Form Data
  formFields?: any[]
  formData?: any
  isEditing?: boolean

  // Loading States
  saving?: boolean
  deleting?: boolean
  bulkDeleting?: boolean
  uploading?: boolean
  downloading?: boolean

  // Inline Editing States
  editingRowId?: string | number | null
  editingData?: any
  originalData?: any
  isEditingAnyRow?: boolean

  // Foreign key data loading
  loadTableData?: (tableName: string) => Promise<any[]>
  tableData?: Record<string, any[]>
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  elevation: 1,
  headers: () => [],
  loading: false,
  tableTitle: '',
  searchPlaceholder: undefined,
  enableSearch: true,
  enableFilters: true,
  enableSelection: false,
  enableActions: true,
  enableBulkActions: false,
  canAdd: false,
  canEdit: false,
  canDelete: false,
  canBulkUpload: false,
  canDownloadExcel: false,
  searchValue: '',
  activeFilters: () => [],
  selectedItems: () => [],
  availableFilterFields: () => [],
  getOperatorsForFieldType: () => () => [],
  getOperatorText: () => () => '',
  operatorNeedsValue: () => () => false,
  operatorNeedsSecondValue: () => () => false,
  generateFilterId: () => () => '',
  showAddEditModal: false,
  showDeleteDialog: false,
  showBulkDeleteDialog: false,
  showBulkUploadModal: false,
  formFields: () => [],
  formData: () => ({}),
  isEditing: false,
  saving: false,
  deleting: false,
  bulkDeleting: false,
  uploading: false,
  downloading: false,
  editingRowId: null,
  editingData: () => ({}),
  originalData: () => ({}),
  isEditingAnyRow: false,
  loadTableData: () => Promise.resolve([]),
  tableData: () => ({}),
})

// Emits - All events that parent should handle
interface Emits {
  // Search & Filter Events
  (e: 'update:searchValue', value: string): void
  (e: 'search', value: string): void
  (e: 'update:activeFilters', filters: any[]): void
  (e: 'add-filter', filter: any): void
  (e: 'remove-filter', filterId: string): void
  (e: 'clear-all-filters'): void
  (e: 'toggle-filters-panel', show: boolean): void

  // Selection Events
  (e: 'update:selectedItems', items: any[]): void
  (e: 'select-item', item: any): void
  (e: 'select-all', items: any[]): void
  (e: 'clear-selection'): void

  // CRUD Events
  (e: 'add-item'): void
  (e: 'edit-item', item: any): void
  (e: 'delete-item', item: any): void
  (e: 'bulk-delete', items: any[]): void
  (e: 'save-item', data: any): void
  (e: 'cancel-edit'): void

  // File Operations
  (e: 'bulk-upload', data: { files: File[]; operation: string }): void
  (e: 'download-excel'): void

  // Modal Events
  (e: 'update:showAddEditModal', show: boolean): void
  (e: 'update:showDeleteDialog', show: boolean): void
  (e: 'update:showBulkDeleteDialog', show: boolean): void
  (e: 'update:showBulkUploadModal', show: boolean): void
  (e: 'update:formData', data: any): void

  // Confirmation Events
  (e: 'confirm-delete'): void
  (e: 'confirm-bulk-delete'): void
  (e: 'cancel-delete'): void
  (e: 'cancel-bulk-delete'): void
  (e: 'cancel-bulk-upload'): void

  // Inline Editing Events
  (e: 'start-inline-edit', item: any, field?: string): void
  (e: 'save-inline-edit'): void
  (e: 'cancel-inline-edit'): void
  (e: 'update-inline-field', field: string, value: any): void
}

const emit = defineEmits<Emits>()

// Composables
const { t: $t } = useI18n()

// Use form fields composable for consistent field handling
const formFieldsComposable = useFormFields({
  fields: computed(() => props.formFields || []),
  formData: computed(() => props.editingData || {}),
  mode: computed(() => (props.editingRowId ? 'edit' : 'add')),
  loadTableData: props.loadTableData,
  tableData: computed(() => props.tableData || {}),
})

const computedSearchPlaceholder = computed(() => {
  return props.searchPlaceholder || $t('table.searchPlaceholder')
})

// Local UI state only
const showFiltersPanel = ref(false)

// Critical refs for loading management
const forceRerender = ref(0)
const tableKey = ref(0)
const localLoading = ref(false)

// Initialization complete

watch(
  () => props.loading,
  (newValue, oldValue) => {
    localLoading.value = newValue

    if (oldValue === true && newValue === false) {
      forceRerender.value++
      tableKey.value++
    }
  },
  { immediate: true },
)

watch(
  () => props.items,
  (newValue, oldValue) => {
    // If we have items, stop loading
    if (newValue && newValue.length > 0) {
      localLoading.value = false
      tableKey.value++
    }
  },
  { immediate: true },
)

onMounted(() => {
  // Force immediate check
  if (props.items && props.items.length > 0) {
    localLoading.value = false
    tableKey.value++
  }
})

// Watch for inline editing to load selector options
watch(
  () => props.editingRowId,
  (newValue) => {
    if (newValue) {
      // Load selector options when starting inline edit
      loadInlineSelectorOptions()
    }
  },
  { immediate: false },
)

// Computed properties based on props
const safeHeaders = computed(() => {
  // Ensure headers is always a valid array
  if (!props.headers || !Array.isArray(props.headers)) {
    return []
  }

  // Filter out hidden fields (foreign keys with columns_to_join)
  return props.headers.filter((header) => {
    // Check if this header represents a hidden field
    if (header.hidden || header.isForeignKey) {
      return false
    }

    // Check if this header has columns_to_join property
    if (header.columnsToJoin && Array.isArray(header.columnsToJoin)) {
      return false
    }

    return true
  })
})

const safeItems = computed(() => {
  // Ensure items is always a valid array
  if (!props.items || !Array.isArray(props.items)) {
    return []
  }
  return props.items
})

const safeActiveFilters = computed(() => {
  return Array.isArray(props.activeFilters) ? props.activeFilters : []
})

const safeSelectedItems = computed(() => {
  return Array.isArray(props.selectedItems) ? props.selectedItems : []
})

const hasActiveFilters = computed(() => safeActiveFilters.value.length > 0)
const activeFiltersCount = computed(() => safeActiveFilters.value.length)
const hasSelectedItems = computed(() => safeSelectedItems.value.length > 0)
const selectedItemsCount = computed(() => safeSelectedItems.value.length)

// Table action items for dropdown menu
const tableActionItems = computed(() => {
  const items = []

  if (props.canAdd) {
    items.push({
      id: 'add',
      title: $t('table.add'),
      icon: 'mdi-plus',
      action: handleAddItem,
    })
  }

  if (props.canBulkUpload) {
    items.push({
      id: 'bulk-upload',
      title: $t('table.bulkUpload'),
      icon: 'mdi-upload',
      action: () => emit('update:showBulkUploadModal', true),
    })
  }

  if (props.canDownloadExcel) {
    items.push({
      id: 'download-excel',
      title: $t('table.downloadExcelTable'),
      icon: 'mdi-download',
      disabled: props.downloading,
      rightIcon: props.downloading ? undefined : undefined,
      rightContent: props.downloading ? '⏳' : undefined,
      action: handleDownloadExcel,
    })
  }

  return items
})

// Table height management
const { tableHeight, tableContainer } = useTableHeight()

// Event handlers - Only emit events to parent
const handleSearch = (value: string) => {
  emit('update:searchValue', value)
  emit('search', value)
}

const handleAddFilter = (filter: any) => {
  emit('add-filter', filter)
}

const handleRemoveFilter = (filterId: string) => {
  emit('remove-filter', filterId)
}

const handleClearAllFilters = () => {
  emit('clear-all-filters')
}

const toggleFiltersPanel = () => {
  showFiltersPanel.value = !showFiltersPanel.value
  emit('toggle-filters-panel', showFiltersPanel.value)
}

const handleSelectItem = (item: any) => {
  emit('select-item', item)
}

const handleSelectAll = (selectAll: boolean) => {
  emit('select-all', selectAll)
}

const handleClearSelection = () => {
  emit('clear-selection')
}

const handleAddItem = () => {
  emit('add-item')
}

const handleEditItem = (item: any) => {
  emit('edit-item', item)
}

const handleDeleteItem = (item: any) => {
  emit('delete-item', item)
}

const handleBulkDelete = () => {
  emit('bulk-delete', safeSelectedItems.value)
}

const handleSaveItem = (data: any) => {
  emit('save-item', data)
}

const handleCancelEdit = () => {
  emit('cancel-edit')
}

const handleBulkUpload = (data: { files: File[]; operation: string }) => {
  emit('bulk-upload', data)
}

const handleDownloadExcel = () => {
  emit('download-excel')
}

const handleTableActionClick = (item: any) => {
  // The action is already handled by the item.action function
  // This is just for any additional logic if needed
}

// Inline editing handlers
const startInlineEdit = (item: any, field?: string) => {
  emit('start-inline-edit', item, field)
}

const saveInlineEdit = () => {
  emit('save-inline-edit')
}

const cancelInlineEdit = () => {
  emit('cancel-inline-edit')
}

const updateInlineField = (field: string, value: any) => {
  // Get current editing data
  const currentEditingData = { ...props.editingData }

  // Update the field value
  currentEditingData[field] = value

  // Update dependent fields using the composable logic
  const updatedData = formFieldsComposable.updateDependentFields(
    field,
    value,
    currentEditingData,
  )

  // Emit the updated data - the parent will handle updating editingData
  emit('update-inline-field', field, value)
}

const isRowEditing = (itemId: string | number): boolean => {
  return props.editingRowId === itemId
}

// Helper functions for inline editing using composable
const getFieldType = (fieldKey: string): string => {
  return formFieldsComposable.getFieldType(
    fieldKey,
    props.formFields || [],
    props.items,
  )
}

const formatCellValue = (value: any, type: string): string => {
  return formFieldsComposable.formatCellValue(value, type)
}

/**
 * Format cell value for display, handling choices and boolean special cases
 */
const formatCellValueForDisplay = (value: any, header: any): string => {
  if (value === null || value === undefined) return ''

  // Handle boolean type
  if (header.type === 'boolean' || getFieldType(header.key) === 'boolean') {
    return value ? $t('table.yes') : $t('table.no')
  }

  // For other types, use the standard formatCellValue
  return formatCellValue(value, getFieldType(header.key))
}

/**
 * Check if a header represents a text or number field
 */
const isTextOrNumberField = (header: any): boolean => {
  const fieldType = getFieldType(header.key)
  return (
    (fieldType === 'string' || fieldType === 'number') &&
    !isSelectorField(header) &&
    !hasChoices(header) // Exclude fields with choices (they should be selectors)
  )
}

/**
 * Check if a header represents a selector field (foreign key)
 */
const isSelectorField = (header: any): boolean => {
  // A field is a selector if:
  // 1. It has a joinFrom property (dependent field)
  // 2. It has isMainSelector flag
  // 3. It's marked as isDependentField
  return Boolean(
    header.joinFrom || header.isMainSelector || header.isDependentField,
  )
}

/**
 * Check if a header has choices
 */
const hasChoices = (header: any): boolean => {
  // Check for choices property
  if (
    header.choices &&
    Array.isArray(header.choices) &&
    header.choices.length > 0
  ) {
    return true
  }
  return false
}

/**
 * Get boolean options (Yes/No)
 */
const getBooleanOptions = () => {
  return [
    { value: true, text: $t('table.yes') },
    { value: false, text: $t('table.no') },
  ]
}

/**
 * Get selector or choices options for a header
 */
const getSelectorOrChoicesOptions = (
  header: any,
): Array<{ value: any; text: string }> => {
  // Handle boolean type
  if (header.type === 'boolean' || getFieldType(header.key) === 'boolean') {
    return getBooleanOptions()
  }

  // If it has choices, use getChoicesOptions
  if (hasChoices(header)) {
    // Find the field config to get choices
    const fieldConfig =
      props.formFields?.find((f: any) => f.key === header.key) ||
      (props.formFields && typeof props.formFields === 'object'
        ? props.formFields[header.key]
        : null)

    if (fieldConfig) {
      return formFieldsComposable.getChoicesOptions(fieldConfig)
    }

    // Fallback: generate options from header.choices
    if (header.choices && Array.isArray(header.choices)) {
      // Return choices as options (show values as-is)
      return header.choices.map((choice: any) => ({
        value: choice,
        text: String(choice),
      }))
    }
  }

  // Otherwise, use selector options (foreign key)
  return getSelectorOptions(header.key)
}

/**
 * Get selector options for a field
 */
const getSelectorOptions = (
  fieldKey: string,
): Array<{ value: any; text: string }> => {
  return formFieldsComposable.selectorOptions.value[fieldKey] || []
}

/**
 * Check if selector options are loading
 */
const isSelectorLoading = (fieldKey: string): boolean => {
  return formFieldsComposable.loadingSelectorOptions.value[fieldKey] || false
}

/**
 * Load selector options when starting inline edit
 */
const loadInlineSelectorOptions = async () => {
  if (!props.editingRowId) return

  // Get all selector fields and choices fields from headers
  const selectorHeaders = props.headers.filter(
    (h) => isSelectorField(h) || hasChoices(h),
  )

  // Load options for each selector/choices field
  for (const header of selectorHeaders) {
    if (header.key) {
      // Find the field config
      const fieldConfig = props.formFields?.find(
        (f: any) => f.key === header.key,
      ) ||
        (props.formFields && typeof props.formFields === 'object'
          ? props.formFields[header.key]
          : null) || {
          key: header.key,
          type: header.type || 'string',
          joinFrom: header.joinFrom,
          isDependentField: header.isDependentField,
          isMainSelector: header.isMainSelector,
          choices: header.choices,
        }

      await formFieldsComposable.loadSelectorOptions(header.key, fieldConfig)
    }
  }
}

const isLastEditableColumn = (fieldKey: string): boolean => {
  const editableHeaders = props.headers.filter(
    (h) => h.key !== 'selection' && h.key !== 'actions',
  )
  const lastEditableHeader = editableHeaders[editableHeaders.length - 1]
  return lastEditableHeader?.key === fieldKey
}

const handleConfirmDelete = () => {
  emit('confirm-delete')
}

const handleConfirmBulkDelete = () => {
  emit('confirm-bulk-delete')
}

const handleCancelDelete = () => {
  emit('cancel-delete')
}

const handleCancelBulkDelete = () => {
  emit('cancel-bulk-delete')
}

const handleCancelBulkUpload = () => {
  emit('cancel-bulk-upload')
}

// Helper functions
const getColumnAlignment = (columnKey: string): string => {
  // Simple alignment logic - can be enhanced based on column type
  if (columnKey === 'selection' || columnKey === 'actions') {
    return 'center'
  }
  // You can add more logic here based on column types
  return 'left'
}
</script>

<style src="@/assets/styles/components/core/CoreTable.css"></style>
<style src="@/assets/styles/components/core/CoreTableInlineEdit.css"></style>
