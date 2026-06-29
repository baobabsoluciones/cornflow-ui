<template>
  <CoreTable
    :items="tableData.items.value"
    :headers="tableData.headers.value"
    :loading="tableData.loading.value"
    :table-title="tableData.tableTitle.value"
    :search-placeholder="tableData.searchPlaceholder.value"
    :enable-search="tableData.enableSearch.value"
    :enable-filters="tableData.enableFilters.value"
    :enable-selection="tableData.enableSelection.value"
    :enable-actions="tableData.enableActions.value"
    :enable-bulk-actions="tableData.enableBulkActions.value"
    :read-only-display="isReadOnlyDataSection"
    :table-key="tableKey"
    :enable-excel-mode="tableData.enableExcelMode.value"
    :is-cell-modified="tableData.isCellModified"
    :get-modified-value="tableData.getModifiedValue"
    :get-row-class="withRowClass ? tableData.getRowClass : undefined"
    :can-add="tableData.canAdd.value"
    :can-edit="tableData.canEdit.value"
    :can-delete="tableData.canDelete.value"
    :can-bulk-upload="tableData.canBulkUpload.value"
    :can-bulk-edit="tableData.canEdit.value"
    :bulk-upload-operations="tableData.bulkUploadAvailableOperations.value"
    :can-download-excel="tableData.canDownloadExcel.value"
    :search-value="tableData.searchValue.value"
    :active-filters="tableData.activeFilters.value"
    :selected-items="tableData.selectedItems.value"
    :available-filter-fields="tableData.availableFilterFields.value"
    :show-add-edit-modal="tableData.showAddEditModal.value"
    :show-delete-dialog="tableData.showDeleteDialog.value"
    :show-bulk-delete-dialog="tableData.showBulkDeleteDialog.value"
    :show-bulk-upload-modal="tableData.showBulkUploadModal.value"
    :form-fields="tableData.formFields.value"
    :form-data="tableData.formData.value"
    :is-editing="tableData.isEditing.value"
    :saving="tableData.saving.value"
    :deleting="tableData.deleting.value"
    :bulk-deleting="tableData.bulkDeleting.value"
    :uploading="tableData.uploading.value"
    :upload-progress-message="tableData.uploadProgressMessage.value"
    :downloading="tableData.downloading.value"
    :editing-row-id="tableData.editingRowId.value"
    :editing-data="tableData.editingData.value"
    :original-data="tableData.originalData.value"
    :is-editing-any-row="tableData.isEditingAnyRow.value"
    :load-table-data="tableData.loadTableData"
    :table-data="tableData.tableData.value"
    :header-origin-indicators="headerOriginIndicators"
    @search="tableData.handleSearch"
    :get-operators-for-field-type="tableData.getOperatorsForFieldType"
    :get-operator-text="tableData.getOperatorText"
    :operator-needs-value="tableData.operatorNeedsValue"
    :operator-needs-second-value="tableData.operatorNeedsSecondValue"
    :generate-filter-id="tableData.generateFilterId"
    :date-range-filter-configs="tableData.apiDateRangeFilterConfigs.value"
    :date-range-values="tableData.dateRangeValues.value"
    :date-range-loading="tableData.loading.value"
    :has-more="tableData.hasMore.value"
    :loading-more="tableData.loadingMore.value"
    @load-more="tableData.loadMore"
    @add-filter="tableData.handleAddFilter"
    @remove-filter="tableData.handleRemoveFilter"
    @clear-all-filters="tableData.handleClearAllFilters"
    @apply-date-range="
      (p) =>
        tableData.handleApplyDateRange(p.key, { from: p.from, to: p.to })
    "
    @reset-date-range="tableData.handleResetDateRange"
    @toggle-filters-panel="tableData.handleToggleFiltersPanel"
    @select-item="tableData.handleSelectItem"
    @select-all="tableData.handleSelectAll"
    @clear-selection="tableData.handleClearSelection"
    @add-item="tableData.handleAddItem"
    @edit-item="tableData.handleEditItem"
    @delete-item="tableData.handleDeleteItem"
    @bulk-delete="tableData.handleBulkDelete"
    @save-item="tableData.handleSaveItem"
    @cancel-edit="() => (tableData.showAddEditModal.value = false)"
    @bulk-upload="tableData.handleBulkUpload"
    @bulk-edit="() => emit('bulk-edit')"
    @download-excel="tableData.handleDownloadExcel"
    @confirm-delete="tableData.handleConfirmDelete"
    @confirm-bulk-delete="tableData.handleConfirmBulkDelete"
    @cancel-delete="() => (tableData.showDeleteDialog.value = false)"
    @cancel-bulk-delete="() => (tableData.showBulkDeleteDialog.value = false)"
    @cancel-bulk-upload="() => (tableData.showBulkUploadModal.value = false)"
    @start-inline-edit="tableData.startInlineEdit"
    @save-inline-edit="tableData.saveInlineEdit"
    @cancel-inline-edit="tableData.cancelInlineEdit"
    @update-inline-field="tableData.updateInlineField"
    @cell-change="tableData.handleCellChange"
    @update:searchValue="tableData.handleSearch"
    @update:activeFilters="
      (filters) => (tableData.activeFilters.value = filters)
    "
    @update:selectedItems="
      (items) => (tableData.selectedItems.value = items)
    "
    @update:showAddEditModal="
      (show) => (tableData.showAddEditModal.value = show)
    "
    @update:showDeleteDialog="
      (show) => (tableData.showDeleteDialog.value = show)
    "
    @update:showBulkDeleteDialog="
      (show) => (tableData.showBulkDeleteDialog.value = show)
    "
    @update:showBulkUploadModal="
      (show) => (tableData.showBulkUploadModal.value = show)
    "
    @update:formData="(data) => (tableData.formData.value = data)"
  />
</template>

<script setup lang="ts">
import CoreTable from '@cornflow-ui/core/components/core/table/CoreTable.vue'

/**
 * Presentational wrapper for the single-table (non-group) view.
 *
 * Renders the CoreTable bound to the `tableData` composable instance.
 * Extracted verbatim from SectionView.vue, where this markup appeared twice
 * (widgets layout vs no-widgets layout). The two copies were byte-identical
 * except that the widgets-layout copy bound `:get-row-class`; this is
 * preserved via the `withRowClass` prop (default false). Binding `undefined`
 * is equivalent to omitting the attribute because CoreTable guards every use
 * of `getRowClass` with optional chaining.
 */
withDefaults(
  defineProps<{
    /** Live `useTableData` instance (tableData) — refs read via `.value`. */
    tableData: any
    /** Whether the section displays data read-only. */
    isReadOnlyDataSection: boolean
    /** Effective table key for the single table. */
    tableKey: any
    /** ETL header origin indicators for the single table. */
    headerOriginIndicators: Record<
      string,
      { source: 'db' | 'file'; tooltip?: string }
    >
    /** Bind `:get-row-class` (true in the dashboard/widgets layout only). */
    withRowClass?: boolean
  }>(),
  {
    withRowClass: false,
  },
)

const emit = defineEmits<{
  'bulk-edit': []
}>()
</script>
