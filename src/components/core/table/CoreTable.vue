<template>
  <div
    class="core-table-container"
    :class="{
      'excel-mode': enableExcelMode && !usePlainReadOnlyCells,
      'read-only-display': usePlainReadOnlyCells,
    }"
  >
    <v-card :elevation="elevation">
      <!-- Search and Action buttons (same row, no wrap) -->
      <div
        class="core-table__toolbar d-flex justify-space-between align-center ma-4 ga-2"
      >
        <template
          v-if="dateRangeFilterConfigs && dateRangeFilterConfigs.length > 0"
        >
          <div
            v-for="config in dateRangeFilterConfigs"
            :key="config.paramGte"
            class="core-table__date-range d-flex align-center ga-1 flex-shrink-0"
          >
            <v-text-field
              :model-value="getDateRangeFrom(config.paramGte)"
              :label="$t('table.filters.dateFrom')"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
              class="core-table__date-range-input"
              @update:model-value="(v) => setDateRangeFrom(config.paramGte, v)"
            />
            <v-text-field
              :model-value="getDateRangeTo(config.paramGte)"
              :label="$t('table.filters.dateTo')"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
              class="core-table__date-range-input"
              @update:model-value="(v) => setDateRangeTo(config.paramGte, v)"
            />
            <v-btn
              v-if="hasDateRangeValue(config.paramGte)"
              icon="mdi-close"
              size="small"
              variant="text"
              density="compact"
              :title="$t('table.filters.reset')"
              @click="clearDateRange(config.paramGte)"
            />
          </div>
        </template>
        <!-- Search and Filter (this block can scroll horizontally; date range stays outside to avoid label clipping) -->
        <div class="core-table__toolbar-left d-flex align-center ga-2">
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
        :available-fields="visibleAvailableFilterFields"
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

      <!-- Alert list (same style as SimpleList) or Virtual Table -->
      <div class="table-container" ref="tableContainer">
        <!-- Centered loading overlay. Visible whenever the parent marks the
             table as loading (route navigation, tab switch, async fetch).
             Sits on top of `v-data-table-virtual` so the user always gets
             feedback — the built-in thin progress bar of Vuetify isn't
             obvious enough on big tables and the row skeleton can be
             obscured by previously-rendered rows during transitions. -->
        <transition name="core-table-loading-fade">
          <div v-if="localLoading" class="core-table-loading-overlay">
            <v-progress-circular indeterminate color="primary" size="42" width="3" />
            <span class="core-table-loading-overlay__text">
              {{ $t('table.loading') }}
            </span>
          </div>
        </transition>
        <!-- Lista de alertas: mismo estilo que SimpleList (v-alert warning tonal) -->
        <template v-if="displayAsAlertList">
          <div v-if="localLoading" class="pa-4">
            <v-skeleton-loader type="text@5"></v-skeleton-loader>
          </div>
          <div v-else-if="safeItems.length === 0" class="pa-4">
            <v-alert type="info" color="var(--primary)" class="no-data-alert">
              {{ $t('table.noDataAvailable') }}
            </v-alert>
          </div>
          <div v-else class="core-table-alert-list simple-list-content pa-4">
            <div class="simple-list-items">
              <v-alert
                v-for="item in safeItems"
                :key="item.id"
                type="warning"
                variant="tonal"
                class="simple-list-item"
                density="comfortable"
              >
                <div class="simple-list-item__text">
                  {{ item[alertListMessageKey] }}
                </div>
              </v-alert>
            </div>
          </div>
        </template>

        <v-data-table-virtual
          v-else
          :key="`table-${forceRerender}-${tableKey}`"
          :headers="safeHeaders"
          :items="safeItems"
          :loading="localLoading"
          :height="tableHeight"
          fixed-header
          class="pr-5 pl-5 pt-2"
          item-value="id"
          :row-props="getRowProps"
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
              v-if="enableSelection && (canDelete || canBulkEdit) && safeItems.length > 0"
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

          <template
            v-for="header in safeHeaders.filter((h) => h.key !== 'selection')"
            :key="`header-origin-${header.key}`"
            v-slot:[`header.${header.key}`]="{ column }"
          >
            <div class="d-inline-flex align-center ga-1">
              <span>{{ column.title }}</span>
              <v-tooltip
                v-if="getHeaderOriginIndicator(header.key)?.tooltip"
                location="top"
              >
                <template #activator="{ props: tooltipProps }">
                  <v-icon
                    v-bind="tooltipProps"
                    size="14"
                    :color="
                      getHeaderOriginIndicator(header.key)?.source === 'db'
                        ? 'success'
                        : 'primary'
                    "
                  >
                    {{
                      getHeaderOriginIndicator(header.key)?.source === 'db'
                        ? 'mdi-database-check'
                        : 'mdi-file-document-outline'
                    }}
                  </v-icon>
                </template>
                <span>{{ getHeaderOriginIndicator(header.key)?.tooltip }}</span>
              </v-tooltip>
              <v-icon
                v-else-if="getHeaderOriginIndicator(header.key)"
                size="14"
                :color="
                  getHeaderOriginIndicator(header.key)?.source === 'db'
                    ? 'success'
                    : 'primary'
                "
              >
                {{
                  getHeaderOriginIndicator(header.key)?.source === 'db'
                    ? 'mdi-database-check'
                    : 'mdi-file-document-outline'
                }}
              </v-icon>
            </div>
          </template>

          <!-- Selection column slot -->
          <template v-slot:item.selection="{ item }">
            <CoreCheckbox
              v-if="enableSelection && (canDelete || canBulkEdit)"
              :model-value="
                safeSelectedItems.some((selected) => selected.id === item.id)
              "
              @update:model-value="() => handleSelectItem(item)"
            />
          </template>

          <!-- Dynamic column slots for inline editing or read-only display -->
          <template
            v-for="header in safeHeaders.filter((h) => h.key !== 'selection')"
            :key="header.key"
            v-slot:[`item.${header.key}`]="{ item }"
          >
            <!-- Read-only display: plain text cell (input-data/results in SectionView) -->
            <span v-if="usePlainReadOnlyCells" class="read-only-cell">
              {{
                formatCellValueForDisplay(
                  getCellDisplayValueForHeader(item, header),
                  header,
                )
              }}
            </span>
            <!-- Editable cell -->
            <div
              v-else
              class="inline-edit-cell"
              :class="{
                editing: isRowEditing(item.id),
                'cell-modified': isCellModified(item.id, header.key),
              }"
              :data-fijar-value="
                isFijarColumn(header)
                  ? isRowEditing(item.id)
                    ? editingData[header.key]
                      ? 'true'
                      : 'false'
                    : getCellDisplayValueForHeader(item, header)
                      ? 'true'
                      : 'false'
                  : undefined
              "
            >
              <!-- Editing mode -->
              <template v-if="isRowEditing(item.id)">
                <!-- Read-only field display -->
                <span
                  v-if="header.frontendReadOnly"
                  class="inline-edit-readonly"
                >
                  {{
                    formatCellValue(
                      editingData[header.key],
                      getFieldType(header.key),
                    )
                  }}
                </span>

                <!-- Fijar column - Switch for boolean -->
                <v-switch
                  v-else-if="
                    isFijarColumn(header) &&
                    getFieldType(header.key) === 'boolean'
                  "
                  :model-value="editingData[header.key]"
                  @update:model-value="
                    (value) => updateInlineField(header.key, value)
                  "
                  hide-details
                  density="compact"
                  class="inline-edit-switch"
                  color="primary"
                  :disabled="header.frontendReadOnly || isCellDisabledByRow(item, header)"
                />

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

                <!-- Date, datetime, or time field -->
                <v-text-field
                  v-else-if="isDateLikeField(header)"
                  :model-value="editingData[header.key]"
                  @update:model-value="
                    (value) => updateInlineField(header.key, value)
                  "
                  :type="getInputTypeForHeader(header)"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="inline-edit-input"
                />

                <!-- Boolean selector (for non-Fijar boolean columns) -->
                <v-select
                  v-else-if="
                    getFieldType(header.key) === 'boolean' &&
                    !isFijarColumn(header)
                  "
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
                  v-else-if="isSelectorField(header) || hasChoices(header)"
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

                <!-- Fallback: editable text/number for any other non-frontendReadOnly column -->
                <v-text-field
                  v-else-if="!header.frontendReadOnly"
                  :model-value="editingData[header.key]"
                  @update:model-value="
                    (value) => updateInlineField(header.key, value)
                  "
                  :type="getInputTypeForHeader(header)"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="inline-edit-input"
                />
                <span v-else>{{ editingData[header.key] }}</span>
              </template>

              <!-- Display mode -->
              <template v-else>
                <!-- Fijar column - Switch display -->
                <v-switch
                  v-if="
                    isFijarColumn(header) &&
                    getFieldType(header.key) === 'boolean'
                  "
                  :model-value="getCellDisplayValueForHeader(item, header)"
                  @update:model-value="
                    (value) => {
                      if (canEdit && !header.frontendReadOnly && !isCellDisabledByRow(item, header)) {
                        startInlineEdit(item)
                        updateInlineField(
                          header.key,
                          value,
                          item.id,
                          getCellDisplayValueForHeader(item, header),
                        )
                      }
                    }
                  "
                  hide-details
                  density="compact"
                  class="inline-edit-switch"
                  color="primary"
                  :disabled="!canEdit || header.frontendReadOnly || isCellDisabledByRow(item, header)"
                />
                <!-- Regular display for other columns -->
                <span
                  v-else
                  class="inline-edit-display"
                  :class="{
                    'inline-edit-display--disabled':
                      !canEdit || header.frontendReadOnly,
                  }"
                  @click.stop="
                    canEdit && !header.frontendReadOnly
                      ? startInlineEdit(item)
                      : undefined
                  "
                  :title="
                    header.frontendReadOnly
                      ? $t('table.fieldReadOnly')
                      : canEdit
                        ? $t('table.clickToEdit')
                        : undefined
                  "
                >
                  {{
                    formatCellValueForDisplay(
                      getCellDisplayValueForHeader(item, header),
                      header,
                    )
                  }}
                </span>
              </template>

              <!-- Save/Cancel buttons (only show for the editing row at the end, not in Excel mode) -->
              <div
                v-if="
                  !enableExcelMode &&
                  isRowEditing(item.id) &&
                  isLastEditableColumn(header.key)
                "
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
      :can-bulk-edit="canBulkEdit"
      :can-delete="canDelete"
      @clear="handleClearSelection"
      @delete="() => emit('update:showBulkDeleteDialog', true)"
      @bulk-edit="() => emit('bulk-edit')"
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
      :keep-dependent-fields-on-submit="enableExcelMode && !isEditing"
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
      :loading-message="$t('table.deletingPleaseWait')"
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
      :available-operations="resolvedBulkUploadOperations"
      :loading="uploading"
      :progress-message="uploadProgressMessage"
      :multiple="false"
      @upload="handleBulkUpload"
      @cancel="handleCancelBulkUpload"
      @update:model-value="(value) => emit('update:showBulkUploadModal', value)"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  nextTick,
} from 'vue'
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
import { resolveJoinFromValue } from '@/utils/tableCellValue'

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
  tableKey?: string // Unique identifier for the table (used for change tracking)

  // Features Enabled
  enableSearch?: boolean
  enableFilters?: boolean
  enableSelection?: boolean
  enableActions?: boolean
  enableBulkActions?: boolean

  // Excel-like Editing Mode
  enableExcelMode?: boolean // Enable Excel-like editing without row-level save/cancel
  isCellModified?: (rowId: string | number, fieldKey: string) => boolean // Callback to check if a cell is modified
  getModifiedValue?: (rowId: string | number, fieldKey: string) => any // Callback to get modified value for a cell

  // Optional row class (e.g. row-new, row-deleted for pending changes)
  getRowClass?: (item: any) => string

  // Read-only display (e.g. input-data/results in SectionView): show cells as plain text, no editing UI
  readOnlyDisplay?: boolean

  // Action Permissions
  canAdd?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canBulkUpload?: boolean
  canBulkEdit?: boolean
  /** When empty, defaults to post_bulk + overwrite_all (legacy). Parent should pass automation-driven ops. */
  bulkUploadOperations?: string[]
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

  // API date range filters
  dateRangeFilterConfigs?: Array<{
    paramGte: string
    paramLte: string
    filtersOn: string
    label: string
  }>
  dateRangeValues?: Record<string, { from: string; to: string }>
  dateRangeLoading?: boolean

  // Infinite scroll: when user scrolls to bottom, parent can load more (offset-based)
  hasMore?: boolean
  loadingMore?: boolean

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
  /** Live progress text for the bulk upload modal (async upload status + rows loaded). */
  uploadProgressMessage?: string
  downloading?: boolean

  // Inline Editing States
  editingRowId?: string | number | null
  editingTableKey?: string | null
  editingData?: any
  originalData?: any
  isEditingAnyRow?: boolean

  // Foreign key data loading
  loadTableData?: (tableName: string) => Promise<any[]>
  tableData?: Record<string, any[]>

  // Render as list of warning alerts (same style as SimpleList) instead of table
  displayAsAlertList?: boolean
  alertListMessageKey?: string
  headerOriginIndicators?: Record<
    string,
    { source: 'db' | 'file'; tooltip?: string }
  >
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  elevation: 1,
  headers: () => [],
  loading: false,
  tableTitle: '',
  searchPlaceholder: undefined,
  tableKey: '',
  enableSearch: true,
  enableFilters: true,
  enableSelection: false,
  enableActions: true,
  enableBulkActions: false,
  enableExcelMode: false,
  isCellModified: () => () => false,
  getModifiedValue: () => () => undefined,
  readOnlyDisplay: false,
  canAdd: false,
  canEdit: false,
  canDelete: false,
  canBulkUpload: false,
  canBulkEdit: false,
  bulkUploadOperations: () => [],
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
  dateRangeFilterConfigs: () => [],
  dateRangeValues: () => ({}),
  dateRangeLoading: false,
  hasMore: false,
  loadingMore: false,
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
  uploadProgressMessage: '',
  downloading: false,
  editingRowId: null,
  editingTableKey: null,
  editingData: () => ({}),
  originalData: () => ({}),
  isEditingAnyRow: false,
  displayAsAlertList: false,
  alertListMessageKey: 'message',
  headerOriginIndicators: () => ({}),
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
  (
    e: 'apply-date-range',
    payload: { key: string; from: string; to: string },
  ): void
  (e: 'reset-date-range', key: string): void
  (e: 'toggle-filters-panel', show: boolean): void
  (e: 'load-more'): void

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
  (e: 'bulk-edit'): void

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

  // Excel Mode Events
  (
    e: 'cell-change',
    tableKey: string,
    rowId: string | number,
    fieldKey: string,
    oldValue: any,
    newValue: any,
  ): void
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

/** Plain text cells at full contrast: read-only sections or tables without edit permission */
const usePlainReadOnlyCells = computed(
  () => props.readOnlyDisplay || !props.canEdit,
)

const resolvedBulkUploadOperations = computed(() => {
  const ops = props.bulkUploadOperations
  if (ops && ops.length > 0) return ops
  return ['post_bulk', 'overwrite_all']
})

// Local UI state only
const showFiltersPanel = ref(false)

// Date range (left of Search): local state, auto-apply when both from and to are set
const localDateRange = ref<Record<string, { from: string; to: string }>>({})
const dateRangeApplyDebounce = ref<ReturnType<typeof setTimeout> | null>(null)

watch(
  () => [props.dateRangeValues, props.dateRangeFilterConfigs] as const,
  ([vals, configs]) => {
    const next: Record<string, { from: string; to: string }> = {}
    for (const c of configs || []) {
      next[c.paramGte] = (vals || {})[c.paramGte] ?? { from: '', to: '' }
    }
    localDateRange.value = next
  },
  { immediate: true },
)

const getDateRangeFrom = (key: string) => localDateRange.value[key]?.from ?? ''
const getDateRangeTo = (key: string) => localDateRange.value[key]?.to ?? ''

const scheduleApplyDateRange = (key: string) => {
  if (dateRangeApplyDebounce.value) clearTimeout(dateRangeApplyDebounce.value)
  dateRangeApplyDebounce.value = setTimeout(() => {
    const cur = localDateRange.value[key]
    if (cur?.from && cur?.to) {
      emit('apply-date-range', { key, from: cur.from, to: cur.to })
    }
    dateRangeApplyDebounce.value = null
  }, 400)
}

const setDateRangeFrom = (key: string, v: string) => {
  const cur = localDateRange.value[key] ?? { from: '', to: '' }
  localDateRange.value = { ...localDateRange.value, [key]: { ...cur, from: v } }
  if (!v) emit('reset-date-range', key)
  else if (cur.to) scheduleApplyDateRange(key)
}

const setDateRangeTo = (key: string, v: string) => {
  const cur = localDateRange.value[key] ?? { from: '', to: '' }
  localDateRange.value = { ...localDateRange.value, [key]: { ...cur, to: v } }
  if (!v) emit('reset-date-range', key)
  else if (cur.from) scheduleApplyDateRange(key)
}

const hasDateRangeValue = (key: string) => {
  const cur = localDateRange.value[key]
  return !!(cur?.from || cur?.to)
}

const clearDateRange = (key: string) => {
  localDateRange.value = {
    ...localDateRange.value,
    [key]: { from: '', to: '' },
  }
  emit('reset-date-range', key)
}

// Critical refs for loading management
const forceRerender = ref(0)
const tableKey = ref(0)
/** Always follow parent loading; do not clear from item count (avoids empty join columns flash). */
const localLoading = computed(() => props.loading)
// Reentrancy guard: skip applyFijarRowClasses if a run is still in progress (avoids backlog when keep-alive re-activates)
const applyFijarRowClassesInProgress = ref(false)
// Debounce timer so we never run applyFijarRowClasses more than once per DEBOUNCE_MS (avoids main-thread flood)
const applyFijarRowClassesDebounceMs = 280
let applyFijarRowClassesDebounceTimer: ReturnType<typeof setTimeout> | null =
  null
// Refs for fijar listeners cleanup (interval, observer, scroll) so we can clear on deactivate/unmount and re-setup on activate
const fijarListenersRef = ref<{
  intervalId?: ReturnType<typeof setInterval>
  observer?: MutationObserver
  scrollElement?: Element
  scrollHandler?: () => void
}>({})

// Initialization complete

watch(
  () => props.loading,
  (newValue, oldValue) => {
    if (oldValue === true && newValue === false) {
      forceRerender.value++
      tableKey.value++
      // Apply row classes after loading finishes
      nextTick(() => {
        setTimeout(() => {
          scheduleApplyFijarRowClasses()
        }, 200)
      })
    }
  },
  { immediate: true },
)

// Bump `tableKey` only on the empty → non-empty transition (initial load or
// full dataset swap). Bumping it on every `props.items` change would remount
// `v-data-table-virtual` on incremental appends (e.g. infinite-scroll
// `loadMore`), which resets the scroll position to the top — confusing in
// any windowed flow.
watch(
  () => props.items,
  (newValue, oldValue) => {
    const newLen = newValue?.length ?? 0
    const oldLen = oldValue?.length ?? 0
    if (newLen > 0 && oldLen === 0) {
      tableKey.value++
    }
  },
  { immediate: true },
)

function clearFijarListeners() {
  if (applyFijarRowClassesDebounceTimer) {
    clearTimeout(applyFijarRowClassesDebounceTimer)
    applyFijarRowClassesDebounceTimer = null
  }
  const refs = fijarListenersRef.value
  if (refs.intervalId) {
    clearInterval(refs.intervalId)
    refs.intervalId = undefined
  }
  if (refs.observer) {
    refs.observer.disconnect()
    refs.observer = undefined
  }
  if (refs.scrollElement && refs.scrollHandler) {
    refs.scrollElement.removeEventListener('scroll', refs.scrollHandler)
    refs.scrollElement = undefined
    refs.scrollHandler = undefined
  }
}

/** Debounced scheduler: run applyFijarRowClasses once DEBOUNCE_MS after the last trigger to avoid main-thread flood. */
function scheduleApplyFijarRowClasses() {
  if (applyFijarRowClassesDebounceTimer)
    clearTimeout(applyFijarRowClassesDebounceTimer)
  applyFijarRowClassesDebounceTimer = setTimeout(() => {
    applyFijarRowClassesDebounceTimer = null
    runApplyFijarRowClasses()
  }, applyFijarRowClassesDebounceMs)
}

function setupFijarListeners() {
  clearFijarListeners()
  if (!tableContainer.value) return

  const scrollElement = tableContainer.value.querySelector('.v-table__wrapper')
  if (scrollElement) {
    const scrollHandler = () => {
      scheduleApplyFijarRowClasses()
      clearTimeout((scrollElement as any).__fijarScrollTimeout)
      ;(scrollElement as any).__fijarScrollTimeout = setTimeout(() => {
        scheduleApplyFijarRowClasses()
      }, 50)
    }
    scrollElement.addEventListener('scroll', scrollHandler, { passive: true })
    fijarListenersRef.value.scrollElement = scrollElement
    fijarListenersRef.value.scrollHandler = scrollHandler
  }

  const tbody =
    tableContainer.value.querySelector('.v-data-table-virtual tbody') ||
    tableContainer.value.querySelector('tbody')
  if (tbody) {
    const observer = new MutationObserver(() => {
      nextTick(() => scheduleApplyFijarRowClasses())
    })
    observer.observe(tbody, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    fijarListenersRef.value.observer = observer
  }

  const intervalId = setInterval(() => {
    if (tableContainer.value) scheduleApplyFijarRowClasses()
  }, 450)
  fijarListenersRef.value.intervalId = intervalId
}

const SCROLL_LOAD_MORE_THRESHOLD = 200
let loadMoreScrollEl: HTMLElement | null = null
let loadMoreScrollHandler: (() => void) | null = null
let loadMoreThrottleTimer: ReturnType<typeof setTimeout> | null = null

function setupLoadMoreScroll() {
  if (!tableContainer.value || props.displayAsAlertList) return
  const wrapper = tableContainer.value.querySelector(
    '.v-table__wrapper',
  ) as HTMLElement | null
  if (!wrapper || loadMoreScrollEl === wrapper) return
  loadMoreScrollEl = wrapper
  const check = () => {
    if (!props.hasMore || props.loadingMore) return
    const { scrollTop, clientHeight, scrollHeight } = wrapper
    if (scrollTop + clientHeight >= scrollHeight - SCROLL_LOAD_MORE_THRESHOLD) {
      emit('load-more')
    }
  }
  loadMoreScrollHandler = () => {
    if (loadMoreThrottleTimer) return
    loadMoreThrottleTimer = setTimeout(() => {
      loadMoreThrottleTimer = null
      check()
    }, 150)
  }
  wrapper.addEventListener('scroll', loadMoreScrollHandler, { passive: true })
}

function clearLoadMoreScroll() {
  if (loadMoreScrollEl && loadMoreScrollHandler) {
    loadMoreScrollEl.removeEventListener('scroll', loadMoreScrollHandler)
    loadMoreScrollEl = null
    loadMoreScrollHandler = null
  }
  if (loadMoreThrottleTimer) {
    clearTimeout(loadMoreThrottleTimer)
    loadMoreThrottleTimer = null
  }
}

onMounted(() => {
  if (props.items && props.items.length > 0) {
    tableKey.value++
  }
  nextTick(() => {
    setTimeout(() => {
      scheduleApplyFijarRowClasses()
      setTimeout(() => scheduleApplyFijarRowClasses(), 500)
    }, 300)
  })
  setupFijarListeners()
  nextTick(() => {
    setTimeout(setupLoadMoreScroll, 400)
  })
})

onActivated(() => {
  nextTick(() => {
    setupFijarListeners()
    setTimeout(() => scheduleApplyFijarRowClasses(), 100)
    setTimeout(setupLoadMoreScroll, 100)
  })
})

onDeactivated(() => {
  clearFijarListeners()
  clearLoadMoreScroll()
})

onBeforeUnmount(() => {
  clearFijarListeners()
  clearLoadMoreScroll()
  if (dateRangeApplyDebounce.value) {
    clearTimeout(dateRangeApplyDebounce.value)
    dateRangeApplyDebounce.value = null
  }
})

// Watch for items changes to update row classes
watch(
  () => props.items,
  () => {
    nextTick(() => {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scheduleApplyFijarRowClasses()
      }, 300)
    })
  },
  { deep: true, immediate: true },
)

// When items or hasMore change, (re)attach load-more scroll if wrapper is now in DOM
watch(
  () => [props.items?.length, props.hasMore] as const,
  () => {
    if (props.hasMore && props.items?.length) {
      nextTick(() => setTimeout(setupLoadMoreScroll, 100))
    }
  },
  { immediate: true },
)

// Watch for editing data changes to update row classes
watch(
  () => props.editingData,
  () => {
    nextTick(() => {
      setTimeout(() => {
        scheduleApplyFijarRowClasses()
      }, 50)
    })
  },
  { deep: true, immediate: true },
)

/**
 * Apply CSS classes to rows: Fijar (blue), row-new (green), row-deleted (red).
 * Uses DOM inspection like Fijar so styles apply reliably with virtual scroll.
 * Guarded to avoid re-entrancy when keep-alive re-activates and watchers fire in burst.
 * Called only from scheduleApplyFijarRowClasses (debounced).
 */
const runApplyFijarRowClasses = () => {
  if (!tableContainer.value) return
  if (applyFijarRowClassesInProgress.value) return
  applyFijarRowClassesInProgress.value = true
  try {
    const fijarHeader = safeHeaders.value.find((h) => isFijarColumn(h))

    // Try multiple selectors to find rows (same as Fijar)
    let rows = tableContainer.value.querySelectorAll(
      '.v-data-table-virtual tbody tr',
    )
    if (rows.length === 0) {
      rows = tableContainer.value.querySelectorAll(
        '.v-data-table-virtual .v-table tbody tr',
      )
    }
    if (rows.length === 0) {
      rows = tableContainer.value.querySelectorAll('tbody tr')
    }

    const backgroundColorFijar = 'rgba(241, 249, 253, 0.6)'
    const backgroundColorHover = 'rgba(241, 249, 253, 0.8)'
    const backgroundColorNew = 'rgba(76, 175, 80, 0.12)'
    const backgroundColorDeleted = 'rgba(198, 40, 40, 0.1)'

    // Build a single id→item index for the whole call. With virtual scroll
    // `rows` is ~50 DOM nodes but `safeItems.value` can be 500k+ — the old
    // per-row `safeItems.value.find()` was O(N × visible_rows) on every
    // debounced reapply, which is what froze the UI when entering tables
    // from a loaded execution.
    const itemsArr = safeItems.value
    const itemsById = new Map<string, any>()
    for (const it of itemsArr) {
      const rawId = it?.id ?? it?._id
      if (rawId != null) itemsById.set(String(rawId), it)
    }
    // Hoisted: previously recomputed inside per-row helpers.
    const idColumnIndex = safeHeaders.value.findIndex((h) => h.key === 'id')
    const headerKeys = safeHeaders.value.map((h) => h.key)
    const fijarColumnIndex = fijarHeader
      ? headerKeys.indexOf(fijarHeader.key)
      : -1
    const rowsArray = rows.length > 0 ? Array.from(rows) : []

    const resolveRowItem = (rowElement: HTMLElement, cells: NodeListOf<Element>): any => {
      const dataItemId = rowElement.getAttribute?.('data-item-id')
      if (dataItemId != null && dataItemId !== '') {
        const hit = itemsById.get(dataItemId)
        if (hit) return hit
      }
      if (cells.length > 0 && idColumnIndex >= 0 && cells[idColumnIndex]) {
        const rowId = (cells[idColumnIndex] as HTMLElement).textContent?.trim()
        if (rowId) {
          const hit = itemsById.get(rowId)
          if (hit) return hit
        }
      }
      const idx = rowsArray.indexOf(rowElement)
      if (idx >= 0 && idx < itemsArr.length) return itemsArr[idx]
      return null
    }

    const applyPendingRowClass = (
      rowElement: HTMLElement,
      cells: NodeListOf<Element>,
      item: any,
      fijarHeader: any,
    ): boolean => {
      rowElement.classList.remove('row-new', 'row-deleted')
      if (item && props.getRowClass) {
        const pendingClass = getRowClass(item)
        if (pendingClass.includes('row-new')) {
          rowElement.classList.add('row-new')
          rowElement.style.setProperty('background-color', backgroundColorNew, 'important')
          cells.forEach((cell: Element) => {
            ;(cell as HTMLElement).style.setProperty('background-color', 'transparent', 'important')
          })
          if (fijarHeader) {
            rowElement.classList.remove('row-fijar-active')
            rowElement.style.removeProperty('background-color')
          }
          return true
        }
        if (pendingClass.includes('row-deleted')) {
          rowElement.classList.add('row-deleted')
          rowElement.style.setProperty('background-color', backgroundColorDeleted, 'important')
          cells.forEach((cell: Element) => {
            ;(cell as HTMLElement).style.setProperty('background-color', 'transparent', 'important')
          })
          if (fijarHeader) {
            rowElement.classList.remove('row-fijar-active')
          }
          return true
        }
      }
      return false
    }

    const applyFijarActiveStyle = (rowElement: HTMLElement, cells: NodeListOf<Element>) => {
      rowElement.classList.add('row-fijar-active')
      rowElement.style.setProperty('background-color', backgroundColorFijar, 'important')
      cells.forEach((cell: Element) => {
        ;(cell as HTMLElement).style.setProperty('background-color', 'transparent', 'important')
      })
    }

    const clearFijarActiveStyle = (rowElement: HTMLElement) => {
      rowElement.classList.remove('row-fijar-active')
      rowElement.style.removeProperty('background-color')
    }

    const setFijarStyle = (
      rowElement: HTMLElement,
      cells: NodeListOf<Element>,
      isActive: boolean,
    ) => {
      if (isActive) {
        applyFijarActiveStyle(rowElement, cells)
      } else {
        clearFijarActiveStyle(rowElement)
      }
    }

    // Resolve the fijar state from the switch in the fijar column, when present.
    // Returns `null` when there is no switch to read (caller should fall back to item data).
    const resolveFijarStateFromSwitch = (cells: NodeListOf<Element>): boolean | null => {
      if (fijarColumnIndex < 0 || !cells[fijarColumnIndex]) return null
      const switchInCell = cells[fijarColumnIndex].querySelector(
        '.v-switch input[type="checkbox"]',
      ) as HTMLInputElement
      if (!switchInCell) return null
      return switchInCell.checked
    }

    const isFijarValueActive = (fijarVal: any): boolean =>
      fijarVal === true || fijarVal === 'true' || fijarVal === 1 || fijarVal === '1'

    const resolveRowIdFromCells = (cells: NodeListOf<Element>): string | undefined => {
      const cellToCheck =
        idColumnIndex >= 0 && cells[idColumnIndex] ? cells[idColumnIndex] : cells[0]
      return cellToCheck?.textContent?.trim()
    }

    const applyFijarSwitchInRow = (
      rowElement: HTMLElement,
      cells: NodeListOf<Element>,
    ): boolean => {
      const switchElement = rowElement.querySelector('.v-switch')
      if (!switchElement) return false
      const switchInput = switchElement.querySelector('input[type="checkbox"]') as HTMLInputElement
      if (!switchInput) return false
      if (switchInput.checked) {
        applyFijarActiveStyle(rowElement, rowElement.querySelectorAll('td'))
        const hoverEnter = () => {
          if (switchInput.checked) {
            rowElement.style.setProperty('background-color', backgroundColorHover, 'important')
          }
        }
        const hoverLeave = () => {
          if (switchInput.checked) {
            rowElement.style.setProperty('background-color', backgroundColorFijar, 'important')
          }
        }
        rowElement.addEventListener('mouseenter', hoverEnter)
        rowElement.addEventListener('mouseleave', hoverLeave)
        ;(rowElement as any).__fijarHoverEnter = hoverEnter
        ;(rowElement as any).__fijarHoverLeave = hoverLeave
      } else {
        rowElement.classList.remove('row-fijar-active')
        rowElement.style.removeProperty('background-color')
      }
      return true
    }

    const applyFijarByDataAttribute = (rowElement: HTMLElement): boolean => {
      const fijarValueEl = rowElement.querySelector('[data-fijar-value]')
      if (!fijarValueEl) return false
      const isFijarActive =
        (fijarValueEl as HTMLElement).dataset.fijarValue === 'true'
      if (isFijarActive) {
        applyFijarActiveStyle(rowElement, rowElement.querySelectorAll('td'))
      } else {
        rowElement.classList.remove('row-fijar-active')
        rowElement.style.removeProperty('background-color')
      }
      return true
    }

    const applyFijarByItemData = (
      rowElement: HTMLElement,
      cells: NodeListOf<Element>,
      fijarHeader: any,
    ) => {
      if (cells.length === 0) return

      const switchState = resolveFijarStateFromSwitch(cells)
      if (switchState !== null) {
        setFijarStyle(rowElement, cells, switchState)
        return
      }

      const rowId = resolveRowIdFromCells(cells)
      if (!rowId) return

      // O(1) lookup against the index built once per debounced reapply.
      const matchedItem = itemsById.get(rowId)
      if (!matchedItem) return

      setFijarStyle(rowElement, cells, isFijarValueActive(matchedItem[fijarHeader.key]))
    }

    rows.forEach((row: Element) => {
      const rowElement = row as HTMLElement
      const cells = rowElement.querySelectorAll('td')

      // Resolve item for this row: prefer data-item-id (set by getRowProps), then id cell, then index
      const item = resolveRowItem(rowElement, cells)

      // Apply row-new / row-deleted (same DOM approach as Fijar: class + inline style)
      const handled = applyPendingRowClass(rowElement, cells, item, fijarHeader)
      if (handled) return

      rowElement.style.removeProperty('background-color')

      // Fijar logic (only when column exists)
      if (!fijarHeader) return

      // Remove existing hover listeners to avoid duplicates
      const existingHoverEnter = (rowElement as any).__fijarHoverEnter
      const existingHoverLeave = (rowElement as any).__fijarHoverLeave
      if (existingHoverEnter) {
        rowElement.removeEventListener('mouseenter', existingHoverEnter)
      }
      if (existingHoverLeave) {
        rowElement.removeEventListener('mouseleave', existingHoverLeave)
      }

      // First, try to find the switch directly in the row
      if (applyFijarSwitchInRow(rowElement, cells)) return

      // Second, try to find by data attribute
      if (applyFijarByDataAttribute(rowElement)) return

      // Third, try to match by item data (cells already declared at top of loop)
      applyFijarByItemData(rowElement, cells, fijarHeader)
    })
  } finally {
    applyFijarRowClassesInProgress.value = false
  }
}

// Watch for inline editing to load selector options
watch(
  () => props.editingRowId,
  (newValue) => {
    if (newValue) {
      // Load selector options when starting inline edit
      loadInlineSelectorOptions()
    } else {
      // When editing ends, update row classes
      nextTick(() => {
        setTimeout(() => {
          scheduleApplyFijarRowClasses()
        }, 200)
      })
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

/**
 * Build filterable fields directly from the currently visible table headers.
 * This avoids stale/cached field lists from previous tables.
 */
const visibleAvailableFilterFields = computed(() => {
  return safeHeaders.value
    .filter((header) => header.key !== 'selection' && header.filterable !== false)
    .map((header) => ({
      key: header.key ?? header.value,
      title: header.title ?? String(header.key ?? header.value ?? ''),
      type: header.type ?? 'string',
      filterable: true,
    }))
})

const getHeaderOriginIndicator = (
  key: string,
): { source: 'db' | 'file'; tooltip?: string } | null => {
  if (!key || !props.headerOriginIndicators) return null
  return props.headerOriginIndicators[key] ?? null
}

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
      rightIcon: undefined,
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

const handleApplyDateRange = (payload: {
  key: string
  from: string
  to: string
}) => {
  emit('apply-date-range', payload)
}

const handleResetDateRange = (key: string) => {
  emit('reset-date-range', key)
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

const updateInlineField = (
  field: string,
  value: any,
  rowIdOverride?: string | number,
  oldValueOverride?: any,
) => {
  // Get current editing data
  const currentEditingData = { ...props.editingData }

  // Resolve row id and old value: when toggling Fijar from display mode we pass them explicitly
  // to avoid using stale props.editingRowId (Vue may not have updated the prop yet)
  const rowId = rowIdOverride ?? props.editingRowId
  const editingItem =
    rowId == null ? null : props.items.find((i: any) => i.id === rowId)
  const oldValue =
    oldValueOverride ??
    (editingItem == null
      ? currentEditingData[field]
      : getCellDisplayValue(editingItem, field))

  // Update the field value
  currentEditingData[field] = value

  // Update dependent fields using the composable logic
  formFieldsComposable.updateDependentFields(
    field,
    value,
    currentEditingData,
  )

  // Emit the updated data - the parent will handle updating editingData
  emit('update-inline-field', field, value)

  // In Excel mode, emit cell-change event for change tracking
  if (props.enableExcelMode && props.tableKey && rowId != null) {
    emit('cell-change', props.tableKey, rowId, field, oldValue, value)
  }

  // If Fijar column was updated, refresh row classes immediately and after a delay
  const fijarHeader = safeHeaders.value.find((h) => isFijarColumn(h))
  if (fijarHeader && field === fijarHeader.key) {
    nextTick(() => {
      scheduleApplyFijarRowClasses()
      // Also apply after a short delay to ensure DOM is updated
      setTimeout(() => {
        scheduleApplyFijarRowClasses()
      }, 150)
    })
  }
}

const isRowEditing = (itemId: string | number): boolean => {
  if (props.editingRowId !== itemId) return false
  // When multiple tables (tabs), only show editing for the current table
  if (props.editingTableKey != null && props.tableKey) {
    return props.editingTableKey === props.tableKey
  }
  return true
}

/**
 * Get the display value for a cell, considering pending modifications.
 * In Excel mode, returns the modified value if the cell has been changed.
 * For joinFrom/dependent columns, resolves FK id to display text from referenced table when the row has no joined value (e.g. pending creates).
 */
const getCellDisplayValueForHeader = (item: any, header: any): any => {
  const fieldKey = header?.key
  if (!fieldKey) return undefined
  // If in Excel mode and cell is modified, get the modified value
  if (props.enableExcelMode && props.isCellModified(item.id, fieldKey)) {
    const modifiedValue = props.getModifiedValue(item.id, fieldKey)
    if (modifiedValue !== undefined) {
      return modifiedValue
    }
  }
  let value = item[fieldKey]
  // Resolve joinFrom display when value is missing but we have FK (e.g. pending create rows)
  if (
    (value === undefined || value === null || value === '') &&
    header?.joinFrom &&
    header?.foreignKeyField
  ) {
    const resolved = resolveJoinFromValue(item, header, props.tableData)
    if (resolved !== undefined) value = resolved
  }
  return value
}

/**
 * Get the display value for a cell by field key (used when header is not available, e.g. inline edit state).
 */
const getCellDisplayValue = (item: any, fieldKey: string): any => {
  if (props.enableExcelMode && props.isCellModified(item.id, fieldKey)) {
    const modifiedValue = props.getModifiedValue(item.id, fieldKey)
    if (modifiedValue !== undefined) {
      return modifiedValue
    }
  }
  return item[fieldKey]
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
 * Check if a header is a date, datetime, or time field (string format in schema)
 */
const isDateLikeField = (header: any): boolean => {
  const fieldType = getFieldType(header.key)
  return ['date', 'datetime', 'time'].includes(fieldType)
}

/**
 * Get HTML input type for a header (date, datetime-local, time, number, text)
 */
const getInputTypeForHeader = (header: any): string => {
  return formFieldsComposable.getInputType(getFieldType(header.key))
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
 * Check if a header should render as a switch (Fijar column or renderAsSwitch flag)
 */
const isFijarColumn = (header: any): boolean => {
  if (!header || !header.key) return false
  if (header.renderAsSwitch) return true
  const key = String(header.key).toLowerCase()
  return key === 'fijar'
}

/**
 * When header has cellDisabledKey, the cell is disabled if the row has that property truthy.
 * Used for per-row disabled state (e.g. ETL "From DB" switch when allow_load_from_db is false).
 */
const isCellDisabledByRow = (item: any, header: any): boolean => {
  const key = header?.cellDisabledKey
  if (!key || item == null) return false
  return Boolean(item[key])
}

/**
 * Get row class: optional parent override (e.g. row-new, row-deleted) + Fijar column
 */
const getRowClass = (item: any): string => {
  const parts: string[] = []
  const custom = props.getRowClass?.(item)
  if (custom) parts.push(custom)
  const fijarHeader = safeHeaders.value.find((h) => isFijarColumn(h))
  if (fijarHeader) {
    const fijarValue = item[fijarHeader.key]
    if (fijarValue === true || fijarValue === 'true' || fijarValue === 1) {
      parts.push('row-fijar-active')
    }
  }
  return parts.filter(Boolean).join(' ')
}

/**
 * Row props for v-data-table-virtual (Vuetify 3): applies row class and data-item-id
 * so DOM-based row styling (row-new / row-deleted) can resolve the correct item.
 */
const getRowProps = (data: { item: any }) => {
  const cls = getRowClass(data.item)
  const itemId =
    data.item != null && data.item.id != null ? String(data.item.id) : ''
  return {
    ...(cls ? { class: cls } : {}),
    ...(itemId ? { 'data-item-id': itemId } : {}),
  }
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
          valueNone: (header as any).valueNone,
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

defineExpose({ getRowProps })
</script>

<style src="@/assets/styles/components/core/CoreTable.css"></style>
<style src="@/assets/styles/components/core/CoreTableInlineEdit.css"></style>
<style scoped>
/* Modo lista de alertas: mismo estilo que SimpleList (alertas naranjas) */
.core-table-alert-list.simple-list-content {
  max-height: calc(100vh - 320px);
  overflow-y: auto;
  padding-bottom: 8px;
}
.core-table-alert-list .simple-list-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.core-table-alert-list .simple-list-item {
  margin: 0;
}
.core-table-alert-list .simple-list-item__text {
  font-size: 13px !important;
  line-height: 1.6;
  word-wrap: break-word;
  white-space: normal;
  color: inherit;
}

/* Anchor the absolutely-positioned overlay below to the table container. */
.table-container {
  position: relative;
}

.core-table-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background-color: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(1px);
  pointer-events: all;
}

.core-table-loading-overlay__text {
  font-size: 13px;
  font-weight: 500;
  color: var(--subtitle, rgba(0, 0, 0, 0.6));
}

.core-table-loading-fade-enter-active,
.core-table-loading-fade-leave-active {
  transition: opacity 0.15s ease-out;
}
.core-table-loading-fade-enter-from,
.core-table-loading-fade-leave-to {
  opacity: 0;
}
</style>
