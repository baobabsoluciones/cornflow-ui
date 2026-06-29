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

      <!-- Pending changes bar (master tables / configuration or solution recalculation) -->
      <div
        v-if="(isConfigurationSection || isRecalculationSection) && hasPendingChanges"
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
          v-if="isConfigurationSection"
          color="success"
          variant="flat"
          size="small"
          @click="openMasterTablePendingModal"
        >
          <v-icon start size="small">mdi-eye</v-icon>
          {{ $t('pendingChanges.reviewChanges') }}
        </v-btn>
        <v-btn
          v-else-if="isRecalculationSection"
          color="primary"
          variant="flat"
          size="small"
          @click="openRecalculationPendingModal"
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
      <div
        v-else-if="!isGroupView"
        class="table-section mt-5"
        :class="{
          'table-section--dashboard': shouldShowWidgets && hasActualWidgets,
        }"
      >
        <!-- Table with widgets layout (70/30) - only if there are actual widgets -->
        <div
          v-if="shouldShowWidgets && hasActualWidgets"
          class="dashboard-layout"
        >
          <!-- Top row: table (70%) + side widgets (30%) -->
          <div class="table-with-widgets">
            <div class="table-column">
              <SectionSingleTable
                :table-data="tableData"
                :is-read-only-data-section="isReadOnlyDataSection"
                :table-key="effectiveTableKey"
                :header-origin-indicators="
                  etlHeaderOriginIndicatorsForSingleTable
                "
                :with-row-class="true"
                @bulk-edit="() => handleBulkEditEvent('single')"
              />
            </div>
            <!-- Force retry dialog when overwrite_all returns offer_force_retry (teleported for z-index) -->
            <Teleport to="body">
              <ForceRetryConfirmDialog
                v-if="tableData.forceRetryOffer?.value"
                :model-value="!!tableData.forceRetryOffer?.value"
                :message="tableData.forceRetryOffer?.value?.message ?? ''"
                :loading="!!tableData.forceRetryLoading?.value"
                @confirm="tableData.acceptForceRetry"
                @cancel="tableData.rejectForceRetry"
                @update:model-value="
                  (v) => {
                    if (!v) tableData.rejectForceRetry()
                  }
                "
              />
            </Teleport>
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
        <SectionSingleTable
          v-else
          :table-data="tableData"
          :is-read-only-data-section="isReadOnlyDataSection"
          :table-key="effectiveTableKey"
          :header-origin-indicators="etlHeaderOriginIndicatorsForSingleTable"
          @bulk-edit="() => handleBulkEditEvent('single')"
        />
        <!-- Force retry dialog when overwrite_all returns offer_force_retry (no-widgets layout; teleported for z-index) -->
        <Teleport to="body">
          <ForceRetryConfirmDialog
            v-if="tableData.forceRetryOffer?.value"
            :model-value="!!tableData.forceRetryOffer?.value"
            :message="tableData.forceRetryOffer?.value?.message ?? ''"
            :loading="!!tableData.forceRetryLoading?.value"
            @confirm="tableData.acceptForceRetry"
            @cancel="tableData.rejectForceRetry"
            @update:model-value="
              (v) => {
                if (!v) tableData.rejectForceRetry()
              }
            "
          />
        </Teleport>
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
              :title="table.text"
              :tooltip="table.text"
            >
              <span>{{ table.text }}</span>
              <!-- Validation table warning/error indicator -->
              <v-tooltip
                v-if="isValidationsGroup && groupTables[table.value] != null"
                location="top"
              >
                <template #activator="{ props: tooltipProps }">
                  <v-icon
                    v-bind="tooltipProps"
                    size="16"
                    :color="groupTables[table.value]?.is_warning ? 'warning' : 'error'"
                    class="ml-1"
                  >
                    {{ groupTables[table.value]?.is_warning ? 'mdi-alert-outline' : 'mdi-alert-circle-outline' }}
                  </v-icon>
                </template>
                <span>{{
                  groupTables[table.value]?.is_warning
                    ? $t('sectionView.validationWarningTab')
                    : $t('sectionView.validationErrorTab')
                }}</span>
              </v-tooltip>
              <v-tooltip
                v-if="showEtlTabOriginIndicatorsForTable(table.value)"
                location="top"
              >
                <template #activator="{ props: tooltipProps }">
                  <v-icon
                    v-bind="tooltipProps"
                    size="16"
                    :color="isTableFromDb(table.value) ? 'success' : 'primary'"
                    class="ml-2"
                  >
                    {{
                      isTableFromDb(table.value)
                        ? 'mdi-database-check'
                        : 'mdi-file-document-outline'
                    }}
                  </v-icon>
                </template>
                <span>
                  {{
                    isTableFromDb(table.value)
                      ? t('sectionView.etlMetadataInfo.fromDbTooltip')
                      : t('sectionView.etlMetadataInfo.notFromDbTooltip')
                  }}
                </span>
              </v-tooltip>
            </CoreTab>
          </CoreTabs>

          <v-card-text class="table-card-content">
            <!-- Table with widgets layout (70/30) for group view - only if there are actual widgets -->
            <div
              v-if="shouldShowWidgets && hasActualWidgets"
              class="table-with-widgets"
            >
              <div class="table-column">
                <SectionGroupTable
                  :table-data="selectedTableData"
                  :is-table-ui-loading="isTableUiLoading"
                  :is-read-only-data-section="isReadOnlyDataSection"
                  :table-key="selectedTable"
                  :header-origin-indicators="
                    etlHeaderOriginIndicatorsForSelectedTable
                  "
                  @bulk-edit="() => handleBulkEditEvent('group')"
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
            <SectionGroupTable
              v-else
              :table-data="selectedTableData"
              :is-table-ui-loading="isTableUiLoading"
              :is-read-only-data-section="isReadOnlyDataSection"
              :table-key="selectedTable"
              :header-origin-indicators="
                etlHeaderOriginIndicatorsForSelectedTable
              "
              @bulk-edit="() => handleBulkEditEvent('group')"
            />
            <!-- Force retry for group view: outside widgets/no-widgets branches so it always mounts -->
            <Teleport to="body">
              <ForceRetryConfirmDialog
                v-if="selectedTableData.forceRetryOffer?.value"
                :model-value="!!selectedTableData.forceRetryOffer?.value"
                :message="
                  selectedTableData.forceRetryOffer?.value?.message ?? ''
                "
                :loading="!!selectedTableData.forceRetryLoading?.value"
                @confirm="selectedTableData.acceptForceRetry"
                @cancel="selectedTableData.rejectForceRetry"
                @update:model-value="
                  (v) => {
                    if (!v) selectedTableData.rejectForceRetry()
                  }
                "
              />
            </Teleport>
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
      :saving="masterTableSaving"
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

    <!-- Pending changes review modal (solution recalculation) -->
    <PendingChangesReviewModal
      v-if="isRecalculationSection"
      v-model="showRecalculationPendingModal"
      :saving="recalculationSaving"
      :validation-error="recalculationValidationError"
      :rows-data="aggregatedRowsDataForModal"
      :table-headers="aggregatedTableHeadersForModal"
      :table-data="
        (isGroupView ? selectedTableData : tableData).tableData.value
      "
      :table-keys-filter="undefined"
      :save-button-text="$t('recalculation.solutionRecalc.recalculateButton')"
      :save-button-icon="'mdi-refresh'"
      @save="handleSolutionRecalculation"
      @close="handleCloseRecalculationPendingModal"
      @clear-validation-error="recalculationValidationError = null"
      @update:model-value="(v) => (showRecalculationPendingModal = v)"
    />

    <!-- Force retry dialog when save-all bulk delete returns offer_force_retry -->
    <Teleport to="body">
      <ForceRetryConfirmDialog
        v-if="forceRetryOfferFromSaveAll"
        :model-value="!!forceRetryOfferFromSaveAll"
        :message="forceRetryOfferFromSaveAll?.message ?? ''"
        :loading="forceRetryLoadingFromSaveAll"
        @confirm="handleForceRetryConfirmFromSaveAll"
        @cancel="forceRetryOfferFromSaveAll = null"
        @update:model-value="
          (v) => {
            if (!v) forceRetryOfferFromSaveAll = null
          }
        "
      />
    </Teleport>

    <CoreBulkEditModal
      v-if="showBulkEditModal"
      :model-value="showBulkEditModal"
      :headers="activeBulkEditHeaders"
      :selected-count="activeBulkEditSelectedCount"
      @apply="handleBulkEditApply"
      @cancel="showBulkEditModal = false"
      @update:model-value="(v) => (showBulkEditModal = v)"
    />

    <CoreBulkUploadModal
      v-if="isConfigurationSection"
      v-model="showEditAllMasterTablesModal"
      :title="$t('sectionView.editAllMasterTablesTitle')"
      :accepted-formats="['.xlsx', '.json', '.csv']"
      :multiple="true"
      :loading="editAllMasterTablesUploading"
      :available-operations="['post_update_bulk', 'post_bulk', 'overwrite_all']"
      @upload="handleEditAllMasterTablesUpload"
      @cancel="showEditAllMasterTablesModal = false"
    />

    <Teleport to="body">
      <ForceRetryConfirmDialog
        v-if="editAllTablesForceContext"
        :model-value="!!editAllTablesForceContext"
        :message="editAllTablesForceContext.message"
        :loading="editAllTablesForceLoading"
        @confirm="confirmEditAllTablesForceRetry"
        @cancel="cancelEditAllTablesForceRetry"
        @update:model-value="
          (v) => {
            if (!v) cancelEditAllTablesForceRetry()
          }
        "
      />
    </Teleport>

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
import { computed, watch, ref, inject, onDeactivated } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { formatDateForFilename } from '@/utils/date'
import SimpleList from '@/components/core/SimpleList.vue'
import CoreTab from '@/components/core/CoreTab.vue'
import CoreTabs from '@/components/core/CoreTabs.vue'
import CoreTitleView from '@/components/core/CoreTitleView.vue'
import PendingChangesReviewModal from '@/components/core/PendingChangesReviewModal.vue'
import ForceRetryConfirmDialog from '@/components/core/table/ForceRetryConfirmDialog.vue'
import SectionSingleTable from '@/components/section-view/SectionSingleTable.vue'
import SectionGroupTable from '@/components/section-view/SectionGroupTable.vue'
import { isForceRetryOfferError } from '@/repositories/TableRepository'
import { useSectionConfiguration } from '@/composables/section-view/useSectionConfiguration'
import { useGroupTables } from '@/composables/section-view/useGroupTables'
import { useSectionDisplay } from '@/composables/section-view/useSectionDisplay'
import {
  useTableData,
  invalidateTableDataCache,
  invalidateAllTableDataCaches,
} from '@/composables/section-view/useTableData'
import { ensureItemIds } from '@/composables/section-view/useExecutionTableData'
import CoreBulkUploadModal from '@/components/core/table/CoreBulkUploadModal.vue'
import CoreBulkEditModal from '@/components/core/table/CoreBulkEditModal.vue'
import {
  postEditAllTables,
  mapBulkUiOperationToEditAllApi,
} from '@/repositories/EditAllTablesRepository'
import type { EditAllTablesApiOperation } from '@/types/frontendAutomation'
import { useTableChanges } from '@/composables/useTableChanges'
import { useGeneralStore } from '@/stores/general'
import { useRecalculationController } from '@/composables/section-view/useRecalculationController'
import { generateAutoDashboard } from '@/services/AutoDashboardService'
import type { DashboardWidget } from '@/services/AutoDashboardService'
import {
  isFrontendAutomationRoute,
  isExecutionDataSectionRoute,
  isValidationGroup,
  isValidationLikeGroup,
  getInstanceTableKeysOrderedByMasterHierarchy,
  normalizeTableKeyForHierarchyMatch,
} from '@/services/FrontendAutomationService'
import AutoKPICard from '@/components/dashboard/AutoKPICard.vue'
import AutoLineChart from '@/components/dashboard/AutoLineChart.vue'
import AutoBarChart from '@/components/dashboard/AutoBarChart.vue'
import AutoPieChart from '@/components/dashboard/AutoPieChart.vue'
import AutoAreaChart from '@/components/dashboard/AutoAreaChart.vue'
import AutoMapChart from '@/components/dashboard/AutoMapChart.vue'
import appConfig from '@/app/config'
import {
  resolveDisplayValuesToFkIds,
  normalizeGetListResponseToRows,
} from '@/utils/schemaUtils'
import {
  sortKeysByCreateDependency,
  resolveTempIdsInPayload,
} from '@/utils/tableCreateDependencies'
import {
  resolveInstanceDataKeyForChangeKey,
  collectEditedEtlParameterKeysFromPendingChanges,
} from '@/utils/etlParameterCollection'
import {
  normalizeTableKey,
  resolveCurrentModalKey,
  resolveRowsDataForKey,
  resolveTableHeadersForKey,
} from '@/utils/sectionModalResolvers'
import {
  getErrorMessage,
  getConfigByStorageKey,
} from '@/utils/sectionSaveHelpers'

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
  tableSwitching,
} = useGroupTables(currentConfiguration, sectionType)

/**
 * Loading signal handed to CoreTable. Combines the existing data-loading
 * state from each `useTableData` instance with `tableSwitching` (true while a
 * group-tab change is in flight) so the centered overlay shows up the moment
 * the user clicks a tab — before the heavy reactivity work fires.
 */
const isTableUiLoading = (
  tableDataInstance: { loading: { value: boolean } } | null | undefined,
): boolean => {
  if (tableSwitching.value) return true
  return !!tableDataInstance?.loading?.value
}

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

const isRecalculationEnabled = computed(
  () => appConfig.getCore().parameters.enableSolutionRecalculation === true,
)

// Read-only display: input-data and results show data as plain table unless recalculation is enabled
const isReadOnlyDataSection = computed(() => {
  if (
    isRecalculationEnabled.value &&
    (sectionType.value === 'input-data' || sectionType.value === 'results')
  ) {
    return false
  }
  return sectionType.value === 'input-data' || sectionType.value === 'results'
})

// Configuration (master tables) section: show pending changes bar and review modal
const isConfigurationSection = computed(
  () => sectionType.value === 'configuration',
)

const isRecalculationSection = computed(
  () =>
    isRecalculationEnabled.value &&
    (sectionType.value === 'input-data' || sectionType.value === 'results'),
)

// Shared table changes (so bar and modal are common across all tabs in group view)
const tableChanges = useTableChanges()

/**
 * Snapshot of rows/headers per table key while browsing Input data / Results during
 * solution recalculation, so the review modal can show instance + solution edits together
 * after navigating between sections (single-table routes have no live row map off-route).
 */
const recalculationModalDataCache = ref<
  Record<
    string,
    {
      rowsData: Record<string, any>
      tableHeaders: Array<{ key: string; title: string; type?: string }>
    }
  >
>({})

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
  if (!isConfigurationSection.value && !isRecalculationSection.value) return false
  return tableChanges.hasChanges.value
})

const pendingChangesCount = computed(() => {
  if (!isConfigurationSection.value && !isRecalculationSection.value) return 0
  return tableChanges.totalChangesCount.value
})

const showBulkEditModal = ref(false)
const bulkEditSource = ref<'single' | 'group'>('single')
const showMasterTablePendingModal = ref(false)
const masterTableSaving = ref(false)
const masterTableValidationError = ref<string | null>(null)
/** When save-all triggers delete and backend returns offer_force_retry, show dialog and retry with force. */
const forceRetryOfferFromSaveAll = ref<{
  message: string
  storageKey: string
  ids: (string | number)[]
} | null>(null)
const forceRetryLoadingFromSaveAll = ref(false)

const recalculation = useRecalculationController()
const enableRecalculation = computed(
  () => appConfig.getCore().parameters.enableRecalculationOnMasterEdit === true,
)

// Solution recalculation modal state
const showRecalculationPendingModal = ref(false)
const recalculationSaving = ref(false)
const recalculationValidationError = ref<string | null>(null)

const openRecalculationPendingModal = () => {
  showRecalculationPendingModal.value = true
}

const handleCloseRecalculationPendingModal = () => {
  recalculationValidationError.value = null
  showRecalculationPendingModal.value = false
}

/**
 * Applies pending changes to a deep copy of the given data object (same logic
 * as ExecutionDataView.handleSaveAllChanges but decoupled from the component).
 * For execution data rows that lack an `id` field, the same deterministic
 * `ensureItemIds` scheme used by useExecutionTableData is applied so that
 * staged changes (recorded against `__row_N` IDs) can be matched correctly.
 * Synthetic IDs are stripped from the final output.
 */
const applyPendingChangesToData = (
  originalData: Record<string, any>,
): Record<string, any> => {
  const updatedData = JSON.parse(JSON.stringify(originalData))

  const normalize = (k: string) => String(k).toLowerCase().replaceAll('-', '_')

  // Build a map from normalized data key → actual data key so changes stored
  // under the normalized key can be applied to the correct data entry.
  const normalizedToDataKey: Record<string, string> = {}
  for (const dk of Object.keys(updatedData)) {
    normalizedToDataKey[normalize(dk)] = dk
  }

  // Merge original data keys with any modified keys from useTableChanges.
  const allNormalizedKeys = new Set([
    ...Object.keys(normalizedToDataKey),
    ...tableChanges.modifiedTableKeys.value,
  ])

  allNormalizedKeys.forEach((nk) => {
    const dataKey = normalizedToDataKey[nk] ?? nk
    const raw = updatedData[dataKey]
    if (!Array.isArray(raw)) return

    let tableRows = ensureItemIds([...raw])

    const deletes = tableChanges.getPendingDeletes(nk)
    if (deletes.length > 0) {
      const deleteSet = new Set(deletes.map(String))
      tableRows = tableRows.filter(
        (row: any) => !deleteSet.has(String(row.id)),
      )
    }

    const changes = tableChanges.getChangesForTable(nk)
    if (changes) {
      tableRows = tableRows.map((row: any) => {
        const rowChanges = changes[String(row.id)]
        if (!rowChanges) return row
        const merged = { ...row }
        Object.entries(rowChanges).forEach(
          ([fieldKey, change]: [string, any]) => {
            merged[fieldKey] = change.newValue
          },
        )
        return merged
      })
    }

    const creates = tableChanges.getPendingCreates(nk)
    creates.forEach((c) => {
      const { id: _tempId, ...rest } = c.data
      tableRows.push(rest)
    })

    // Strip synthetic IDs before sending to the API
    updatedData[dataKey] = tableRows.map((row: any) => {
      if (typeof row.id === 'string' && row.id.startsWith('__row_')) {
        const { id: _, ...rest } = row
        return rest
      }
      return row
    })
  })

  // Object-type keys (parameters, requirements, etc.)
  allNormalizedKeys.forEach((nk) => {
    const dataKey = normalizedToDataKey[nk] ?? nk
    const raw = updatedData[dataKey]
    if (Array.isArray(raw)) return
    if (raw != null && typeof raw !== 'object') return
    const changes = tableChanges.getChangesForTable(nk)
    if (!changes) return
    const merged = raw != null && typeof raw === 'object' ? { ...raw } : {}

    const OBJECT_ROW_ID = '__object__'
    const rowChangesHorizontal = changes[OBJECT_ROW_ID]
    if (rowChangesHorizontal) {
      Object.entries(rowChangesHorizontal).forEach(
        ([fieldKey, change]: [string, any]) => {
          merged[fieldKey] = change.newValue
        },
      )
    } else {
      for (const rowId of Object.keys(changes)) {
        const rowChanges = changes[rowId]
        if (rowChanges?.value) {
          merged[rowId] = rowChanges.value.newValue
        }
      }
    }
    updatedData[dataKey] = merged
  })

  return updatedData
}

const handleSolutionRecalculation = async () => {
  recalculationValidationError.value = null
  recalculationSaving.value = true

  try {
    const exec = generalStore.selectedExecution
    if (!exec) {
      recalculationValidationError.value = t(
        'recalculation.solutionRecalc.noExecutionError',
      )
      return
    }

    const instanceData =
      exec.experiment?.instance?.data ?? exec.instance?.data
    const solutionData =
      exec.experiment?.solution?.data ?? exec.solution?.data

    if (!instanceData || !solutionData) {
      recalculationValidationError.value = t(
        'recalculation.solutionRecalc.noDataError',
      )
      return
    }

    const passEtlEditedMetadata =
      appConfig.getCore().parameters.enableSolutionRecalculation === true &&
      appConfig.getCore().parameters.etl.enableEtlMetadataAndReview === true &&
      Boolean(instanceData.__metadata__)

    const instanceBeforeEdits = JSON.parse(JSON.stringify(instanceData))

    const etlEditedInstanceTableDataKeys = passEtlEditedMetadata
      ? Array.from(
          new Set(
            tableChanges.modifiedTableKeys.value
              .map((mk) => resolveInstanceDataKeyForChangeKey(instanceData, mk))
              .filter((k): k is string => k != null),
          ),
        )
      : undefined
    const etlEditedParametersFromDbKeys = passEtlEditedMetadata
      ? collectEditedEtlParameterKeysFromPendingChanges(
          instanceData,
          instanceData.__metadata__?.parameters_from_db ?? [],
          {
            modifiedTableKeys: tableChanges.modifiedTableKeys.value,
            getChangesForTable: tableChanges.getChangesForTable,
          },
        )
      : undefined

    const editedInstanceData = applyPendingChangesToData(instanceData)
    const editedSolutionData = applyPendingChangesToData(solutionData)

    // Preserve __metadata__ from original instance data
    if (instanceData.__metadata__) {
      editedInstanceData.__metadata__ = JSON.parse(
        JSON.stringify(instanceData.__metadata__),
      )
    }

    showRecalculationPendingModal.value = false
    tableChanges.clearAllChanges()
    recalculationModalDataCache.value = {}

    const executionName = recalculation.buildRecalculationExecutionName(
      exec.name || 'Recalculated',
    )

    await recalculation.runSolutionRecalculation({
      instanceData: editedInstanceData,
      solutionData: editedSolutionData,
      executionName,
      executionDescription: exec.description || '',
      executionConfig: exec.config || {},
      ...(passEtlEditedMetadata
        ? {
            etlInstanceDataBeforeEdits: instanceBeforeEdits,
            etlEditedInstanceTableDataKeys,
            etlEditedParametersFromDbKeys,
          }
        : {}),
    })
  } catch (err: any) {
    recalculationValidationError.value =
      err?.message || t('recalculation.solutionRecalc.genericError')
  } finally {
    recalculationSaving.value = false
  }
}

const showExitConfirmationModal = ref(false)
const pendingNavigationNext = ref<((abort?: boolean) => void) | null>(null)

const showEditAllMasterTablesModal = ref(false)
const editAllMasterTablesUploading = ref(false)
const pendingEditAllFiles = ref<File[]>([])
const pendingEditAllApiOperation = ref<EditAllTablesApiOperation>('post_bulk')
const editAllTablesForceContext = ref<{
  message: string
  forceTableKeys?: string[]
  retryTableKeys?: string[]
} | null>(null)
const editAllTablesForceLoading = ref(false)

const canEditAllMasterTables = computed(() => {
  if (!appConfig.getCore().parameters.enableReplaceMasterWithUploaded) return false
  if (sectionType.value !== 'configuration') return false
  const cfg = currentConfiguration.value
  if (!cfg || typeof cfg !== 'object') return false
  return Object.keys(cfg).length > 0
})

const handleEditAllMasterTablesUpload = async (uploadData: {
  files: File[]
  operation: string
}) => {
  if (!uploadData?.files?.length) {
    showSnackbar?.(t('table.messages.errorBulkUpload'), 'error')
    return
  }
  let postEditAllSucceeded = false
  editAllMasterTablesUploading.value = true
  try {
    const apiOp = mapBulkUiOperationToEditAllApi(uploadData.operation)
    pendingEditAllFiles.value = uploadData.files
    pendingEditAllApiOperation.value = apiOp
    await postEditAllTables(uploadData.files, apiOp)
    postEditAllSucceeded = true
  } catch (err) {
    if (
      isForceRetryOfferError(err) &&
      pendingEditAllApiOperation.value === 'overwrite_all'
    ) {
      editAllTablesForceContext.value = {
        message: err.message,
        forceTableKeys: err.forceTableKeys,
        retryTableKeys: err.retryTableKeys,
      }
      showEditAllMasterTablesModal.value = false
      return
    }
    const msg =
      err instanceof Error ? err.message : t('table.messages.errorBulkUpload')
    showSnackbar?.(msg, 'error')
  } finally {
    editAllMasterTablesUploading.value = false
    if (postEditAllSucceeded) {
      showEditAllMasterTablesModal.value = false
    }
  }

  if (!postEditAllSucceeded) return

  try {
    invalidateAllTableDataCaches()
    if (isGroupView.value) {
      await selectedTableData.loadData()
    } else {
      await tableData.loadData()
    }
    showSnackbar?.(t('sectionView.editAllMasterTablesSuccess'), 'success')
    if (enableRecalculation.value) {
      await recalculation.checkPlanDataAfterMasterDataChange()
    }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : t('table.messages.errorBulkUpload')
    showSnackbar?.(msg, 'error')
  }
}

const confirmEditAllTablesForceRetry = async () => {
  if (!editAllTablesForceContext.value) return
  const files = pendingEditAllFiles.value
  const op = pendingEditAllApiOperation.value
  if (!files.length || op !== 'overwrite_all') {
    editAllTablesForceContext.value = null
    return
  }
  const ctx = editAllTablesForceContext.value
  const forceKeys = ctx.forceTableKeys ?? []
  const retryKeys = ctx.retryTableKeys ?? []
  editAllTablesForceLoading.value = true
  try {
    await postEditAllTables(files, op, {
      force: forceKeys,
      retry: retryKeys,
      forceBoolean:
        forceKeys.length === 0 && retryKeys.length === 0 ? true : undefined,
    })
    editAllTablesForceContext.value = null
    pendingEditAllFiles.value = []
    showEditAllMasterTablesModal.value = false
    invalidateAllTableDataCaches()
    if (isGroupView.value) {
      await selectedTableData.loadData()
    } else {
      await tableData.loadData()
    }
    showSnackbar?.(t('sectionView.editAllMasterTablesSuccess'), 'success')
    if (enableRecalculation.value) {
      await recalculation.checkPlanDataAfterMasterDataChange()
    }
  } catch (err) {
    if (isForceRetryOfferError(err)) {
      editAllTablesForceContext.value = {
        message: err.message,
        forceTableKeys: err.forceTableKeys,
        retryTableKeys: err.retryTableKeys,
      }
      return
    }
    showSnackbar?.(
      err instanceof Error ? err.message : t('table.messages.errorBulkUpload'),
      'error',
    )
    editAllTablesForceContext.value = null
  } finally {
    editAllTablesForceLoading.value = false
  }
}

const cancelEditAllTablesForceRetry = () => {
  editAllTablesForceContext.value = null
  pendingEditAllFiles.value = []
}

const openMasterTablePendingModal = () => {
  masterTableValidationError.value = null
  showMasterTablePendingModal.value = true
}

const handleBulkEditEvent = (source: 'single' | 'group') => {
  bulkEditSource.value = source
  showBulkEditModal.value = true
}

const handleBulkEditApply = (fieldValues: Record<string, any>) => {
  const handler = bulkEditSource.value === 'group'
    ? selectedTableData.handleBulkEdit
    : tableData.handleBulkEdit
  if (handler) handler(fieldValues)
  showBulkEditModal.value = false
}

const activeBulkEditHeaders = computed(() => {
  const td = bulkEditSource.value === 'group' ? selectedTableData : tableData
  return td.headers.value
})

const activeBulkEditSelectedCount = computed(() => {
  const td = bulkEditSource.value === 'group' ? selectedTableData : tableData
  return td.selectedItems.value.length
})

onBeforeRouteLeave((to, from, next) => {
  // Master tables: only skip the dialog when both ends are under /configuration/*
  // (leaving Input/Results for configuration still counts as leaving the execution edit area).
  if (
    isFrontendAutomationRoute(to.path) &&
    isFrontendAutomationRoute(from.path)
  ) {
    next()
    return
  }
  // Solution recalculation: only Input data ↔ Results (/output-data) share one buffer;
  // any other destination (configuration, dashboard, …) must show the leave dialog.
  if (
    isRecalculationEnabled.value &&
    hasPendingChanges.value &&
    isRecalculationSection.value &&
    isExecutionDataSectionRoute(to.path) &&
    isExecutionDataSectionRoute(from.path)
  ) {
    next()
    return
  }
  if ((!isConfigurationSection.value && !isRecalculationSection.value) || !hasPendingChanges.value) {
    next()
    return
  }
  pendingNavigationNext.value = next
  showExitConfirmationModal.value = true
})

const handleConfirmExit = () => {
  showExitConfirmationModal.value = false
  tableChanges.clearAllChanges()
  groupModalDataCache.value = {}
  recalculationModalDataCache.value = {}
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

const handleMasterTableSaveAll = async () => {
  masterTableValidationError.value = null
  masterTableSaving.value = true
  try {
    await saveAllMasterTableChanges()
    showMasterTablePendingModal.value = false

    if (enableRecalculation.value) {
      await recalculation.checkPlanDataAfterMasterDataChange()
    }
  } catch (err) {
    if (isForceRetryOfferError(err)) {
      return
    }
    masterTableValidationError.value = getErrorMessage(err, t('table.messages.errorSaving'))
  } finally {
    masterTableSaving.value = false
  }
}

const handleForceRetryConfirmFromSaveAll = async () => {
  const offer = forceRetryOfferFromSaveAll.value
  if (!offer) return
  forceRetryLoadingFromSaveAll.value = true
  try {
    const config = getConfigByStorageKey(currentConfiguration.value, offer.storageKey)
    if (!config) throw new Error('Table config not found')
    const { default: TableRepository } = await import(
      '@/repositories/TableRepository'
    )
    const repository = new TableRepository(config, t)
    await repository.deleteBulk(offer.ids, { force: true })
    tableChanges.clearDeletesForTable(offer.storageKey)
    forceRetryOfferFromSaveAll.value = null
    await saveAllMasterTableChanges()
    showMasterTablePendingModal.value = false
    if (enableRecalculation.value) {
      await recalculation.checkPlanDataAfterMasterDataChange()
    }
  } catch (err) {
    if (isForceRetryOfferError(err)) {
      return
    }
    masterTableValidationError.value = getErrorMessage(err, t('table.messages.errorSaving'))
    forceRetryOfferFromSaveAll.value = null
  } finally {
    forceRetryLoadingFromSaveAll.value = false
  }
}

/** Apply pending deletes for a single table in a group save operation. */
async function applyGroupDeletes(
  storageKey: string,
  config: any,
  repository: any,
): Promise<void> {
  const deletes = tableChanges.getPendingDeletes(storageKey)
  if (config?.delete_item && deletes.length > 0) {
    for (const rowId of deletes) {
      await repository.deleteItem(rowId)
    }
    tableChanges.clearDeletesForTable(storageKey)
  }
}

/** Apply pending creates for a single table in a group save operation. */
async function applyGroupCreates(
  storageKey: string,
  config: any,
  repository: any,
  tempIdToRealId: Record<string, string | number>,
  loadTableDataForGroup: (tableName: string) => Promise<any[]>,
): Promise<void> {
  const creates = tableChanges.getPendingCreates(storageKey)
  if (config?.post_item && creates.length > 0) {
    for (const { tempId, data } of creates) {
      const { id: _id, ...rawPayload } = data
      const payloadWithTempIds = resolveTempIdsInPayload(rawPayload, tempIdToRealId, config)
      const payload = await resolveDisplayValuesToFkIds(payloadWithTempIds, config, loadTableDataForGroup)
      const result = await repository.createItem(payload)
      const realId = result?.id ?? result?.pk
      if (realId != null) tempIdToRealId[tempId] = realId
    }
    tableChanges.clearCreatesForTable(storageKey)
  }
}

/**
 * Build the PUT payload for one edited row: locate the row in `items` by id,
 * merge its pending field changes, then resolve temp ids. Returns `null` when
 * the row is no longer present in `items` (caller should skip it).
 */
function buildPutPayloadWithTempIds(
  rowId: string,
  rowChanges: Record<string, any>,
  items: any[],
  tempIdToRealId: Record<string, string | number>,
  config: any,
): Record<string, any> | null {
  const row = items.find((i: any) => String(i.id) === rowId)
  if (!row) return null
  const merged = { ...row }
  Object.entries(rowChanges).forEach(([fieldKey, change]: [string, any]) => {
    merged[fieldKey] = change.newValue
  })
  return resolveTempIdsInPayload(
    { ...merged } as Record<string, any>,
    tempIdToRealId,
    config,
  )
}

/** Apply pending cell edits for a single table in a group save operation. */
async function applyGroupEdits(
  storageKey: string,
  config: any,
  repository: any,
  tempIdToRealId: Record<string, string | number>,
  loadTableDataForGroup: (tableName: string) => Promise<any[]>,
): Promise<void> {
  const changes = tableChanges.getChangesForTable(storageKey)
  if (config?.put_item && changes) {
    const items = normalizeGetListResponseToRows(await repository.getList(), config)
    for (const [rowId, rowChanges] of Object.entries(changes)) {
      const withTempIds = buildPutPayloadWithTempIds(
        rowId,
        rowChanges,
        items,
        tempIdToRealId,
        config,
      )
      if (!withTempIds) continue
      const preparedData = await resolveDisplayValuesToFkIds(withTempIds, config, loadTableDataForGroup)
      delete preparedData.id
      await repository.putItem(rowId, preparedData)
    }
    tableChanges.revertTableChanges(storageKey)
  }
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
    return normalizeGetListResponseToRows(data, refConfig)
  }

  const getCreates = (storageKey: string) =>
    tableChanges.getPendingCreates(storageKey)
  const orderedKeys = sortKeysByCreateDependency(keys, getCreates)
  const tempIdToRealId: Record<string, string | number> = {}

  for (const storageKey of orderedKeys) {
    const configKey = Object.keys(groupTables.value).find(
      (gk) => normalizeTableKey(gk) === storageKey,
    )
    if (!configKey) continue

    const config = groupTables.value[configKey]
    const repository = new TableRepository(config, t)

    // 1. Apply pending deletes
    await applyGroupDeletes(storageKey, config, repository)

    // 2. Apply pending creates: resolve FKs (temp id → real id), resolve display values to FK ids, then POST
    await applyGroupCreates(storageKey, config, repository, tempIdToRealId, loadTableDataForGroup)

    // 3. Apply cell edits (put): resolve display values to FK ids so API receives id_values.
    await applyGroupEdits(storageKey, config, repository, tempIdToRealId, loadTableDataForGroup)
  }

  // Invalidate cache for each saved table so selectors in other sections see new rows
  for (const storageKey of orderedKeys) {
    invalidateTableDataCache(storageKey)
  }

  // Refresh current tab data so the new record appears in the table
  await selectedTableData.loadData()
}

/** Apply pending deletes for a single table in the global save operation (bulk when supported). */
async function applyAllDeletes(
  storageKey: string,
  config: any,
  repository: any,
): Promise<void> {
  const deletes = tableChanges.getPendingDeletes(storageKey)
  if (deletes.length === 0) return
  try {
    if (config?.delete_bulk) {
      await repository.deleteBulk(deletes)
    } else if (config?.delete_item) {
      for (const rowId of deletes) {
        await repository.deleteItem(rowId)
      }
    }
  } catch (err) {
    if (isForceRetryOfferError(err) && config?.delete_bulk) {
      forceRetryOfferFromSaveAll.value = {
        message: err.message,
        storageKey,
        ids: deletes,
      }
      throw err
    }
    throw err
  }
  tableChanges.clearDeletesForTable(storageKey)
}

/** Apply bulk creates for a single table in the global save operation. */
async function applyBulkCreates(
  creates: Array<{ tempId: string; data: any }>,
  config: any,
  repository: any,
  tempIdToRealId: Record<string, string | number>,
  loadTableDataForSave: (tableName: string) => Promise<any[]>,
): Promise<void> {
  const payloads = await Promise.all(
    creates.map(async ({ data }) => {
      const { id: _id, ...rawPayload } = data
      const payloadWithTempIds = resolveTempIdsInPayload(rawPayload, tempIdToRealId, config)
      return resolveDisplayValuesToFkIds(payloadWithTempIds, config, loadTableDataForSave)
    }),
  )
  const result = await repository.createBulk(payloads)
  const createdItems = Array.isArray(result) ? result : [result]
  createdItems.forEach((item: any, i: number) => {
    const tempId = creates[i]?.tempId
    const realId = item?.id ?? item?.pk
    if (tempId != null && realId != null) tempIdToRealId[tempId] = realId
  })
}

/** Apply single creates for a single table in the global save operation. */
async function applySingleCreates(
  creates: Array<{ tempId: string; data: any }>,
  config: any,
  repository: any,
  tempIdToRealId: Record<string, string | number>,
  loadTableDataForSave: (tableName: string) => Promise<any[]>,
): Promise<void> {
  for (const { tempId, data } of creates) {
    const { id: _id, ...rawPayload } = data
    const payloadWithTempIds = resolveTempIdsInPayload(rawPayload, tempIdToRealId, config)
    const payload = await resolveDisplayValuesToFkIds(payloadWithTempIds, config, loadTableDataForSave)
    const result = await repository.createItem(payload)
    const realId = result?.id ?? result?.pk
    if (realId != null) tempIdToRealId[tempId] = realId
  }
}

/** Apply pending creates for a single table in the global save operation (bulk when supported). */
async function applyAllCreates(
  storageKey: string,
  config: any,
  repository: any,
  tempIdToRealId: Record<string, string | number>,
  loadTableDataForSave: (tableName: string) => Promise<any[]>,
): Promise<void> {
  const creates = tableChanges.getPendingCreates(storageKey)
  if (creates.length === 0) return
  if (config?.post_bulk) {
    await applyBulkCreates(creates, config, repository, tempIdToRealId, loadTableDataForSave)
  } else if (config?.post_item) {
    await applySingleCreates(creates, config, repository, tempIdToRealId, loadTableDataForSave)
  }
  tableChanges.clearCreatesForTable(storageKey)
}

/** Apply pending cell edits for a single table in the global save operation (batched parallel puts). */
async function applyAllEdits(
  storageKey: string,
  config: any,
  repository: any,
  tempIdToRealId: Record<string, string | number>,
  loadTableDataForSave: (tableName: string) => Promise<any[]>,
): Promise<void> {
  const changes = tableChanges.getChangesForTable(storageKey)
  if (!config?.put_item || !changes || Object.keys(changes).length === 0) return
  const items = normalizeGetListResponseToRows(await repository.getList(), config)
  const CONCURRENT_PUTS = 10
  const putTasks: Array<{ rowId: string; merged: Record<string, any> }> = []
  for (const [rowId, rowChanges] of Object.entries(changes)) {
    const withTempIds = buildPutPayloadWithTempIds(
      rowId,
      rowChanges,
      items,
      tempIdToRealId,
      config,
    )
    if (!withTempIds) continue
    putTasks.push({ rowId, merged: withTempIds })
  }
  const resolvedPayloads = await Promise.all(
    putTasks.map(({ merged }) => resolveDisplayValuesToFkIds(merged, config, loadTableDataForSave)),
  )
  for (const p of resolvedPayloads) delete p.id
  for (let i = 0; i < putTasks.length; i += CONCURRENT_PUTS) {
    const batch = putTasks.slice(i, i + CONCURRENT_PUTS)
    await Promise.all(
      batch.map((task, j) => repository.putItem(task.rowId, resolvedPayloads[i + j])),
    )
  }
  tableChanges.revertTableChanges(storageKey)
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
    const config = getConfigByStorageKey(currentConfiguration.value, storageKey)
    if (!config) continue

    const repository = new TableRepository(config, t)
    const loadTableDataForSave = (tableName: string) =>
      tableData.loadTableData(tableName)

    // 1. Pending deletes (use bulk when supported to avoid N calls)
    await applyAllDeletes(storageKey, config, repository)

    // 2. Pending creates (use bulk when supported to avoid N calls)
    await applyAllCreates(storageKey, config, repository, tempIdToRealId, loadTableDataForSave)

    // 3. Cell edits (run putItem in parallel batches for speed)
    await applyAllEdits(storageKey, config, repository, tempIdToRealId, loadTableDataForSave)

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
  forceRetryOfferFromSaveAll.value = null
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

/** Merge current table modal snapshots into a cross-route cache for solution recalculation. */
watch(
  [
    () => isRecalculationSection.value,
    () => isGroupView.value,
    () => tableData.rowsDataForModal.value,
    () => tableData.tableHeadersForModal.value,
    () => selectedTableData.rowsDataForModal.value,
    () => selectedTableData.tableHeadersForModal.value,
  ],
  () => {
    if (!isRecalculationSection.value) return
    const rd = isGroupView.value
      ? selectedTableData.rowsDataForModal.value
      : tableData.rowsDataForModal.value
    const th = isGroupView.value
      ? selectedTableData.tableHeadersForModal.value
      : tableData.tableHeadersForModal.value
    if (!rd || typeof rd !== 'object') return
    const next = { ...recalculationModalDataCache.value }
    for (const k of Object.keys(rd)) {
      const headers = th[k]
      next[k] = {
        rowsData: rd[k] ?? {},
        tableHeaders: Array.isArray(headers) ? headers : [],
      }
    }
    recalculationModalDataCache.value = next
  },
  { deep: true },
)

/** Aggregated rowsData and tableHeaders for the review modal (all modified tables, across sections). */
const aggregatedRowsDataForModal = computed(() => {
  const allKeys = tableChanges.modifiedTableKeys.value
  const result: Record<string, Record<string, any>> = {}
  const currentKey = resolveCurrentModalKey(isGroupView.value, selectedTable.value, effectiveTableKey.value)
  const liveRd = isGroupView.value
    ? selectedTableData.rowsDataForModal.value
    : tableData.rowsDataForModal.value
  for (const key of allKeys) {
    result[key] = resolveRowsDataForKey(
      key,
      currentKey,
      isRecalculationSection.value,
      isGroupView.value,
      liveRd,
      recalculationModalDataCache.value,
      groupModalDataCache.value,
    )
  }
  return result
})

const aggregatedTableHeadersForModal = computed(() => {
  const allKeys = tableChanges.modifiedTableKeys.value
  const result: Record<string, Array<{ key: string; title: string; type?: string }>> = {}
  const currentKey = resolveCurrentModalKey(isGroupView.value, selectedTable.value, effectiveTableKey.value)
  const liveTh = isGroupView.value
    ? selectedTableData.tableHeadersForModal.value
    : tableData.tableHeadersForModal.value
  for (const key of allKeys) {
    result[key] = resolveTableHeadersForKey(
      key,
      currentKey,
      isRecalculationSection.value,
      isGroupView.value,
      liveTh,
      recalculationModalDataCache.value,
      groupModalDataCache.value,
    )
  }
  return result
})

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

watch(
  () => generalStore.selectedExecution?.executionId,
  (id, prev) => {
    if (id === prev) return
    groupModalDataCache.value = {}
    recalculationModalDataCache.value = {}
  },
)

const { locale, t } = useI18n()
const showSnackbar =
  inject<(message: string, type?: string) => void>('showSnackbar')

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

const etlTablesFromDbNormalized = computed<Set<string>>(() => {
  const execution = generalStore.selectedExecution
  const instanceData =
    execution?.experiment?.instance?.data ?? execution?.instance?.data

  if (!instanceData || typeof instanceData !== 'object') {
    return new Set<string>()
  }

  const metadata = (instanceData as Record<string, any>).__metadata__
  if (!metadata || typeof metadata !== 'object') {
    return new Set<string>()
  }

  const tablesFromDb = Array.isArray(metadata.tables_from_db)
    ? metadata.tables_from_db.filter(
        (tableName: unknown) => typeof tableName === 'string',
      )
    : []

  return new Set(
    tablesFromDb.map((tableName: string) =>
      normalizeTableKeyForHierarchyMatch(tableName),
    ),
  )
})

const etlParametersFromDbNormalized = computed<Set<string>>(() => {
  const execution = generalStore.selectedExecution
  const instanceData =
    execution?.experiment?.instance?.data ?? execution?.instance?.data

  if (!instanceData || typeof instanceData !== 'object') {
    return new Set<string>()
  }

  const metadata = (instanceData as Record<string, any>).__metadata__
  if (!metadata || typeof metadata !== 'object') {
    return new Set<string>()
  }

  const parametersFromDb = Array.isArray(metadata.parameters_from_db)
    ? metadata.parameters_from_db.filter(
        (parameterName: unknown) => typeof parameterName === 'string',
      )
    : []

  return new Set(
    parametersFromDb.map((parameterName: string) => {
      const dotIndex = parameterName.lastIndexOf('.')
      if (dotIndex === -1) {
        return normalizeTableKeyForHierarchyMatch(parameterName)
      }
      const tableName = parameterName.slice(0, dotIndex)
      const fieldName = parameterName.slice(dotIndex + 1)
      return `${normalizeTableKeyForHierarchyMatch(tableName)}.${normalizeTableKeyForHierarchyMatch(fieldName)}`
    }),
  )
})

const isObjectParameterTable = (tableKey: string): boolean => {
  const config = currentConfiguration.value?.[tableKey]
  const responseSchema = config?.get_list?.response_schema
  if (!responseSchema || typeof responseSchema !== 'object') return false
  const isObjectType =
    responseSchema.type === 'object' ||
    (responseSchema.properties && !responseSchema.items)
  return Boolean(isObjectType)
}

const showEtlTabOriginIndicators = computed(() => {
  if (isValidationLikeGroup(groupName.value)) return false
  if (sectionType.value !== 'input-data') return false
  if (!isGroupView.value) return false
  if (appConfig.getCore().parameters.etl.enableEtlMetadataAndReview !== true) {
    return false
  }
  return etlTablesFromDbNormalized.value.size > 0
})

const isTableFromDb = (tableKey: string) =>
  etlTablesFromDbNormalized.value.has(
    normalizeTableKeyForHierarchyMatch(tableKey),
  )

const showEtlTabOriginIndicatorsForTable = (tableKey: string): boolean => {
  if (!showEtlTabOriginIndicators.value) return false
  if (isObjectParameterTable(tableKey)) return false
  return true
}

const buildHeaderOriginIndicators = (
  currentTableKey: string | null | undefined,
  headers: Array<{ key?: string }>,
): Record<string, { source: 'db' | 'file'; tooltip?: string }> => {
  if (isValidationLikeGroup(groupName.value)) {
    return {}
  }
  if (
    sectionType.value !== 'input-data' ||
    appConfig.getCore().parameters.etl.enableEtlMetadataAndReview !== true
  ) {
    return {}
  }
  if (!currentTableKey || !isObjectParameterTable(currentTableKey)) return {}

  const normalizedTable = normalizeTableKeyForHierarchyMatch(currentTableKey)
  const result: Record<string, { source: 'db' | 'file'; tooltip?: string }> = {}
  headers
    .map((h) => String(h?.key ?? ''))
    .filter((key) => key && key !== 'selection' && key !== 'id')
    .forEach((key) => {
      const normalizedField = normalizeTableKeyForHierarchyMatch(key)
      const metadataKey = `${normalizedTable}.${normalizedField}`
      const source: 'db' | 'file' = etlParametersFromDbNormalized.value.has(
        metadataKey,
      )
        ? 'db'
        : 'file'
      result[key] = {
        source,
        tooltip:
          source === 'db'
            ? t('sectionView.etlMetadataInfo.fromDbValueTooltip')
            : t('sectionView.etlMetadataInfo.notFromDbValueTooltip'),
      }
    })
  return result
}

const etlHeaderOriginIndicatorsForSingleTable = computed(() =>
  buildHeaderOriginIndicators(tableKey.value, tableData.headers.value as any[]),
)

const etlHeaderOriginIndicatorsForSelectedTable = computed(() =>
  buildHeaderOriginIndicators(
    selectedTable.value,
    selectedTableData.headers.value as any[],
  ),
)

// Build filename for downloads from selected execution
const downloadFilename = computed(() => {
  const exec = generalStore.selectedExecution
  if (!exec) return 'execution'
  const name = (exec.name || 'execution').toLowerCase().replaceAll(/\s+/g, '_')
  return `${name}-${formatDateForFilename(exec.createdAt)}`
})

/**
 * For instance downloads, place tables matched to frontend-automation master tables first,
 * sorted by master order, then keep remaining instance tables in their original order.
 */
const getInstancePreferredTableOrderForDownload = (): string[] => {
  const exec = generalStore.selectedExecution
  const instanceData = exec?.experiment?.instance?.data ?? exec?.instance?.data
  const instanceKeys = instanceData ? Object.keys(instanceData) : []
  if (instanceKeys.length === 0) return []

  const masterDataConfig = generalStore.getConfigurations?.masterData
  if (!masterDataConfig || typeof masterDataConfig !== 'object') return []

  return getInstanceTableKeysOrderedByMasterHierarchy(
    instanceKeys,
    masterDataConfig,
    generalStore.masterDataSections ?? undefined,
    generalStore.masterDataGroups ?? undefined,
  )
}

/**
 * When `useBackendExecutionFilesDownload` is true, route input-data / results
 * downloads through `generalStore.getDataToDownload(...)` so they use the same
 * backend-zip endpoint (`GET /execution/files/<id>/`) as the history execution
 * table — including its fallback to a local Excel build when the backend has
 * no file available.
 *
 * Returns `true` if the backend flow ran (success or backend-handled fallback);
 * `false` when the flag is off or the selected execution has no id (callers
 * should then use their per-section local Excel build).
 */
const tryBackendExecutionFilesDownload = async (
  exec: any,
): Promise<boolean> => {
  const useBackend =
    appConfig.getCore().parameters?.useBackendExecutionFilesDownload === true
  if (!useBackend) return false
  const executionId = exec?.executionId ?? exec?.id
  if (!executionId) return false

  try {
    await generalStore.getDataToDownload(executionId, true, true)
    showSnackbar?.(t('sectionView.downloadSuccess'), 'success')
  } catch (error) {
    const i18nKey = (error as { i18nKey?: string })?.i18nKey
    const message = i18nKey ? t(i18nKey) : t('sectionView.downloadError')
    showSnackbar?.(message, 'error')
  }
  return true
}

// Download instance only - file is instance (reuses Experiment.downloadExcel)
const downloadInstanceExcel = async () => {
  const exec = generalStore.selectedExecution
  if (!exec?.experiment?.instance?.data) {
    showSnackbar?.(t('sectionView.downloadNoData'), 'error')
    return
  }
  if (await tryBackendExecutionFilesDownload(exec)) return
  try {
    const preferredTableOrder = getInstancePreferredTableOrderForDownload()
    await exec.experiment.downloadExcel(
      downloadFilename.value,
      true,
      false,
      preferredTableOrder,
    )
    showSnackbar?.(t('sectionView.downloadSuccess'), 'success')
  } catch {
    showSnackbar?.(t('sectionView.downloadError'), 'error')
  }
}

// Download solution only - file is solution (reuses Experiment.downloadExcel)
const downloadSolutionExcel = async () => {
  const exec = generalStore.selectedExecution
  if (!exec?.experiment?.solution?.data) {
    showSnackbar?.(t('sectionView.downloadNoData'), 'error')
    return
  }
  if (await tryBackendExecutionFilesDownload(exec)) return
  try {
    await exec.experiment.downloadExcel(downloadFilename.value, false, true)
    showSnackbar?.(t('sectionView.downloadSuccess'), 'success')
  } catch {
    showSnackbar?.(t('sectionView.downloadError'), 'error')
  }
}

// When in Validaciones group: download instance checks (input-data) or solution checks (results)
const isValidationsGroup = computed(() => isValidationGroup(groupName.value))

const downloadInstanceChecksExcel = async () => {
  const exec = generalStore.selectedExecution
  const checks =
    exec?.experiment?.instance?.dataChecks ?? exec?.instance?.dataChecks
  if (
    !checks ||
    typeof checks !== 'object' ||
    Object.keys(checks).length === 0
  ) {
    showSnackbar?.(t('sectionView.downloadNoData'), 'error')
    return
  }
  try {
    await exec.experiment.downloadInstanceChecksExcel(downloadFilename.value)
    showSnackbar?.(t('sectionView.downloadSuccess'), 'success')
  } catch {
    showSnackbar?.(t('sectionView.downloadError'), 'error')
  }
}

/** Return true when the selected execution has a non-empty instance dataChecks object. */
function execHasInstanceChecks(exec: any): boolean {
  const checks = exec?.experiment?.instance?.dataChecks ?? exec?.instance?.dataChecks
  return (
    exec != null &&
    checks != null &&
    typeof checks === 'object' &&
    Object.keys(checks).length > 0
  )
}

/** Return true when the selected execution has a non-empty solution dataChecks object. */
function execHasSolutionChecks(exec: any): boolean {
  const checks = exec?.experiment?.solution?.dataChecks ?? exec?.solution?.dataChecks
  return (
    exec != null &&
    checks != null &&
    typeof checks === 'object' &&
    Object.keys(checks).length > 0
  )
}

const downloadSolutionChecksExcel = async () => {
  const exec = generalStore.selectedExecution
  const checks =
    exec?.experiment?.solution?.dataChecks ?? exec?.solution?.dataChecks
  if (
    !checks ||
    typeof checks !== 'object' ||
    Object.keys(checks).length === 0
  ) {
    showSnackbar?.(t('sectionView.downloadNoData'), 'error')
    return
  }
  try {
    await exec.experiment.downloadSolutionChecksExcel(downloadFilename.value)
    showSnackbar?.(t('sectionView.downloadSuccess'), 'success')
  } catch {
    showSnackbar?.(t('sectionView.downloadError'), 'error')
  }
}

/** Build the dropdown items shown for the `input-data` section. */
function buildInputDataDropdownItems(exec: any): any[] {
  const items: any[] = []
  const hasInstance = exec?.experiment?.instance?.data ?? exec?.instance?.data
  const canEdit =
    appConfig.getCore().parameters.allowEditInstance &&
    exec &&
    (exec.instance || exec.experiment?.instance)

  if (canEdit) {
    items.push({
      id: 'edit-input-data',
      title: t('sectionView.editInputData'),
      icon: 'mdi-pencil',
      action: () => navigateToEditInstance(),
    })
  }
  if (exec && (isValidationsGroup.value ? execHasInstanceChecks(exec) : hasInstance)) {
    items.push({
      id: 'download-excel',
      title: t('sectionView.downloadExcel'),
      icon: 'mdi-file-excel',
      action: () =>
        isValidationsGroup.value
          ? downloadInstanceChecksExcel()
          : downloadInstanceExcel(),
    })
  }
  return items
}

/** Build the dropdown items shown for the `results` section. */
function buildResultsDropdownItems(exec: any): any[] {
  const items: any[] = []
  const hasSolution = exec?.experiment?.solution?.data ?? exec?.solution?.data

  if (exec && (isValidationsGroup.value ? execHasSolutionChecks(exec) : hasSolution)) {
    items.push({
      id: 'download-excel',
      title: t('sectionView.downloadExcel'),
      icon: 'mdi-file-excel',
      action: () =>
        isValidationsGroup.value
          ? downloadSolutionChecksExcel()
          : downloadSolutionExcel(),
    })
  }
  return items
}

// Dropdown menu items for SectionView
const dropdownMenuItems = computed(() => {
  const items: any[] = []
  if (sectionType.value === 'configuration' && canEditAllMasterTables.value) {
    items.push({
      id: 'edit-all-master-tables',
      title: t('sectionView.editAllMasterTables'),
      icon: 'mdi-database-import',
      action: () => {
        showEditAllMasterTablesModal.value = true
      },
    })
  }

  const exec = generalStore.selectedExecution
  if (sectionType.value === 'input-data') {
    items.push(...buildInputDataDropdownItems(exec))
  } else if (sectionType.value === 'results') {
    items.push(...buildResultsDropdownItems(exec))
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

// Handle dropdown item click — do not call item.action() here; CoreDropdownMenu
// already runs it on click, so calling it again would trigger downloads twice.
const handleDropdownItemClick = (_item: any) => {
  // Optional: add analytics or other side effects only when needed
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
