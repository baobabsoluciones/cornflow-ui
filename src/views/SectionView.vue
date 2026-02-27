<template>
  <div class="view-container section-view">
    <!-- Loading state while configurations are being loaded -->
    <div v-if="!configurationsReady" class="loading-container">
      <v-progress-circular indeterminate color="primary" size="64" />
      <p class="mt-4">{{ $t('executionTable.loading') }}</p>
    </div>

    <!-- Main content when configurations are ready -->
    <template v-else>
      <CoreTitleView
        :icon="currentIcon"
        :title="title"
        :description="description"
        :dropdown-items="dropdownMenuItems"
        @dropdown-item-click="handleDropdownItemClick"
      />

      <!-- Pending changes bar (master tables / configuration only) -->
      <div
        v-if="isConfigurationSection && hasPendingChanges"
        class="pending-changes-bar mt-3"
      >
        <v-chip color="success" variant="tonal" size="small" class="mr-2">
          <v-icon start size="small">mdi-pencil</v-icon>
          {{
            $t('pendingChanges.changesIndicator', {
              count: pendingChangesCount,
            })
          }}
        </v-chip>
        <v-btn
          color="success"
          variant="flat"
          size="small"
          @click="openMasterTablePendingModal"
        >
          <v-icon start size="small">mdi-eye</v-icon>
          {{ $t('pendingChanges.reviewChanges') }}
        </v-btn>
      </div>

      <!-- Single table view (for null group or individual tables) -->
      <!-- Check if it's a primitive array and render SimpleList -->
      <div
        v-if="!isGroupView && tableData.isPrimitiveArray.value"
        class="table-section mt-5"
      >
        <SimpleList
          :items="tableData.items.value"
          :loading="tableData.loading.value"
          :search-value="tableData.searchValue.value"
          :enable-search="tableData.enableSearch.value"
          :can-download-excel="tableData.canDownloadExcel.value"
          :search-placeholder="tableData.searchPlaceholder.value"
          @search="tableData.handleSearch"
          @update:searchValue="tableData.handleSearch"
          @download-excel="tableData.handleDownloadExcel"
        />
      </div>

      <!-- Regular table view for non-primitive arrays -->
      <div v-else-if="!isGroupView" class="table-section mt-5" :class="{ 'table-section--dashboard': shouldShowWidgets && hasActualWidgets }">
        <!-- Table with widgets layout (70/30) - only if there are actual widgets -->
        <div
          v-if="shouldShowWidgets && hasActualWidgets"
          class="dashboard-layout"
        >
          <!-- Top row: table (70%) + side widgets (30%) -->
          <div class="table-with-widgets">
            <div class="table-column">
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
                :table-key="effectiveTableKey"
                :enable-excel-mode="tableData.enableExcelMode.value"
                :is-cell-modified="tableData.isCellModified"
                :get-modified-value="tableData.getModifiedValue"
                :get-row-class="tableData.getRowClass"
                :can-add="tableData.canAdd.value"
                :can-edit="tableData.canEdit.value"
                :can-delete="tableData.canDelete.value"
                :can-bulk-upload="tableData.canBulkUpload.value"
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
                :downloading="tableData.downloading.value"
                :editing-row-id="tableData.editingRowId.value"
                :editing-data="tableData.editingData.value"
                :original-data="tableData.originalData.value"
                :is-editing-any-row="tableData.isEditingAnyRow.value"
                :load-table-data="tableData.loadTableData"
                :table-data="tableData.tableData.value"
                @search="tableData.handleSearch"
                :get-operators-for-field-type="tableData.getOperatorsForFieldType"
                :get-operator-text="tableData.getOperatorText"
                :operator-needs-value="tableData.operatorNeedsValue"
                :operator-needs-second-value="tableData.operatorNeedsSecondValue"
                :generate-filter-id="tableData.generateFilterId"
                :date-range-filter-configs="tableData.apiDateRangeFilterConfigs.value"
                :date-range-values="tableData.dateRangeValues.value"
                :date-range-loading="tableData.loading.value"
                @add-filter="tableData.handleAddFilter"
                @remove-filter="tableData.handleRemoveFilter"
                @clear-all-filters="tableData.handleClearAllFilters"
                @apply-date-range="(p) => tableData.handleApplyDateRange(p.key, { from: p.from, to: p.to })"
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
                @download-excel="tableData.handleDownloadExcel"
                @confirm-delete="tableData.handleConfirmDelete"
                @confirm-bulk-delete="tableData.handleConfirmBulkDelete"
                @cancel-delete="() => (tableData.showDeleteDialog.value = false)"
                @cancel-bulk-delete="
                  () => (tableData.showBulkDeleteDialog.value = false)
                "
                @cancel-bulk-upload="
                  () => (tableData.showBulkUploadModal.value = false)
                "
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
            </div>
            <!-- Widgets column (30%) -->
            <div class="widgets-column">
              <!-- KPIs section (2 per row) -->
              <div v-if="kpiWidgets.length > 0" class="kpis-section">
                <div
                  v-for="(widget, index) in kpiWidgets"
                  :key="`kpi-${index}`"
                  class="kpi-item"
                >
                  <component
                    :is="getWidgetComponent(widget.type)"
                    :title="widget.title"
                    :config="widget.config"
                  />
                </div>
              </div>
              <!-- Charts section (1 per row) -->
              <div v-if="sideCharts.length > 0" class="charts-section">
                <div
                  v-for="(widget, index) in sideCharts"
                  :key="`chart-${index}`"
                  class="chart-item"
                >
                  <component
                    :is="getWidgetComponent(widget.type)"
                    :title="widget.title"
                    :config="widget.config"
                  />
                </div>
              </div>
              <!-- Custom widgets section (side) -->
              <div v-if="customSideWidgets.length > 0" class="charts-section">
                <div
                  v-for="(widget, index) in customSideWidgets"
                  :key="`custom-side-${index}`"
                  class="chart-item"
                >
                  <component
                    v-if="tableKey.value && executionType.value"
                    :is="getWidgetComponent(widget.component)"
                    :table-data="getTableData(tableKey.value)"
                    :table-key="tableKey.value"
                    :execution-data="getExecutionData()"
                    :execution-type="executionType.value"
                    v-bind="widget.props || {}"
                  />
                </div>
              </div>
            </div>
          </div>
          <!-- Additional charts below table (100% width) -->
          <div
            v-if="
              shouldShowWidgets &&
              (bottomCharts.length > 0 || customBottomWidgets.length > 0)
            "
            class="bottom-charts-section"
          >
            <div
              v-for="(widget, index) in bottomCharts"
              :key="`bottom-chart-${index}`"
              class="bottom-chart-item"
            >
              <component
                :is="getWidgetComponent(widget.type)"
                :title="widget.title"
                :config="widget.config"
              />
            </div>
            <div
              v-for="(widget, index) in customBottomWidgets"
              :key="`custom-bottom-${index}`"
              class="bottom-chart-item"
            >
              <component
                v-if="tableKey.value && executionType.value"
                :is="getWidgetComponent(widget.component)"
                :table-data="getTableData(tableKey.value)"
                :table-key="tableKey.value"
                :execution-data="getExecutionData()"
                :execution-type="executionType.value"
                v-bind="widget.props || {}"
              />
            </div>
          </div>
        </div>
        <!-- Regular table without widgets -->
        <CoreTable
          v-else
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
          :table-key="effectiveTableKey"
          :enable-excel-mode="tableData.enableExcelMode.value"
          :is-cell-modified="tableData.isCellModified"
          :get-modified-value="tableData.getModifiedValue"
          :can-add="tableData.canAdd.value"
          :can-edit="tableData.canEdit.value"
          :can-delete="tableData.canDelete.value"
          :can-bulk-upload="tableData.canBulkUpload.value"
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
          :downloading="tableData.downloading.value"
          :editing-row-id="tableData.editingRowId.value"
          :editing-data="tableData.editingData.value"
          :original-data="tableData.originalData.value"
          :is-editing-any-row="tableData.isEditingAnyRow.value"
          :load-table-data="tableData.loadTableData"
          :table-data="tableData.tableData.value"
          @search="tableData.handleSearch"
          :get-operators-for-field-type="tableData.getOperatorsForFieldType"
          :get-operator-text="tableData.getOperatorText"
          :operator-needs-value="tableData.operatorNeedsValue"
          :operator-needs-second-value="tableData.operatorNeedsSecondValue"
          :generate-filter-id="tableData.generateFilterId"
          :date-range-filter-configs="tableData.apiDateRangeFilterConfigs.value"
          :date-range-values="tableData.dateRangeValues.value"
          :date-range-loading="tableData.loading.value"
          @add-filter="tableData.handleAddFilter"
          @remove-filter="tableData.handleRemoveFilter"
          @clear-all-filters="tableData.handleClearAllFilters"
          @apply-date-range="(p) => tableData.handleApplyDateRange(p.key, { from: p.from, to: p.to })"
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
          @download-excel="tableData.handleDownloadExcel"
          @confirm-delete="tableData.handleConfirmDelete"
          @confirm-bulk-delete="tableData.handleConfirmBulkDelete"
          @cancel-delete="() => (tableData.showDeleteDialog.value = false)"
          @cancel-bulk-delete="
            () => (tableData.showBulkDeleteDialog.value = false)
          "
          @cancel-bulk-upload="
            () => (tableData.showBulkUploadModal.value = false)
          "
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
      </div>

      <!-- Group view with tabs (for grouped tables) -->
      <div v-else class="table-section mt-5">
        <v-card class="table-card">
          <CoreTabs
            v-model="selectedTabIndex"
            color="var(--primary-variant)"
            @update:model-value="handleTabChange"
          >
            <CoreTab
              v-for="(table, index) in tabsData"
              :key="table.value"
              :value="index"
            >
              {{ table.text }}
            </CoreTab>
          </CoreTabs>

          <v-card-text class="table-card-content">
            <!-- Table with widgets layout (70/30) for group view - only if there are actual widgets -->
            <div
              v-if="shouldShowWidgets && hasActualWidgets"
              class="table-with-widgets"
            >
              <div class="table-column">
                <!-- Check if it's a primitive array and render SimpleList -->
                <SimpleList
                  v-if="selectedTableData.isPrimitiveArray.value"
                  :items="selectedTableData.items.value"
                  :loading="selectedTableData.loading.value"
                  :search-value="selectedTableData.searchValue.value"
                  :enable-search="selectedTableData.enableSearch.value"
                  :can-download-excel="selectedTableData.canDownloadExcel.value"
                  :search-placeholder="
                    selectedTableData.searchPlaceholder.value
                  "
                  :elevation="0"
                  @search="selectedTableData.handleSearch"
                  @update:searchValue="selectedTableData.handleSearch"
                  @download-excel="selectedTableData.handleDownloadExcel"
                />

                <!-- Regular table view for non-primitive arrays -->
                <CoreTable
                  v-else
                  :items="selectedTableData.items.value"
                  :headers="selectedTableData.headers.value"
                  :loading="selectedTableData.loading.value"
                  :table-title="selectedTableData.tableTitle.value"
                  :search-placeholder="
                    selectedTableData.searchPlaceholder.value
                  "
                  :elevation="0"
                  :display-as-alert-list="
                    selectedTableData.isValidationMessageList?.value ?? false
                  "
                  alert-list-message-key="message"
                  :enable-search="selectedTableData.enableSearch.value"
                  :enable-filters="selectedTableData.enableFilters.value"
                  :enable-selection="selectedTableData.enableSelection.value"
                  :enable-actions="selectedTableData.enableActions.value"
                  :enable-bulk-actions="
                    selectedTableData.enableBulkActions.value
                  "
                  :read-only-display="isReadOnlyDataSection"
                  :table-key="selectedTable"
                  :enable-excel-mode="selectedTableData.enableExcelMode.value"
                  :is-cell-modified="selectedTableData.isCellModified"
                  :get-modified-value="selectedTableData.getModifiedValue"
                  :get-row-class="selectedTableData.getRowClass"
                  :can-add="selectedTableData.canAdd.value"
                  :can-edit="selectedTableData.canEdit.value"
                  :can-delete="selectedTableData.canDelete.value"
                  :can-bulk-upload="selectedTableData.canBulkUpload.value"
                  :can-download-excel="selectedTableData.canDownloadExcel.value"
                  :search-value="selectedTableData.searchValue.value"
                  :active-filters="selectedTableData.activeFilters.value"
                  :selected-items="selectedTableData.selectedItems.value"
                  :available-filter-fields="
                    selectedTableData.availableFilterFields.value
                  "
                  :show-add-edit-modal="
                    selectedTableData.showAddEditModal.value
                  "
                  :show-delete-dialog="selectedTableData.showDeleteDialog.value"
                  :show-bulk-delete-dialog="
                    selectedTableData.showBulkDeleteDialog.value
                  "
                  :show-bulk-upload-modal="
                    selectedTableData.showBulkUploadModal.value
                  "
                  :form-fields="selectedTableData.formFields.value"
                  :form-data="selectedTableData.formData.value"
                  :is-editing="selectedTableData.isEditing.value"
                  :saving="selectedTableData.saving.value"
                  :deleting="selectedTableData.deleting.value"
                  :bulk-deleting="selectedTableData.bulkDeleting.value"
                  :uploading="selectedTableData.uploading.value"
                  :downloading="selectedTableData.downloading.value"
                  :editing-row-id="selectedTableData.editingRowId.value"
                  :editing-data="selectedTableData.editingData.value"
                  :original-data="selectedTableData.originalData.value"
                  :is-editing-any-row="selectedTableData.isEditingAnyRow.value"
                  :load-table-data="selectedTableData.loadTableData"
                  :table-data="selectedTableData.tableData.value"
                  @search="selectedTableData.handleSearch"
                  :get-operators-for-field-type="
                    selectedTableData.getOperatorsForFieldType
                  "
                  :get-operator-text="selectedTableData.getOperatorText"
                  :operator-needs-value="selectedTableData.operatorNeedsValue"
                  :operator-needs-second-value="
                    selectedTableData.operatorNeedsSecondValue
                  "
                  :generate-filter-id="selectedTableData.generateFilterId"
                  @add-filter="selectedTableData.handleAddFilter"
                  @remove-filter="selectedTableData.handleRemoveFilter"
                  @clear-all-filters="selectedTableData.handleClearAllFilters"
                  @toggle-filters-panel="
                    selectedTableData.handleToggleFiltersPanel
                  "
                  @select-item="selectedTableData.handleSelectItem"
                  @select-all="selectedTableData.handleSelectAll"
                  @clear-selection="selectedTableData.handleClearSelection"
                  @add-item="selectedTableData.handleAddItem"
                  @edit-item="selectedTableData.handleEditItem"
                  @delete-item="selectedTableData.handleDeleteItem"
                  @bulk-delete="selectedTableData.handleBulkDelete"
                  @save-item="selectedTableData.handleSaveItem"
                  @cancel-edit="
                    () => (selectedTableData.showAddEditModal.value = false)
                  "
                  @bulk-upload="selectedTableData.handleBulkUpload"
                  @download-excel="selectedTableData.handleDownloadExcel"
                  @confirm-delete="selectedTableData.handleConfirmDelete"
                  @confirm-bulk-delete="
                    selectedTableData.handleConfirmBulkDelete
                  "
                  @cancel-delete="
                    () => (selectedTableData.showDeleteDialog.value = false)
                  "
                  @cancel-bulk-delete="
                    () => (selectedTableData.showBulkDeleteDialog.value = false)
                  "
                  @cancel-bulk-upload="
                    () => (selectedTableData.showBulkUploadModal.value = false)
                  "
                  @start-inline-edit="selectedTableData.startInlineEdit"
                  @save-inline-edit="selectedTableData.saveInlineEdit"
                  @cancel-inline-edit="selectedTableData.cancelInlineEdit"
                  @update-inline-field="selectedTableData.updateInlineField"
                  @cell-change="selectedTableData.handleCellChange"
                  @update:searchValue="selectedTableData.handleSearch"
                  @update:activeFilters="
                    (filters) =>
                      (selectedTableData.activeFilters.value = filters)
                  "
                  @update:selectedItems="
                    (items) => (selectedTableData.selectedItems.value = items)
                  "
                  @update:showAddEditModal="
                    (show) => (selectedTableData.showAddEditModal.value = show)
                  "
                  @update:showDeleteDialog="
                    (show) => (selectedTableData.showDeleteDialog.value = show)
                  "
                  @update:showBulkDeleteDialog="
                    (show) =>
                      (selectedTableData.showBulkDeleteDialog.value = show)
                  "
                  @update:showBulkUploadModal="
                    (show) =>
                      (selectedTableData.showBulkUploadModal.value = show)
                  "
                  @update:formData="
                    (data) => (selectedTableData.formData.value = data)
                  "
                />
              </div>
              <!-- Widgets column (30%) -->
              <div class="widgets-column">
                <!-- KPIs section (2 per row) -->
                <div v-if="selectedKpiWidgets.length > 0" class="kpis-section">
                  <div
                    v-for="(widget, index) in selectedKpiWidgets"
                    :key="`kpi-${index}`"
                    class="kpi-item"
                  >
                    <component
                      :is="getWidgetComponent(widget.type)"
                      :title="widget.title"
                      :config="widget.config"
                    />
                  </div>
                </div>
                <!-- Charts section (1 per row) -->
                <div
                  v-if="selectedSideCharts.length > 0"
                  class="charts-section"
                >
                  <div
                    v-for="(widget, index) in selectedSideCharts"
                    :key="`chart-${index}`"
                    class="chart-item"
                  >
                    <component
                      :is="getWidgetComponent(widget.type)"
                      :title="widget.title"
                      :config="widget.config"
                    />
                  </div>
                </div>
                <!-- Custom widgets section (side) -->
                <div
                  v-if="selectedCustomSideWidgets.length > 0"
                  class="charts-section"
                >
                  <div
                    v-for="(widget, index) in selectedCustomSideWidgets"
                    :key="`custom-side-${index}`"
                    class="chart-item"
                  >
                    <component
                      v-if="canRenderCustomWidgets"
                      :is="getWidgetComponent(widget.component)"
                      :table-data="getTableData(selectedTable.value)"
                      :table-key="selectedTable.value || ''"
                      :execution-data="getExecutionData()"
                      :execution-type="executionType.value || null"
                      v-bind="widget.props || {}"
                    />
                  </div>
                </div>
              </div>
            </div>
            <!-- Regular table without widgets -->
            <template v-else>
              <!-- Check if it's a primitive array and render SimpleList -->
              <SimpleList
                v-if="selectedTableData.isPrimitiveArray.value"
                :items="selectedTableData.items.value"
                :loading="selectedTableData.loading.value"
                :search-value="selectedTableData.searchValue.value"
                :enable-search="selectedTableData.enableSearch.value"
                :can-download-excel="selectedTableData.canDownloadExcel.value"
                :search-placeholder="selectedTableData.searchPlaceholder.value"
                :elevation="0"
                @search="selectedTableData.handleSearch"
                @update:searchValue="selectedTableData.handleSearch"
                @download-excel="selectedTableData.handleDownloadExcel"
              />

              <!-- Regular table view for non-primitive arrays -->
              <CoreTable
                v-else
                :items="selectedTableData.items.value"
                :headers="selectedTableData.headers.value"
                :loading="selectedTableData.loading.value"
                :table-title="selectedTableData.tableTitle.value"
                :search-placeholder="selectedTableData.searchPlaceholder.value"
                :elevation="0"
                :display-as-alert-list="
                  selectedTableData.isValidationMessageList?.value ?? false
                "
                alert-list-message-key="message"
                :enable-search="selectedTableData.enableSearch.value"
                :enable-filters="selectedTableData.enableFilters.value"
                :enable-selection="selectedTableData.enableSelection.value"
                :enable-actions="selectedTableData.enableActions.value"
                :enable-bulk-actions="selectedTableData.enableBulkActions.value"
                :read-only-display="isReadOnlyDataSection"
                :table-key="selectedTable"
                :enable-excel-mode="selectedTableData.enableExcelMode.value"
                :is-cell-modified="selectedTableData.isCellModified"
                :get-modified-value="selectedTableData.getModifiedValue"
                :get-row-class="selectedTableData.getRowClass"
                :can-add="selectedTableData.canAdd.value"
                :can-edit="selectedTableData.canEdit.value"
                :can-delete="selectedTableData.canDelete.value"
                :can-bulk-upload="selectedTableData.canBulkUpload.value"
                :can-download-excel="selectedTableData.canDownloadExcel.value"
                :search-value="selectedTableData.searchValue.value"
                :active-filters="selectedTableData.activeFilters.value"
                :selected-items="selectedTableData.selectedItems.value"
                :available-filter-fields="
                  selectedTableData.availableFilterFields.value
                "
                :show-add-edit-modal="selectedTableData.showAddEditModal.value"
                :show-delete-dialog="selectedTableData.showDeleteDialog.value"
                :show-bulk-delete-dialog="
                  selectedTableData.showBulkDeleteDialog.value
                "
                :show-bulk-upload-modal="
                  selectedTableData.showBulkUploadModal.value
                "
                :form-fields="selectedTableData.formFields.value"
                :form-data="selectedTableData.formData.value"
                :is-editing="selectedTableData.isEditing.value"
                :saving="selectedTableData.saving.value"
                :deleting="selectedTableData.deleting.value"
                :bulk-deleting="selectedTableData.bulkDeleting.value"
                :uploading="selectedTableData.uploading.value"
                :downloading="selectedTableData.downloading.value"
                :editing-row-id="selectedTableData.editingRowId.value"
                :editing-data="selectedTableData.editingData.value"
                :original-data="selectedTableData.originalData.value"
                :is-editing-any-row="selectedTableData.isEditingAnyRow.value"
                :load-table-data="selectedTableData.loadTableData"
                :table-data="selectedTableData.tableData.value"
                @search="selectedTableData.handleSearch"
                :get-operators-for-field-type="
                  selectedTableData.getOperatorsForFieldType
                "
                :get-operator-text="selectedTableData.getOperatorText"
                :operator-needs-value="selectedTableData.operatorNeedsValue"
                :operator-needs-second-value="
                  selectedTableData.operatorNeedsSecondValue
                "
                :generate-filter-id="selectedTableData.generateFilterId"
                @add-filter="selectedTableData.handleAddFilter"
                @remove-filter="selectedTableData.handleRemoveFilter"
                @clear-all-filters="selectedTableData.handleClearAllFilters"
                @toggle-filters-panel="
                  selectedTableData.handleToggleFiltersPanel
                "
                @select-item="selectedTableData.handleSelectItem"
                @select-all="selectedTableData.handleSelectAll"
                @clear-selection="selectedTableData.handleClearSelection"
                @add-item="selectedTableData.handleAddItem"
                @edit-item="selectedTableData.handleEditItem"
                @delete-item="selectedTableData.handleDeleteItem"
                @bulk-delete="selectedTableData.handleBulkDelete"
                @save-item="selectedTableData.handleSaveItem"
                @cancel-edit="
                  () => (selectedTableData.showAddEditModal.value = false)
                "
                @bulk-upload="selectedTableData.handleBulkUpload"
                @download-excel="selectedTableData.handleDownloadExcel"
                @confirm-delete="selectedTableData.handleConfirmDelete"
                @confirm-bulk-delete="selectedTableData.handleConfirmBulkDelete"
                @cancel-delete="
                  () => (selectedTableData.showDeleteDialog.value = false)
                "
                @cancel-bulk-delete="
                  () => (selectedTableData.showBulkDeleteDialog.value = false)
                "
                @cancel-bulk-upload="
                  () => (selectedTableData.showBulkUploadModal.value = false)
                "
                @start-inline-edit="selectedTableData.startInlineEdit"
                @save-inline-edit="selectedTableData.saveInlineEdit"
                @cancel-inline-edit="selectedTableData.cancelInlineEdit"
                @update-inline-field="selectedTableData.updateInlineField"
                @cell-change="selectedTableData.handleCellChange"
                @update:searchValue="selectedTableData.handleSearch"
                @update:activeFilters="
                  (filters) => (selectedTableData.activeFilters.value = filters)
                "
                @update:selectedItems="
                  (items) => (selectedTableData.selectedItems.value = items)
                "
                @update:showAddEditModal="
                  (show) => (selectedTableData.showAddEditModal.value = show)
                "
                @update:showDeleteDialog="
                  (show) => (selectedTableData.showDeleteDialog.value = show)
                "
                @update:showBulkDeleteDialog="
                  (show) =>
                    (selectedTableData.showBulkDeleteDialog.value = show)
                "
                @update:showBulkUploadModal="
                  (show) => (selectedTableData.showBulkUploadModal.value = show)
                "
                @update:formData="
                  (data) => (selectedTableData.formData.value = data)
                "
              />
            </template>
          </v-card-text>
          <!-- Additional charts below table (100% width) for group view -->
          <div
            v-if="
              shouldShowWidgets &&
              (selectedBottomCharts.length > 0 ||
                selectedCustomBottomWidgets.length > 0)
            "
            class="bottom-charts-section"
          >
            <div
              v-for="(widget, index) in selectedBottomCharts"
              :key="`bottom-chart-${index}`"
              class="bottom-chart-item"
            >
              <component
                :is="getWidgetComponent(widget.type)"
                :title="widget.title"
                :config="widget.config"
              />
            </div>
            <div
              v-for="(widget, index) in selectedCustomBottomWidgets"
              :key="`custom-bottom-${index}`"
              class="bottom-chart-item"
            >
              <component
                v-if="selectedTable.value && executionType.value"
                :is="getWidgetComponent(widget.component)"
                :table-data="getTableData(selectedTable.value)"
                :table-key="selectedTable.value"
                :execution-data="getExecutionData()"
                :execution-type="executionType.value"
                v-bind="widget.props || {}"
              />
            </div>
          </div>
        </v-card>
      </div>
    </template>

    <!-- Pending changes review modal (master tables / configuration only) -->
    <PendingChangesReviewModal
      v-if="isConfigurationSection"
      v-model="showMasterTablePendingModal"
      :saving="
        isGroupView ? selectedTableData.saving.value : tableData.saving.value
      "
      :validation-error="masterTableValidationError"
      :rows-data="aggregatedRowsDataForModal"
      :table-headers="aggregatedTableHeadersForModal"
      :table-data="
        (isGroupView ? selectedTableData : tableData).tableData.value
      "
      :table-keys-filter="undefined"
      @save="handleMasterTableSaveAll"
      @close="handleCloseMasterTablePendingModal"
      @clear-validation-error="masterTableValidationError = null"
      @update:model-value="(v) => (showMasterTablePendingModal = v)"
    />

    <!-- Exit confirmation when leaving with unsaved pending changes (configuration) -->
    <MBaseModal
      v-model="showExitConfirmationModal"
      :closeOnOutsideClick="false"
      :title="t('sectionView.exitConfirmation.title')"
      :buttons="[
        {
          text: t('sectionView.exitConfirmation.confirmButton'),
          action: 'confirm',
          class: 'primary-btn',
        },
        {
          text: t('sectionView.exitConfirmation.cancelButton'),
          action: 'cancel',
          class: 'secondary-btn',
        },
      ]"
      @confirm="handleConfirmExit"
      @cancel="handleCancelExit"
      @close="handleCancelExit"
    >
      <template #content>
        <v-row class="d-flex justify-center pr-2 pl-2 pb-5 pt-3">
          <span style="white-space: pre-line">{{
            t('sectionView.exitConfirmation.message')
          }}</span>
        </v-row>
      </template>
    </MBaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted, onDeactivated } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CoreTable from '@/components/core/table/CoreTable.vue'
import SimpleList from '@/components/core/SimpleList.vue'
import CoreTab from '@/components/core/CoreTab.vue'
import CoreTabs from '@/components/core/CoreTabs.vue'
import CoreTitleView from '@/components/core/CoreTitleView.vue'
import PendingChangesReviewModal from '@/components/core/PendingChangesReviewModal.vue'
import { useSectionConfiguration } from '@/composables/section-view/useSectionConfiguration'
import { useGroupTables } from '@/composables/section-view/useGroupTables'
import { useSectionDisplay } from '@/composables/section-view/useSectionDisplay'
import { useTableData, invalidateTableDataCache } from '@/composables/section-view/useTableData'
import { useTableChanges } from '@/composables/useTableChanges'
import { useGeneralStore } from '@/stores/general'
import { generateAutoDashboard } from '@/services/AutoDashboardService'
import type { DashboardWidget } from '@/services/AutoDashboardService'
import { isFrontendAutomationRoute } from '@/services/FrontendAutomationService'
import AutoKPICard from '@/components/dashboard/AutoKPICard.vue'
import AutoLineChart from '@/components/dashboard/AutoLineChart.vue'
import AutoBarChart from '@/components/dashboard/AutoBarChart.vue'
import AutoPieChart from '@/components/dashboard/AutoPieChart.vue'
import AutoAreaChart from '@/components/dashboard/AutoAreaChart.vue'
import AutoMapChart from '@/components/dashboard/AutoMapChart.vue'
import appConfig from '@/app/config'
import { getLocalizedMessage } from '@/utils/i18nUtils'
import { parseJoinFrom, resolveDisplayValuesToFkIds } from '@/utils/schemaUtils'

// Composables
const { sectionType, currentConfiguration } = useSectionConfiguration()

// Check if configurations are ready
const configurationsReady = computed(() => {
  return (
    currentConfiguration.value &&
    Object.keys(currentConfiguration.value).length > 0
  )
})

const {
  tableKey,
  groupName,
  selectedTable,
  selectedTabIndex,
  isGroupView,
  groupTables,
  tableConfig,
  selectedTableConfig,
  tabsData,
  handleTabChange,
  resolvedTableKey,
} = useGroupTables(currentConfiguration, sectionType)

const { title, description, currentIcon } = useSectionDisplay(
  sectionType,
  isGroupView,
  groupName,
  tableConfig,
  tableKey,
  groupTables,
)

// Determine execution type based on section
const executionType = computed(() => {
  if (sectionType.value === 'input-data') return 'instance'
  if (sectionType.value === 'results') return 'solution'
  return null
})

// Read-only display: input-data and results show data as plain table (no editing UI, no green cells)
const isReadOnlyDataSection = computed(
  () => sectionType.value === 'input-data' || sectionType.value === 'results',
)

// Configuration (master tables) section: show pending changes bar and review modal
const isConfigurationSection = computed(
  () => sectionType.value === 'configuration',
)

// Shared table changes (so bar and modal are common across all tabs in group view)
const tableChanges = useTableChanges()

/** Normalize table key for storage (match useTableData) so we filter by current group. */
const normalizeTableKey = (key: string): string => {
  if (!key) return ''
  return String(key).toLowerCase().replace(/-/g, '_')
}

/** In group view: modified table keys that belong to the current group. */
const modifiedTableKeysInGroup = computed(() => {
  if (!isGroupView.value || !groupTables.value) return []
  const groupKeys = Object.keys(groupTables.value)
  const normalizedGroup = new Set(groupKeys.map(normalizeTableKey))
  return tableChanges.modifiedTableKeys.value.filter((mk) =>
    normalizedGroup.has(mk),
  )
})

/** Pending changes are shared across all sections/groups; show global count. */
const hasPendingChanges = computed(() => {
  if (!isConfigurationSection.value) return false
  return tableChanges.hasChanges.value
})

const pendingChangesCount = computed(() => {
  if (!isConfigurationSection.value) return 0
  return tableChanges.totalChangesCount.value
})

const showMasterTablePendingModal = ref(false)
const masterTableValidationError = ref<string | null>(null)
const showExitConfirmationModal = ref(false)
const pendingNavigationNext = ref<((abort?: boolean) => void) | null>(null)

const openMasterTablePendingModal = () => {
  masterTableValidationError.value = null
  showMasterTablePendingModal.value = true
}

onBeforeRouteLeave((to, _from, next) => {
  // When staying within frontend automation sections, do not prompt (changes are shared)
  if (isFrontendAutomationRoute(to.path)) {
    next()
    return
  }
  if (!isConfigurationSection.value || !hasPendingChanges.value) {
    next()
    return
  }
  pendingNavigationNext.value = next
  showExitConfirmationModal.value = true
})

const handleConfirmExit = () => {
  showExitConfirmationModal.value = false
  tableChanges.clearAllChanges()
  const next = pendingNavigationNext.value
  pendingNavigationNext.value = null
  next?.()
}

const handleCancelExit = () => {
  showExitConfirmationModal.value = false
  const next = pendingNavigationNext.value
  pendingNavigationNext.value = null
  next?.(false)
}

/** Extract a single string from API error (message can be string or { en, es, ... }). */
function getErrorMessage(err: any): string {
  const raw =
    err?.message ??
    err?.response?.content?.message ??
    err?.response?.data?.message
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') return getLocalizedMessage(raw)
  return t('table.messages.errorSaving')
}

const handleMasterTableSaveAll = async () => {
  masterTableValidationError.value = null
  try {
    await saveAllMasterTableChanges()
    showMasterTablePendingModal.value = false
  } catch (err) {
    masterTableValidationError.value = getErrorMessage(err)
  }
}

/** Extract referenced table key from a temp id */
function getTableKeyFromTempId(tempId: string): string | null {
  if (typeof tempId !== 'string' || !/^create-/.test(tempId)) return null
  const parts = tempId.split('-')
  if (parts.length < 3) return null
  return parts.slice(1, -2).join('-') || null
}

/** Topological sort: tables that are referenced (via temp ids in creates) come first. */
function sortKeysByCreateDependency(
  keys: string[],
  getCreates: (key: string) => Array<{ data: Record<string, any> }>,
): string[] {
  const keySet = new Set(keys)
  const deps = new Map<string, Set<string>>()
  keys.forEach((k) => deps.set(k, new Set()))
  keys.forEach((storageKey) => {
    const creates = getCreates(storageKey) || []
    creates.forEach(({ data }) => {
      Object.values(data || {}).forEach((val) => {
        const ref = getTableKeyFromTempId(String(val))
        if (ref && ref !== storageKey && keySet.has(ref)) {
          deps.get(storageKey)!.add(ref)
        }
      })
    })
  })
  const result: string[] = []
  const added = new Set<string>()
  while (result.length < keys.length) {
    let picked: string | null = null
    for (const k of keys) {
      if (added.has(k)) continue
      const depSet = deps.get(k)!
      const allDepAdded = [...depSet].every((d) => added.has(d))
      if (allDepAdded) {
        picked = k
        break
      }
    }
    if (picked == null) break
    result.push(picked)
    added.add(picked)
  }
  keys.forEach((k) => {
    if (!added.has(k)) result.push(k)
  })
  return result
}

/**
 * Get the FK field name in this table that references the given table.
 */
function getFkFieldNameForReferencedTable(
  tableConfig: any,
  referencedTableKey: string,
): string | null {
  const props = tableConfig?.get_list?.response_schema?.items?.properties
  if (!props) return null
  const refNorm = referencedTableKey.toLowerCase().replace(/-/g, '_')
  for (const [fkField, prop] of Object.entries(props)) {
    const p = prop as any
    if (!p?.columnsToJoin || !Array.isArray(p.columnsToJoin)) continue
    for (const depKey of p.columnsToJoin) {
      const dep = props[depKey] as any
      const joinFrom = dep?.joinFrom
      if (!joinFrom) continue
      const joinInfo = parseJoinFrom(joinFrom)
      if (!joinInfo) continue
      const tableNorm = joinInfo.table.toLowerCase().replace(/-/g, '_')
      if (tableNorm === refNorm) return fkField
    }
  }
  return null
}

/** Replace any temp id in payload with the real id; use correct FK field name. */
function resolveTempIdsInPayload(
  payload: Record<string, any>,
  tempIdToRealId: Record<string, string | number>,
  tableConfig: any,
): Record<string, any> {
  const out = { ...payload }
  for (const key of Object.keys(out)) {
    const val = out[key]
    if (typeof val !== 'string' || !/^create-/.test(val) || !(val in tempIdToRealId)) continue
    const realId = tempIdToRealId[val]
    const refTable = getTableKeyFromTempId(val)
    const fkFieldName = refTable && tableConfig ? getFkFieldNameForReferencedTable(tableConfig, refTable) : null
    const targetKey = fkFieldName || key
    if (targetKey !== key) {
      delete out[key]
    }
    out[targetKey] = realId
  }
  return out
}

/** Save pending changes for all modified tables in the current group (deletes → creates → edits). */
const saveAllGroupMasterTableChanges = async () => {
  const keys = modifiedTableKeysInGroup.value
  if (keys.length === 0 || !groupTables.value) return

  const { default: TableRepository } = await import(
    '@/repositories/TableRepository'
  )

  /** Load referenced table data by table name for resolving display values to FK ids. */
  const loadTableDataForGroup = async (tableName: string): Promise<any[]> => {
    const refConfig = currentConfiguration.value?.[tableName]
    if (!refConfig?.get_list) return []
    const refRepo = new TableRepository(refConfig, t)
    const data = await refRepo.getList()
    return Array.isArray(data) ? data : []
  }

  const getCreates = (storageKey: string) => tableChanges.getPendingCreates(storageKey)
  const orderedKeys = sortKeysByCreateDependency(keys, getCreates)
  const tempIdToRealId: Record<string, string | number> = {}

  for (const storageKey of orderedKeys) {
    const configKey = Object.keys(groupTables.value).find(
      (gk) => normalizeTableKey(gk) === storageKey,
    )
    if (!configKey) continue

    const config = groupTables.value[configKey]
    const repository = new TableRepository(config, t)

    // 1. Apply pending deletes (no API until now)
    const deletes = tableChanges.getPendingDeletes(storageKey)
    if (config?.delete_item && deletes.length > 0) {
      for (const rowId of deletes) {
        await repository.deleteItem(rowId)
      }
      tableChanges.clearDeletesForTable(storageKey)
    }

    // 2. Apply pending creates: resolve FKs (temp id → real id), resolve display values to FK ids, then POST
    const creates = tableChanges.getPendingCreates(storageKey)
    if (config?.post_item && creates.length > 0) {
      for (const { tempId, data } of creates) {
        const { id: _id, ...rawPayload } = data
        const payloadWithTempIds = resolveTempIdsInPayload(rawPayload, tempIdToRealId, config)
        const payload = await resolveDisplayValuesToFkIds(
          payloadWithTempIds,
          config,
          loadTableDataForGroup,
        )
        const result = await repository.createItem(payload)
        const realId = result?.id ?? result?.pk
        if (realId != null) tempIdToRealId[tempId] = realId
      }
      tableChanges.clearCreatesForTable(storageKey)
    }

    // 3. Apply cell edits (put): resolve display values to FK ids so API receives id_values.
    const changes = tableChanges.getChangesForTable(storageKey)
    if (config?.put_item && changes) {
      const items = await repository.getList()
      for (const [rowId, rowChanges] of Object.entries(changes)) {
        const row = items.find((i: any) => String(i.id) === rowId)
        if (!row) continue
        const merged = { ...row }
        Object.entries(rowChanges).forEach(
          ([fieldKey, change]: [string, any]) => {
            merged[fieldKey] = change.newValue
          },
        )
        const withTempIds = resolveTempIdsInPayload(
          { ...merged } as Record<string, any>,
          tempIdToRealId,
          config,
        )
        const preparedData = await resolveDisplayValuesToFkIds(
          withTempIds,
          config,
          loadTableDataForGroup,
        )
        delete preparedData.id
        await repository.putItem(rowId, preparedData)
      }
      tableChanges.revertTableChanges(storageKey)
    }
  }

  // Invalidate cache for each saved table so selectors in other sections see new rows
  for (const storageKey of orderedKeys) {
    invalidateTableDataCache(storageKey)
  }

  // Refresh current tab data so the new record appears in the table
  await selectedTableData.loadData()
}

/** Get table config by storage key from current (master) configuration. */
function getConfigByStorageKey(storageKey: string): any {
  const config = currentConfiguration.value
  if (!config || typeof config !== 'object') return null
  const key = Object.keys(config).find((k) => normalizeTableKey(k) === storageKey)
  return key ? config[key] : null
}

/** Save pending changes for ALL modified tables (across sections/groups). */
const saveAllMasterTableChanges = async () => {
  const keys = tableChanges.modifiedTableKeys.value
  if (keys.length === 0) return

  const { default: TableRepository } = await import(
    '@/repositories/TableRepository'
  )

  const getCreates = (storageKey: string) =>
    tableChanges.getPendingCreates(storageKey)
  const orderedKeys = sortKeysByCreateDependency(keys, getCreates)
  const tempIdToRealId: Record<string, string | number> = {}

  for (const storageKey of orderedKeys) {
    const config = getConfigByStorageKey(storageKey)
    if (!config) continue

    const repository = new TableRepository(config, t)
    const loadTableDataForSave = (tableName: string) =>
      tableData.loadTableData(tableName)

    // 1. Pending deletes
    const deletes = tableChanges.getPendingDeletes(storageKey)
    if (config?.delete_item && deletes.length > 0) {
      for (const rowId of deletes) {
        await repository.deleteItem(rowId)
      }
      tableChanges.clearDeletesForTable(storageKey)
    }

    // 2. Pending creates
    const creates = tableChanges.getPendingCreates(storageKey)
    if (config?.post_item && creates.length > 0) {
      for (const { tempId, data } of creates) {
        const { id: _id, ...rawPayload } = data
        const payloadWithTempIds = resolveTempIdsInPayload(
          rawPayload,
          tempIdToRealId,
          config,
        )
        const payload = await resolveDisplayValuesToFkIds(
          payloadWithTempIds,
          config,
          loadTableDataForSave,
        )
        const result = await repository.createItem(payload)
        const realId = result?.id ?? result?.pk
        if (realId != null) tempIdToRealId[tempId] = realId
      }
      tableChanges.clearCreatesForTable(storageKey)
    }

    // 3. Cell edits
    const changes = tableChanges.getChangesForTable(storageKey)
    if (config?.put_item && changes) {
      const items = await repository.getList()
      for (const [rowId, rowChanges] of Object.entries(changes)) {
        const row = items.find((i: any) => String(i.id) === rowId)
        if (!row) continue
        const merged = { ...row }
        Object.entries(rowChanges).forEach(
          ([fieldKey, change]: [string, any]) => {
            merged[fieldKey] = change.newValue
          },
        )
        const withTempIds = resolveTempIdsInPayload(
          { ...merged } as Record<string, any>,
          tempIdToRealId,
          config,
        )
        const preparedData = await resolveDisplayValuesToFkIds(
          withTempIds,
          config,
          loadTableDataForSave,
        )
        delete preparedData.id
        await repository.putItem(rowId, preparedData)
      }
      tableChanges.revertTableChanges(storageKey)
    }

    invalidateTableDataCache(storageKey)
  }

  if (isGroupView.value) {
    await selectedTableData.loadData()
  } else {
    await tableData.loadData()
  }
}

const handleCloseMasterTablePendingModal = () => {
  showMasterTablePendingModal.value = false
}

// Table data management - Business logic layer
// Use resolvedTableKey for non-group views to ensure correct key matching
const effectiveTableKey = computed(
  () => resolvedTableKey.value || tableKey.value,
)
const tableData = useTableData(effectiveTableKey, tableConfig, executionType)
const selectedTableData = useTableData(
  selectedTable,
  selectedTableConfig,
  executionType,
)

/** Cache rowsData and tableHeaders per tab (normalized key) so the review modal has data for all tabs. */
const groupModalDataCache = ref<
  Record<
    string,
    {
      rowsData: Record<string, Record<string, any>>
      tableHeaders: Record<
        string,
        Array<{ key: string; title: string; type?: string }>
      >
    }
  >
>({})

/** Keep cache updated with current tab data when in group view. */
watch(
  [
    () => (isGroupView.value ? selectedTable.value : null),
    () => (isGroupView.value ? selectedTableData.rowsDataForModal.value : null),
    () =>
      isGroupView.value ? selectedTableData.tableHeadersForModal.value : null,
  ],
  () => {
    if (!isGroupView.value || !selectedTable.value) return
    const key = normalizeTableKey(selectedTable.value)
    groupModalDataCache.value[key] = {
      rowsData: selectedTableData.rowsDataForModal.value,
      tableHeaders: selectedTableData.tableHeadersForModal.value,
    }
  },
  { deep: true },
)

/** Aggregated rowsData and tableHeaders for the review modal (all modified tables, across sections). */
const aggregatedRowsDataForModal = computed(() => {
  const allKeys = tableChanges.modifiedTableKeys.value
  const result: Record<string, Record<string, any>> = {}
  const currentKey = isGroupView.value && selectedTable.value
    ? normalizeTableKey(selectedTable.value)
    : effectiveTableKey.value
      ? normalizeTableKey(effectiveTableKey.value)
      : ''
  for (const key of allKeys) {
    if (isGroupView.value) {
      const cached = groupModalDataCache.value[key]?.rowsData?.[key]
      const current =
        key === currentKey ? selectedTableData.rowsDataForModal.value[key] : undefined
      result[key] = cached ?? current ?? {}
    } else {
      result[key] =
        key === currentKey ? tableData.rowsDataForModal.value[key] ?? {} : {}
    }
  }
  return result
})

const aggregatedTableHeadersForModal = computed(() => {
  const allKeys = tableChanges.modifiedTableKeys.value
  const result: Record<
    string,
    Array<{ key: string; title: string; type?: string }>
  > = {}
  const currentKey = isGroupView.value && selectedTable.value
    ? normalizeTableKey(selectedTable.value)
    : effectiveTableKey.value
      ? normalizeTableKey(effectiveTableKey.value)
      : ''
  for (const key of allKeys) {
    if (isGroupView.value) {
      const cached = groupModalDataCache.value[key]?.tableHeaders?.[key]
      const current =
        key === currentKey ? selectedTableData.tableHeadersForModal.value[key] : undefined
      result[key] = cached ?? current ?? []
    } else {
      result[key] =
        key === currentKey ? (tableData.tableHeadersForModal.value[key] ?? []) : []
    }
  }
  return result
})

// Per-tab search and filters state (only used in group view) so each tab has independent filter/search
const perTabSearchAndFilters = ref<
  Record<string, { searchValue: string; activeFilters: any[] }>
>({})

// Create a unified data source that uses the correct instance
const activeTableData = computed(() => {
  const isGroup = isGroupView.value

  if (isGroup) {
    return selectedTableData
  } else {
    return tableData
  }
})

// Watch for table changes and reset inline editing state
watch(
  [tableKey, selectedTable],
  ([newTableKey, newSelectedTable], [oldTableKey, oldSelectedTable]) => {
    // Check if we're switching between different tables
    const isTableChange =
      newTableKey !== oldTableKey || newSelectedTable !== oldSelectedTable

    if (isTableChange) {
      // In group view: persist search and filters for the tab we're leaving, restore for the tab we're entering
      if (isGroupView.value && oldSelectedTable) {
        perTabSearchAndFilters.value[oldSelectedTable] = {
          searchValue: selectedTableData.searchValue.value,
          activeFilters: [...selectedTableData.activeFilters.value],
        }
      }
      if (isGroupView.value && newSelectedTable) {
        const saved = perTabSearchAndFilters.value[newSelectedTable]
        selectedTableData.searchValue.value = saved?.searchValue ?? ''
        selectedTableData.activeFilters.value = saved?.activeFilters
          ? [...saved.activeFilters]
          : []
      }

      // Reset inline editing state for both table instances
      // Note: isEditingAnyRow is a computed based on editingRowId, so we only need to reset editingRowId
      if (tableData) {
        tableData.editingRowId.value = null
        tableData.editingData.value = {}
        tableData.originalData.value = {}
      }

      if (selectedTableData) {
        selectedTableData.editingRowId.value = null
        selectedTableData.editingData.value = {}
        selectedTableData.originalData.value = {}
      }
    }
  },
  { immediate: false },
)

// Auto dashboard widgets logic
const route = useRoute()
const router = useRouter()
const generalStore = useGeneralStore()
const { locale, t } = useI18n()

// Interface for custom widget configuration
interface CustomWidgetConfig {
  component: string
  props?: Record<string, any>
  position: 'side' | 'bottom'
}

// Get table dashboard configuration
const getTableDashboardConfig = (tableKey: string) => {
  const tableDashboards = appConfig.getCore().parameters.tableDashboards
  if (!tableDashboards) {
    return null
  }

  const configType =
    executionType.value === 'instance' ? 'instance' : 'solution'
  const config = tableDashboards[configType]?.[tableKey] || null

  return config
}

// Check if auto dashboards are enabled (global and per-table)
const shouldShowAutoDashboards = (tableKey: string | null): boolean => {
  if (!tableKey) return false

  // Get global setting
  let globalEnabled = false
  if (sectionType.value === 'input-data') {
    globalEnabled =
      appConfig.getCore().parameters.enableAutoInstanceDashboard === true
  } else if (sectionType.value === 'results') {
    globalEnabled =
      appConfig.getCore().parameters.enableAutoSolutionDashboard === true
  }

  // Get table-specific setting
  const tableConfig = getTableDashboardConfig(tableKey)
  if (tableConfig && tableConfig.showAutoDashboards !== undefined) {
    return tableConfig.showAutoDashboards === true
  }

  // Use global if no table-specific setting
  return globalEnabled
}

// Check if widgets should be shown (auto or custom)
const shouldShowWidgets = computed(() => {
  const currentTableKey = isGroupView.value
    ? selectedTable.value
    : tableKey.value
  if (!currentTableKey) {
    return false
  }

  // Show widgets if auto dashboards are enabled OR if there are custom widgets
  const tableConfig = getTableDashboardConfig(currentTableKey)
  const hasCustomWidgets =
    tableConfig?.customWidgets && tableConfig.customWidgets.length > 0
  const autoEnabled = shouldShowAutoDashboards(currentTableKey)

  const shouldShow = autoEnabled || hasCustomWidgets

  return shouldShow
})

// Check if there are actually any widgets to display (not just enabled)
const hasActualWidgets = computed(() => {
  if (isGroupView.value) {
    // For group view, check selected table widgets
    return (
      selectedKpiWidgets.value.length > 0 ||
      selectedSideCharts.value.length > 0 ||
      selectedCustomSideWidgets.value.length > 0 ||
      selectedBottomCharts.value.length > 0 ||
      selectedCustomBottomWidgets.value.length > 0
    )
  } else {
    // For individual view, check current table widgets
    return (
      kpiWidgets.value.length > 0 ||
      sideCharts.value.length > 0 ||
      customSideWidgets.value.length > 0 ||
      bottomCharts.value.length > 0 ||
      customBottomWidgets.value.length > 0
    )
  }
})

// Widgets for current table (non-group view)
const widgets = ref<DashboardWidget[]>([])
const customWidgets = ref<CustomWidgetConfig[]>([])

// Widgets for selected table (group view)
const selectedTableWidgets = ref<DashboardWidget[]>([])
const selectedCustomWidgets = ref<CustomWidgetConfig[]>([])

// Get custom widgets for a table
const getCustomWidgets = (tableKey: string): CustomWidgetConfig[] => {
  const tableConfig = getTableDashboardConfig(tableKey)
  const widgets = tableConfig?.customWidgets || []
  return widgets
}

// Generate widgets for a table (auto + custom)
const generateWidgetsForTable = async (
  tableKey: string,
  executionType: 'instance' | 'solution' | null,
  useSelectedConfig: boolean = false,
) => {
  if (!executionType || !tableKey) {
    return { auto: [], custom: [] }
  }

  const selectedExecution = generalStore.selectedExecution
  if (!selectedExecution) return { auto: [], custom: [] }

  // Get execution data
  let executionData
  if (executionType === 'instance') {
    executionData =
      selectedExecution.experiment?.instance || selectedExecution.instance
  } else {
    executionData =
      selectedExecution.experiment?.solution || selectedExecution.solution
  }

  if (!executionData) return { auto: [], custom: [] }

  // Get table schema from configuration
  const configToUse = useSelectedConfig
    ? selectedTableConfig.value
    : tableConfig.value?.[tableKey]
  const tableSchema = configToUse || null

  // Generate auto widgets only if enabled for this table
  let autoWidgets: DashboardWidget[] = []
  if (shouldShowAutoDashboards(tableKey)) {
    autoWidgets = generateAutoDashboard(
      executionData,
      executionType,
      tableKey,
      locale.value as string,
      (key: string, params?: Record<string, string>) => {
        return t(key, params || {})
      },
      tableSchema,
    )
  }

  // Get custom widgets
  const customWidgets = getCustomWidgets(tableKey)

  return { auto: autoWidgets, custom: customWidgets }
}

// Watch for table changes and regenerate widgets
watch(
  [tableKey, executionType, () => generalStore.selectedExecution?.id],
  async () => {
    if (!tableKey.value || !executionType.value) {
      widgets.value = []
      customWidgets.value = []
      return
    }

    const result = await generateWidgetsForTable(
      tableKey.value,
      executionType.value,
    )
    widgets.value = result.auto
    customWidgets.value = result.custom
  },
  { immediate: true },
)

// Watch for selected table changes in group view
watch(
  [selectedTable, executionType, () => generalStore.selectedExecution?.id],
  async () => {
    if (!selectedTable.value || !executionType.value) {
      selectedTableWidgets.value = []
      selectedCustomWidgets.value = []
      return
    }

    const result = await generateWidgetsForTable(
      selectedTable.value,
      executionType.value,
      true, // Use selectedTableConfig for group views
    )
    selectedTableWidgets.value = result.auto
    selectedCustomWidgets.value = result.custom
  },
  { immediate: true },
)

// Separate widgets into KPIs, side charts, and bottom charts
const kpiWidgets = computed(() => {
  return widgets.value.filter((w) => w.type === 'kpi')
})

const sideCharts = computed(() => {
  // Get small charts (pie, bar, map) that fit in the side column (30%)
  // Large charts (area, line) should go below
  const chartWidgets = widgets.value.filter(
    (w) =>
      w.type !== 'kpi' &&
      (w.type === 'pie' || w.type === 'bar' || w.type === 'map'),
  )
  // Limit to 2-3 small charts max in side column
  return chartWidgets.slice(0, 3)
})

const bottomCharts = computed(() => {
  // All large charts (area, line) and remaining small charts go below
  const chartWidgets = widgets.value.filter((w) => w.type !== 'kpi')
  const smallCharts = chartWidgets.filter(
    (w) => w.type === 'pie' || w.type === 'bar' || w.type === 'map',
  )
  const largeCharts = chartWidgets.filter(
    (w) => w.type === 'area' || w.type === 'line',
  )
  // Put large charts first, then remaining small charts (excluding maps that are already in side)
  return [...largeCharts, ...smallCharts.slice(3)]
})

// Custom widgets separated by position
const customSideWidgets = computed(() => {
  return customWidgets.value.filter((w) => w.position === 'side')
})

const customBottomWidgets = computed(() => {
  return customWidgets.value.filter((w) => w.position === 'bottom')
})

// For group view
const selectedKpiWidgets = computed(() => {
  return selectedTableWidgets.value.filter((w) => w.type === 'kpi')
})

const selectedSideCharts = computed(() => {
  // Get small charts (pie, bar, map) that fit in the side column (30%)
  const chartWidgets = selectedTableWidgets.value.filter(
    (w) =>
      w.type !== 'kpi' &&
      (w.type === 'pie' || w.type === 'bar' || w.type === 'map'),
  )
  return chartWidgets.slice(0, 3)
})

const selectedBottomCharts = computed(() => {
  // All large charts (area, line) and remaining small charts go below
  const chartWidgets = selectedTableWidgets.value.filter(
    (w) => w.type !== 'kpi',
  )
  const smallCharts = chartWidgets.filter(
    (w) => w.type === 'pie' || w.type === 'bar' || w.type === 'map',
  )
  const largeCharts = chartWidgets.filter(
    (w) => w.type === 'area' || w.type === 'line',
  )
  // Put large charts first, then remaining small charts (excluding maps that are already in side)
  return [...largeCharts, ...smallCharts.slice(3)]
})

// Custom widgets for selected table (group view)
const selectedCustomSideWidgets = computed(() => {
  return selectedCustomWidgets.value.filter((w) => w.position === 'side')
})

// Computed to check if we can render custom widgets in group view
const canRenderCustomWidgets = computed(() => {
  return !!(selectedTable.value && executionType.value)
})

const selectedCustomBottomWidgets = computed(() => {
  return selectedCustomWidgets.value.filter((w) => w.position === 'bottom')
})

// Get widget component
// Get execution data for custom widgets
const getExecutionData = () => {
  const selectedExecution = generalStore.selectedExecution
  if (!selectedExecution) return null

  if (executionType.value === 'instance') {
    return selectedExecution.experiment?.instance || selectedExecution.instance
  } else {
    return selectedExecution.experiment?.solution || selectedExecution.solution
  }
}

// Get table data for custom widgets
const getTableData = (tableKey: string) => {
  if (!tableKey) {
    return []
  }

  const executionData = getExecutionData()
  if (!executionData || !executionData.data) {
    return []
  }
  const data = executionData.data[tableKey] || []
  return data
}

// Component registry for custom widgets
// Add your custom components here by importing them
const customComponentRegistry: Record<string, any> = {}

const getWidgetComponent = (type: string) => {
  const components: Record<string, any> = {
    kpi: AutoKPICard,
    line: AutoLineChart,
    bar: AutoBarChart,
    pie: AutoPieChart,
    area: AutoAreaChart,
    map: AutoMapChart,
  }

  // Check if it's a custom component
  if (customComponentRegistry[type]) {
    return customComponentRegistry[type]
  }

  return components[type] || AutoKPICard
}

// Dropdown menu items for SectionView
const dropdownMenuItems = computed(() => {
  const items = []

  // Add "Edit input data" option if:
  // 1. allowEditInstance is enabled
  // 2. We're in input-data section
  // 3. There's a selected execution with an instance
  if (
    appConfig.getCore().parameters.allowEditInstance &&
    sectionType.value === 'input-data' &&
    generalStore.selectedExecution &&
    (generalStore.selectedExecution.instance ||
      generalStore.selectedExecution.experiment?.instance)
  ) {
    items.push({
      id: 'edit-input-data',
      title: t('sectionView.editInputData'),
      icon: 'mdi-pencil',
      action: () => navigateToEditInstance(),
    })
  }

  return items
})

// Navigate to project execution in edit mode
const navigateToEditInstance = () => {
  router.push({
    path: '/project-execution',
    query: { editInstance: 'true' },
  })
  generalStore.incrementUploadComponentKey()
}

// Handle dropdown item click
const handleDropdownItemClick = (item: any) => {
  if (item.action) {
    item.action()
  }
}

// Cancel in-flight table loads when view is deactivated (keep-alive) so GET doesn't update state after navigate-away
onDeactivated(() => {
  tableData.cancelLoadData()
  selectedTableData.cancelLoadData()
})

// Component setup complete
</script>

<style src="@/assets/styles/components/core/PendingChangesBar.css"></style>
<style src="@/assets/styles/views/SectionView.css"></style>
