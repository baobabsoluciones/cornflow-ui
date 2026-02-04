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
      <div v-else-if="!isGroupView" class="table-section mt-5">
        <!-- Table with widgets layout (70/30) - only if there are actual widgets -->
        <div
          v-if="shouldShowWidgets && hasActualWidgets"
          class="table-with-widgets"
        >
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
              @add-filter="tableData.handleAddFilter"
              @remove-filter="tableData.handleRemoveFilter"
              @clear-all-filters="tableData.handleClearAllFilters"
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
        @add-filter="tableData.handleAddFilter"
        @remove-filter="tableData.handleRemoveFilter"
        @clear-all-filters="tableData.handleClearAllFilters"
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
                  :enable-search="selectedTableData.enableSearch.value"
                  :enable-filters="selectedTableData.enableFilters.value"
                  :enable-selection="selectedTableData.enableSelection.value"
                  :enable-actions="selectedTableData.enableActions.value"
                  :enable-bulk-actions="
                    selectedTableData.enableBulkActions.value
                  "
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
                :enable-search="selectedTableData.enableSearch.value"
                :enable-filters="selectedTableData.enableFilters.value"
                :enable-selection="selectedTableData.enableSelection.value"
                :enable-actions="selectedTableData.enableActions.value"
                :enable-bulk-actions="selectedTableData.enableBulkActions.value"
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
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CoreTable from '@/components/core/table/CoreTable.vue'
import SimpleList from '@/components/core/SimpleList.vue'
import CoreTab from '@/components/core/CoreTab.vue'
import CoreTabs from '@/components/core/CoreTabs.vue'
import CoreTitleView from '@/components/core/CoreTitleView.vue'
import { useSectionConfiguration } from '@/composables/section-view/useSectionConfiguration'
import { useGroupTables } from '@/composables/section-view/useGroupTables'
import { useSectionDisplay } from '@/composables/section-view/useSectionDisplay'
import { useTableData } from '@/composables/section-view/useTableData'
import { useGeneralStore } from '@/stores/general'
import { generateAutoDashboard } from '@/services/AutoDashboardService'
import type { DashboardWidget } from '@/services/AutoDashboardService'
import AutoKPICard from '@/components/dashboard/AutoKPICard.vue'
import AutoLineChart from '@/components/dashboard/AutoLineChart.vue'
import AutoBarChart from '@/components/dashboard/AutoBarChart.vue'
import AutoPieChart from '@/components/dashboard/AutoPieChart.vue'
import AutoAreaChart from '@/components/dashboard/AutoAreaChart.vue'
import AutoMapChart from '@/components/dashboard/AutoMapChart.vue'
import appConfig from '@/app/config'

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

// Table data management - Business logic layer
// Use resolvedTableKey for non-group views to ensure correct key matching
const effectiveTableKey = computed(() => resolvedTableKey.value || tableKey.value)
const tableData = useTableData(effectiveTableKey, tableConfig, executionType)
const selectedTableData = useTableData(
  selectedTable,
  selectedTableConfig,
  executionType,
)

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
const customComponentRegistry: Record<string, any> = {
}

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

// Component setup complete
</script>

<style src="@/assets/styles/views/SectionView.css"></style>
