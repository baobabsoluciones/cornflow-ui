<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :max-width="isFullscreen ? undefined : 1200"
    :fullscreen="isFullscreen"
    scrollable
  >
    <v-card
      class="core-modal-base data-comparison-modal"
      :class="{ 'fullscreen-modal': isFullscreen }"
    >
      <!-- Header -->
      <v-card-title class="core-modal-base__header data-comparison-modal__header">
        <div class="d-flex align-center">
          <div class="data-comparison-modal__header-icon">
            <v-icon size="20" color="white">mdi-compare</v-icon>
          </div>
          <div class="data-comparison-modal__header-text">
            <span class="core-modal-base__title">
              {{ $t('dataComparison.title', { tableName }) }}
            </span>
            <span class="data-comparison-modal__subtitle">
              {{ $t('dataComparison.subtitle', { masterTable: masterTableTitle }) }}
            </span>
          </div>
        </div>
        <div class="d-flex align-center" style="gap: 4px;">
          <v-btn
            :icon="isFullscreen ? 'mdi-window-restore' : 'mdi-window-maximize'"
            variant="text"
            size="small"
            @click="toggleFullscreen"
            :title="
              isFullscreen
                ? $t('projectExecution.minimize')
                : $t('projectExecution.maximize')
            "
          />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            class="core-modal-base__close"
            @click="close"
          />
        </div>
      </v-card-title>

      <!-- Content -->
      <v-card-text class="core-modal-base__content data-comparison-modal__content">
        <!-- Loading overlay -->
        <div v-if="isLoading" class="data-comparison-modal__loading">
          <v-progress-circular
            indeterminate
            size="44"
            width="3"
            class="data-comparison-modal__spinner"
          ></v-progress-circular>
          <p class="data-comparison-modal__loading-text">{{ $t('dataComparison.loading') }}</p>
        </div>

        <!-- Content (hidden while loading) -->
        <div v-else>
          <!-- View mode tabs -->
          <v-tabs
            v-model="viewMode"
            class="data-comparison-modal__tabs mb-5"
            density="comfortable"
          >
            <v-tab value="summary" class="data-comparison-modal__tab">
              <v-icon size="18" class="mr-2">mdi-chart-bar</v-icon>
              {{ $t('dataComparison.tabs.summary') }}
            </v-tab>
            <v-tab value="side-by-side" class="data-comparison-modal__tab">
              <v-icon size="18" class="mr-2">mdi-view-split-vertical</v-icon>
              {{ $t('dataComparison.tabs.sideBySide') }}
            </v-tab>
            <v-tab value="changes" class="data-comparison-modal__tab">
              <v-icon size="18" class="mr-2">mdi-delta</v-icon>
              {{ $t('dataComparison.tabs.changes') }}
            </v-tab>
          </v-tabs>

          <v-window v-model="viewMode">
            <!-- Summary view -->
            <v-window-item value="summary">
              <div class="data-comparison-modal__summary">
                <!-- Data source cards -->
                <v-row>
                  <v-col cols="12" md="6">
                    <div class="data-comparison-modal__source-card">
                      <div class="data-comparison-modal__source-icon data-comparison-modal__source-icon--instance">
                        <v-icon size="22" color="white">mdi-upload</v-icon>
                      </div>
                      <div class="data-comparison-modal__source-info">
                        <span class="data-comparison-modal__source-label">
                          {{ $t('dataComparison.uploadedData') }}
                        </span>
                        <span class="data-comparison-modal__source-value">
                          {{ diffSummary.totalInstance }}
                          <span class="data-comparison-modal__source-unit">{{ $t('dataComparison.rows') }}</span>
                        </span>
                      </div>
                    </div>
                  </v-col>
                  <v-col cols="12" md="6">
                    <div class="data-comparison-modal__source-card">
                      <div class="data-comparison-modal__source-icon data-comparison-modal__source-icon--master">
                        <v-icon size="22" color="white">mdi-database</v-icon>
                      </div>
                      <div class="data-comparison-modal__source-info">
                        <span class="data-comparison-modal__source-label">
                          {{ $t('dataComparison.masterData') }}
                        </span>
                        <span class="data-comparison-modal__source-value">
                          {{ diffSummary.totalMaster }}
                          <span class="data-comparison-modal__source-unit">{{ $t('dataComparison.rows') }}</span>
                        </span>
                      </div>
                    </div>
                  </v-col>
                </v-row>

                <!-- Diff stats -->
                <div class="data-comparison-modal__stats-grid">
                  <div class="data-comparison-modal__stat data-comparison-modal__stat--added">
                    <div class="data-comparison-modal__stat-icon-wrap">
                      <v-icon size="20">mdi-plus-circle</v-icon>
                    </div>
                    <div class="data-comparison-modal__stat-value">
                      {{ diffSummary.onlyInInstance }}
                    </div>
                    <div class="data-comparison-modal__stat-label">
                      {{ $t('dataComparison.newRows') }}
                    </div>
                  </div>
                  <div class="data-comparison-modal__stat data-comparison-modal__stat--removed">
                    <div class="data-comparison-modal__stat-icon-wrap">
                      <v-icon size="20">mdi-minus-circle</v-icon>
                    </div>
                    <div class="data-comparison-modal__stat-value">
                      {{ diffSummary.onlyInMaster }}
                    </div>
                    <div class="data-comparison-modal__stat-label">
                      {{ $t('dataComparison.removedRows') }}
                    </div>
                  </div>
                  <div class="data-comparison-modal__stat data-comparison-modal__stat--modified">
                    <div class="data-comparison-modal__stat-icon-wrap">
                      <v-icon size="20">mdi-pencil-circle</v-icon>
                    </div>
                    <div class="data-comparison-modal__stat-value">
                      {{ diffSummary.different }}
                    </div>
                    <div class="data-comparison-modal__stat-label">
                      {{ $t('dataComparison.modifiedRows') }}
                    </div>
                  </div>
                  <div class="data-comparison-modal__stat data-comparison-modal__stat--identical">
                    <div class="data-comparison-modal__stat-icon-wrap">
                      <v-icon size="20">mdi-check-circle</v-icon>
                    </div>
                    <div class="data-comparison-modal__stat-value">
                      {{ diffSummary.identical }}
                    </div>
                    <div class="data-comparison-modal__stat-label">
                      {{ $t('dataComparison.identicalRows') }}
                    </div>
                  </div>
                </div>
              </div>
            </v-window-item>

            <!-- Side by side view -->
            <v-window-item value="side-by-side">
              <div class="data-comparison-modal__side-by-side">
                <v-row>
                  <v-col cols="12" md="6">
                    <div class="data-comparison-modal__data-panel">
                      <div class="data-comparison-modal__panel-header data-comparison-modal__panel-header--instance">
                        <v-icon class="mr-2" size="18" color="white">mdi-upload</v-icon>
                        <span>{{ $t('dataComparison.uploadedData') }}</span>
                        <v-chip size="x-small" variant="tonal" class="ml-auto data-comparison-modal__panel-chip">
                          {{ displayInstanceData.length }}
                        </v-chip>
                      </div>
                      <div class="data-comparison-modal__virtual-table">
                        <!-- Virtual table header -->
                        <div class="data-comparison-modal__vtable-header">
                          <div
                            v-if="allowRowDelete"
                            class="data-comparison-modal__vtable-header-cell data-comparison-modal__vtable-header-cell--action"
                          ></div>
                          <div
                            v-for="header in tableHeaders"
                            :key="header.key"
                            class="data-comparison-modal__vtable-header-cell"
                          >
                            {{ header.title }}
                          </div>
                        </div>
                        <!-- Virtual scroll body -->
                        <v-virtual-scroll
                          :items="displayInstanceData"
                          :height="virtualTableHeight"
                          item-height="40"
                          class="data-comparison-modal__vtable-body"
                        >
                          <template #default="{ item, index }">
                            <div
                              class="data-comparison-modal__vtable-row"
                              :class="getRowClass(item, 'instance')"
                            >
                              <div
                                v-if="allowRowDelete"
                                class="data-comparison-modal__vtable-cell data-comparison-modal__vtable-cell--action"
                              >
                                <v-btn
                                  variant="text"
                                  size="x-small"
                                  density="compact"
                                  :color="item.__pendingDelete ? 'error' : 'grey'"
                                  @click.stop="deleteInstanceRow(index)"
                                >
                                  <v-icon size="15">mdi-delete</v-icon>
                                  <v-tooltip activator="parent" location="right">
                                    {{ $t('dataComparison.deleteRow') }}
                                  </v-tooltip>
                                </v-btn>
                              </div>
                              <div
                                v-for="header in tableHeaders"
                                :key="header.key"
                                class="data-comparison-modal__vtable-cell"
                              >
                                {{ formatValue(getCellValue(item, header.key)) }}
                              </div>
                            </div>
                          </template>
                        </v-virtual-scroll>
                      </div>
                    </div>
                  </v-col>
                  <v-col cols="12" md="6">
                    <div class="data-comparison-modal__data-panel">
                      <div class="data-comparison-modal__panel-header data-comparison-modal__panel-header--master">
                        <v-icon class="mr-2" size="18" color="white">mdi-database</v-icon>
                        <span>{{ $t('dataComparison.masterData') }}</span>
                        <v-chip size="x-small" variant="tonal" class="ml-auto data-comparison-modal__panel-chip">
                          {{ displayMasterData.length }}
                        </v-chip>
                      </div>
                      <div class="data-comparison-modal__virtual-table">
                        <!-- Virtual table header -->
                        <div class="data-comparison-modal__vtable-header">
                          <div
                            v-if="allowRowRestore"
                            class="data-comparison-modal__vtable-header-cell data-comparison-modal__vtable-header-cell--restore"
                          ></div>
                          <div
                            v-for="header in tableHeaders"
                            :key="header.key"
                            class="data-comparison-modal__vtable-header-cell"
                          >
                            {{ header.title }}
                          </div>
                        </div>
                        <!-- Virtual scroll body -->
                        <v-virtual-scroll
                          :items="displayMasterData"
                          :height="virtualTableHeight"
                          item-height="40"
                          class="data-comparison-modal__vtable-body"
                        >
                          <template #default="{ item, index }">
                            <div
                              class="data-comparison-modal__vtable-row"
                              :class="getRowClass(item, 'master')"
                            >
                              <div
                                v-if="allowRowRestore"
                                class="data-comparison-modal__vtable-cell data-comparison-modal__vtable-cell--restore"
                              >
                                <v-btn
                                  v-if="getRowClass(item, 'master') !== '' && !restoredMasterIndices.has(index)"
                                  variant="text"
                                  size="x-small"
                                  density="compact"
                                  color="primary"
                                  @click.stop="restoreMasterRow(index)"
                                >
                                  <v-icon size="16">mdi-arrow-left</v-icon>
                                  <v-tooltip activator="parent" location="right">
                                    {{ $t('dataComparison.restoreRow') }}
                                  </v-tooltip>
                                </v-btn>
                              </div>
                              <div
                                v-for="header in tableHeaders"
                                :key="header.key"
                                class="data-comparison-modal__vtable-cell"
                              >
                                {{ formatValue(getCellValue(item, header.key)) }}
                              </div>
                            </div>
                          </template>
                        </v-virtual-scroll>
                      </div>
                    </div>
                  </v-col>
                </v-row>
              </div>
            </v-window-item>

            <!-- Changes view -->
            <v-window-item value="changes">
              <div class="data-comparison-modal__changes">
                <!-- Filter buttons -->
                <div class="data-comparison-modal__filters mb-4">
                  <v-btn-toggle
                    v-model="changeFilter"
                    mandatory
                    class="data-comparison-modal__filter-toggle"
                    density="comfortable"
                  >
                    <v-btn value="all" size="small" class="data-comparison-modal__filter-btn">
                      {{ $t('dataComparison.filter.all') }}
                      <v-chip size="x-small" class="ml-1">{{ totalChanges }}</v-chip>
                    </v-btn>
                    <v-btn value="added" size="small" class="data-comparison-modal__filter-btn">
                      <v-icon size="16" class="mr-1">mdi-plus</v-icon>
                      {{ $t('dataComparison.filter.added') }}
                      <v-chip size="x-small" class="ml-1">{{ diffSummary.onlyInInstance }}</v-chip>
                    </v-btn>
                    <v-btn value="removed" size="small" class="data-comparison-modal__filter-btn">
                      <v-icon size="16" class="mr-1">mdi-minus</v-icon>
                      {{ $t('dataComparison.filter.removed') }}
                      <v-chip size="x-small" class="ml-1">{{ diffSummary.onlyInMaster }}</v-chip>
                    </v-btn>
                    <v-btn value="modified" size="small" class="data-comparison-modal__filter-btn">
                      <v-icon size="16" class="mr-1">mdi-pencil</v-icon>
                      {{ $t('dataComparison.filter.modified') }}
                      <v-chip size="x-small" class="ml-1">{{ diffSummary.different }}</v-chip>
                    </v-btn>
                  </v-btn-toggle>
                </div>

                <!-- Empty state -->
                <div v-if="filteredChanges.length === 0" class="data-comparison-modal__empty">
                  <div class="data-comparison-modal__empty-icon">
                    <v-icon size="40" color="white">mdi-check-all</v-icon>
                  </div>
                  <p class="data-comparison-modal__empty-text">{{ $t('dataComparison.noChangesInFilter') }}</p>
                </div>

                <!-- Changes list (scrollable; variable row height so all fields fit) -->
                <div
                  v-else
                  class="data-comparison-modal__changes-scroll"
                >
                  <div
                    v-for="(item, changeIndex) in filteredChanges"
                    :key="changeItemKey(item, changeIndex)"
                    class="data-comparison-modal__change-item"
                    :class="'data-comparison-modal__change-item--' + item.type"
                  >
                    <div
                      class="data-comparison-modal__change-icon-wrap"
                      :class="'data-comparison-modal__change-icon-wrap--' + item.type"
                    >
                      <v-icon v-if="item.type === 'added'" size="18" color="white">
                        mdi-plus
                      </v-icon>
                      <v-icon
                        v-else-if="item.type === 'removed'"
                        size="18"
                        color="white"
                      >
                        mdi-minus
                      </v-icon>
                      <v-icon
                        v-else-if="item.type === 'modified'"
                        size="18"
                        color="white"
                      >
                        mdi-pencil
                      </v-icon>
                    </div>
                    <div class="data-comparison-modal__change-body">
                      <div class="data-comparison-modal__change-type">
                        {{ $t(`dataComparison.changeType.${item.type}`) }}
                      </div>
                      <div v-if="item.type === 'added'" class="data-comparison-modal__change-data">
                        <div class="data-comparison-modal__modified-inline-row">
                          <span
                            v-for="ent in getRowPreviewEntries(item.instanceRow)"
                            :key="ent.key"
                            class="data-comparison-modal__mod-seg data-comparison-modal__mod-seg--same"
                          >
                            <strong class="data-comparison-modal__field-name">{{ ent.key }}:</strong>
                            <span class="data-comparison-modal__mod-same-val">{{ ent.value }}</span>
                          </span>
                        </div>
                      </div>
                      <div
                        v-else-if="item.type === 'removed'"
                        class="data-comparison-modal__change-data"
                      >
                        <div class="data-comparison-modal__modified-inline-row">
                          <span
                            v-for="ent in getRowPreviewEntries(item.masterRow)"
                            :key="ent.key"
                            class="data-comparison-modal__mod-seg data-comparison-modal__mod-seg--same"
                          >
                            <strong class="data-comparison-modal__field-name">{{ ent.key }}:</strong>
                            <span class="data-comparison-modal__mod-same-val">{{ ent.value }}</span>
                          </span>
                        </div>
                      </div>
                      <div
                        v-else-if="item.type === 'modified'"
                        class="data-comparison-modal__change-data data-comparison-modal__change-data--modified"
                      >
                        <div class="data-comparison-modal__modified-inline-row">
                          <template
                            v-for="line in getModifiedRowDisplayLines(item)"
                            :key="line.field"
                          >
                            <span
                              v-if="line.changed"
                              class="data-comparison-modal__mod-seg data-comparison-modal__mod-seg--diff"
                            >
                              <strong class="data-comparison-modal__field-name">{{ line.field }}</strong>
                              <span class="data-comparison-modal__old-value">{{
                                formatValue(line.masterValue)
                              }}</span>
                              <v-icon size="12" class="data-comparison-modal__arrow-icon">
                                mdi-arrow-right
                              </v-icon>
                              <span class="data-comparison-modal__new-value">{{
                                formatValue(line.instanceValue)
                              }}</span>
                            </span>
                            <span
                              v-else
                              class="data-comparison-modal__mod-seg data-comparison-modal__mod-seg--same"
                            >
                              <strong class="data-comparison-modal__field-name">{{ line.field }}:</strong>
                              <span class="data-comparison-modal__mod-same-val">{{
                                formatValue(line.unchangedValue)
                              }}</span>
                            </span>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </v-window-item>
          </v-window>
        </div>
      </v-card-text>

      <!-- Actions -->
      <v-card-actions class="core-modal-base__actions data-comparison-modal__actions">
        <v-spacer></v-spacer>
        <v-btn
          variant="flat"
          @click="close"
          class="data-comparison-modal__close-btn"
        >
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  getMasterCompareRowContext,
  type DiffSummary,
  type RowDiff,
} from '@cornflow-ui/core/composables/project-execution/useMasterTableMatch'
import {
  getExcludedKeysForMasterTableCompare,
  buildRowMatchKey,
  resolveComparableLowercasedKeys,
} from '@cornflow-ui/core/utils/schemaUtils'
import { normalizeValue, areRowsDifferent } from '@cornflow-ui/core/utils/rowComparison'
import { buildOrderedFieldKeys } from '@cornflow-ui/core/utils/compareFieldOrder'

interface Props {
  modelValue: boolean
  tableName: string
  masterTableTitle: string
  instanceData: any[]
  masterData: any[]
  diffSummary: DiffSummary
  /** Master table config (for excluding columns_to_join / display join fields from compare UI). */
  masterTableConfig?: any
  /** Full instance payload (all tables) for dictionary-based display normalization. */
  fullInstanceData?: Record<string, any>
  /**
   * Columns declared for this table in the instance JSON schema. When provided,
   * the comparison and the column headers restrict themselves to these columns
   * (case-insensitive), so columns present only on the uploaded data or only on
   * the master payload are ignored.
   */
  instanceSchemaColumns?: string[]
  /** When true, shows per-row restore buttons on master panel rows (git-diff style). */
  allowRowRestore?: boolean
  /** When true, shows per-row delete buttons on instance panel rows. */
  allowRowDelete?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  masterTableConfig: undefined,
  fullInstanceData: undefined,
  instanceSchemaColumns: undefined,
  allowRowRestore: false,
  allowRowDelete: false,
})

const compareExcludedKeys = computed(() =>
  getExcludedKeysForMasterTableCompare(props.masterTableConfig),
)

/** Match keys + normalized row views (aligned with useMasterTableMatch). */
const compareRowContext = computed(() =>
  getMasterCompareRowContext(
    props.instanceData,
    props.masterData,
    props.tableName,
    props.fullInstanceData,
  ),
)

const matchKeyFields = computed(() => compareRowContext.value.keyFields)

/** Rows for display (normalized when app config defines dictionaries). Preserves __pending* markers. */
const displayInstanceData = computed(() => {
  const { normInstByKey, keyFields } = compareRowContext.value
  return props.instanceData.map((row) => {
    const normalized = normInstByKey.get(buildRowMatchKey(row, keyFields)) ?? row
    // Carry __pending* markers through normalization so row styling still works
    const markers: Record<string, any> = {}
    for (const k of Object.keys(row)) {
      if (k.startsWith('__')) markers[k] = row[k]
    }
    return Object.keys(markers).length > 0 ? { ...normalized, ...markers } : normalized
  })
})

const displayMasterData = computed(() => {
  const { normMasterByKey, keyFields } = compareRowContext.value
  return props.masterData.map(
    (row) => normMasterByKey.get(buildRowMatchKey(row, keyFields)) ?? row,
  )
})

const getStableRowKey = (row: any): string =>
  buildRowMatchKey(row, matchKeyFields.value)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'restore-master-row', originalRow: any): void
  (e: 'delete-instance-row', originalRow: any): void
}>()

const viewMode = ref('summary')
const changeFilter = ref('all')
const isFullscreen = ref(false)
const isLoading = ref(true)
const restoredMasterIndices = ref(new Set<number>())

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

// Dynamic height for virtual tables based on fullscreen mode
const virtualTableHeight = computed(() => {
  return isFullscreen.value ? 500 : 350
})

// Simulate a short loading delay to let the modal render smoothly
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      isLoading.value = true
      restoredMasterIndices.value = new Set()
      setTimeout(() => {
        isLoading.value = false
      }, 300)
    }
  },
  { immediate: true },
)

/**
 * Look up a row value by header key with case-insensitive fallback, so columns
 * whose case differs between uploaded and master data still render in the same
 * column without producing empty cells.
 */
const getCellValue = (row: any, headerKey: string): any => {
  if (!row || typeof row !== 'object') return undefined
  if (headerKey in row) return row[headerKey]
  const target = headerKey.toLowerCase()
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === target) return row[k]
  }
  return undefined
}

// Generate table headers — restricted to the instance JSON schema columns when
// provided (case-insensitive), so extra columns on either side are ignored.
const tableHeaders = computed(() => {
  const allData = [...displayInstanceData.value, ...displayMasterData.value]
  if (allData.length === 0) return []

  const excluded = compareExcludedKeys.value
  const excludedLower = new Set(
    Array.from(excluded).map((k) => k.toLowerCase()),
  )

  // Pick a canonical original-case label for each lowercased column.
  // When the schema declares columns, prefer that casing; otherwise use the
  // first occurrence seen in the data.
  const labelByLower = new Map<string, string>()
  if (props.instanceSchemaColumns && props.instanceSchemaColumns.length > 0) {
    for (const k of props.instanceSchemaColumns) {
      labelByLower.set(k.toLowerCase(), k)
    }
  }

  const seenLower = new Set<string>()
  const headers: { title: string; key: string; sortable: boolean }[] = []
  const allowedLower = props.instanceSchemaColumns
    ? new Set(props.instanceSchemaColumns.map((k) => k.toLowerCase()))
    : null

  allData.forEach((item) => {
    Object.keys(item).forEach((key) => {
      const lower = key.toLowerCase()
      if (
        lower === 'id' ||
        lower === '_id' ||
        key.startsWith('__') ||
        excludedLower.has(lower)
      ) {
        return
      }
      if (allowedLower && !allowedLower.has(lower)) return
      if (seenLower.has(lower)) return
      seenLower.add(lower)
      const title = labelByLower.get(lower) ?? key
      headers.push({ title, key: title, sortable: true })
    })
  })

  // Include schema columns even when no row exposes them yet, so the column
  // header is still visible to the user as part of the compared structure.
  if (allowedLower) {
    for (const col of props.instanceSchemaColumns!) {
      const lower = col.toLowerCase()
      if (excludedLower.has(lower) || seenLower.has(lower)) continue
      seenLower.add(lower)
      headers.push({ title: col, key: col, sortable: true })
    }
  }

  return headers
})

// Calculate detailed differences
const detailedDiffs = computed((): RowDiff[] => {
  const excluded = compareExcludedKeys.value
  const diffs: RowDiff[] = []
  const { keyFields, normInstByKey, normMasterByKey } = compareRowContext.value

  const instanceMap = new Map<string, any>()
  const masterMap = new Map<string, any>()

  props.instanceData.forEach((row) => {
    const key = buildRowMatchKey(row, keyFields)
    instanceMap.set(key, row)
  })

  props.masterData.forEach((row) => {
    const key = buildRowMatchKey(row, keyFields)
    masterMap.set(key, row)
  })

  instanceMap.forEach((instanceRow, key) => {
    const masterRow = masterMap.get(key)
    const instanceCompare = normInstByKey.get(key) ?? instanceRow
    const masterCompare = masterRow
      ? normMasterByKey.get(key) ?? masterRow
      : undefined
    if (!masterCompare) {
      diffs.push({ type: 'added', instanceRow: instanceCompare })
    } else if (
      areRowsDifferent(instanceCompare, masterCompare, props.instanceSchemaColumns, excluded)
    ) {
      diffs.push({
        type: 'modified',
        instanceRow: instanceCompare,
        masterRow: masterCompare,
        changes: getRowChanges(instanceCompare, masterCompare, excluded),
      })
    }
  })

  masterMap.forEach((masterRow, key) => {
    if (!instanceMap.has(key)) {
      diffs.push({
        type: 'removed',
        masterRow: normMasterByKey.get(key) ?? masterRow,
      })
    }
  })

  return diffs
})

const filteredChanges = computed(() => {
  if (changeFilter.value === 'all') {
    return detailedDiffs.value
  }
  return detailedDiffs.value.filter((d) => d.type === changeFilter.value)
})

const totalChanges = computed(() => {
  return (
    props.diffSummary.onlyInInstance +
    props.diffSummary.onlyInMaster +
    props.diffSummary.different
  )
})

/** Populate a lowercased value map and register the first original-case label seen. */
const collectRowEntries = (
  row: any,
  valuesByLower: Map<string, any>,
  labelFor: Map<string, string>,
): void => {
  if (!row || typeof row !== 'object') return
  for (const k of Object.keys(row)) {
    const lower = k.toLowerCase()
    valuesByLower.set(lower, row[k])
    if (!labelFor.has(lower)) labelFor.set(lower, k)
  }
}

/** Register original-case labels for schema columns not already labelled. */
const registerSchemaLabels = (labelFor: Map<string, string>): void => {
  if (!props.instanceSchemaColumns) return
  for (const k of props.instanceSchemaColumns) {
    const lower = k.toLowerCase()
    if (!labelFor.has(lower)) labelFor.set(lower, k)
  }
}

const getRowChanges = (
  instanceRow: any,
  masterRow: any,
  excludedKeys: Set<string> = new Set(),
): { field: string; instanceValue: any; masterValue: any }[] => {
  const changes: { field: string; instanceValue: any; masterValue: any }[] = []

  const labelFor = new Map<string, string>()
  const map1 = new Map<string, any>()
  const map2 = new Map<string, any>()
  collectRowEntries(instanceRow, map1, labelFor)
  collectRowEntries(masterRow, map2, labelFor)
  registerSchemaLabels(labelFor)

  const keysLower = resolveComparableLowercasedKeys({
    row1: instanceRow,
    row2: masterRow,
    allowedColumns: props.instanceSchemaColumns,
    excludedKeys,
  })

  keysLower.forEach((lower) => {
    const instanceVal = map1.get(lower)
    const masterVal = map2.get(lower)

    const normalizedInstance = normalizeValue(instanceVal)
    const normalizedMaster = normalizeValue(masterVal)

    if (normalizedInstance === null && normalizedMaster === null) return

    if (normalizedInstance !== normalizedMaster) {
      changes.push({
        field: labelFor.get(lower) ?? lower,
        instanceValue: instanceVal,
        masterValue: masterVal,
      })
    }
  })

  return changes
}

/** One line in the "Cambios" view for a modified row: either a diff or an unchanged field (context). */
interface ModifiedRowFieldLine {
  field: string
  changed: boolean
  masterValue?: any
  instanceValue?: any
  unchangedValue?: any
}

/**
 * Full row context for modified rows: all comparable columns, same order as side-by-side headers.
 * Unchanged fields are shown with a muted style; changed fields keep old → new.
 */
const getModifiedRowDisplayLines = (item: RowDiff): ModifiedRowFieldLine[] => {
  if (
    item.type !== 'modified' ||
    !item.instanceRow ||
    !item.masterRow ||
    !item.changes
  ) {
    return []
  }
  const { instanceRow, masterRow, changes } = item
  const changeMap = new Map(changes.map((c) => [c.field, c]))
  const excluded = compareExcludedKeys.value
  const headerKeys = tableHeaders.value.map((h) => h.key)
  const ordered = buildOrderedFieldKeys(
    instanceRow,
    masterRow,
    excluded,
    headerKeys,
    matchKeyFields.value,
    props.instanceSchemaColumns,
  )

  // `field` is the canonical-case label; `getRowChanges` keyed by the same
  // label, but rows might still hold the original different casing.
  const changeMapLower = new Map<string, (typeof changes)[number]>()
  changeMap.forEach((value, key) => changeMapLower.set(key.toLowerCase(), value))

  const lines: ModifiedRowFieldLine[] = []
  for (const field of ordered) {
    const lower = field.toLowerCase()
    const ch = changeMapLower.get(lower)
    if (ch) {
      lines.push({
        field,
        changed: true,
        masterValue: ch.masterValue,
        instanceValue: ch.instanceValue,
      })
    } else {
      lines.push({
        field,
        changed: false,
        unchangedValue:
          getCellValue(instanceRow, field) ?? getCellValue(masterRow, field),
      })
    }
  }
  return lines
}

/** All comparable fields for added/removed rows (no truncation). */
const getRowPreviewEntries = (row: any): { key: string; value: string }[] => {
  if (!row) return []
  const excluded = compareExcludedKeys.value
  const excludedLower = new Set(
    Array.from(excluded).map((k) => k.toLowerCase()),
  )
  const allowedLower =
    props.instanceSchemaColumns && props.instanceSchemaColumns.length > 0
      ? new Set(props.instanceSchemaColumns.map((k) => k.toLowerCase()))
      : null

  const keys = Object.keys(row).filter((k) => {
    const lower = k.toLowerCase()
    if (lower === 'id' || lower === '_id') return false
    if (excludedLower.has(lower)) return false
    if (allowedLower && !allowedLower.has(lower)) return false
    return true
  })
  return keys.map((k) => ({ key: k, value: formatValue(row[k]) }))
}

const changeItemKey = (item: RowDiff, index: number): string => {
  if (item.type === 'modified' && item.instanceRow) {
    return `m-${getStableRowKey(item.instanceRow)}`
  }
  if (item.type === 'added' && item.instanceRow) {
    return `a-${getStableRowKey(item.instanceRow)}`
  }
  if (item.type === 'removed' && item.masterRow) {
    return `r-${getStableRowKey(item.masterRow)}`
  }
  return `x-${index}`
}

const getRowClass = (item: any, source: 'instance' | 'master'): string => {
  const excluded = compareExcludedKeys.value
  const key = getStableRowKey(item)

  if (source === 'instance') {
    // Pending-state rows get their own class regardless of master comparison
    if (item.__pendingDelete) return 'row-pending-delete'
    if (item.__pendingCreate) return 'row-pending-create'

    const masterMap = new Map<string, any>()
    displayMasterData.value.forEach((row) => {
      masterMap.set(getStableRowKey(row), row)
    })

    if (!masterMap.has(key)) return 'row-added'
    const masterRow = masterMap.get(key)
    if (areRowsDifferent(item, masterRow, props.instanceSchemaColumns, excluded))
      return 'row-modified'
  } else {
    const instanceMap = new Map<string, any>()
    // Exclude pending-delete rows from match so master shows them as "removed"
    displayInstanceData.value
      .filter((row) => !row.__pendingDelete)
      .forEach((row) => {
        instanceMap.set(getStableRowKey(row), row)
      })

    if (!instanceMap.has(key)) return 'row-removed'
    const instanceRow = instanceMap.get(key)
    if (areRowsDifferent(instanceRow, item, props.instanceSchemaColumns, excluded))
      return 'row-modified'
  }

  return ''
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const close = () => {
  emit('update:modelValue', false)
}

const restoreMasterRow = (index: number) => {
  const originalRow = props.masterData[index]
  if (originalRow !== undefined) {
    restoredMasterIndices.value = new Set([...restoredMasterIndices.value, index])
    emit('restore-master-row', originalRow)
  }
}

const deleteInstanceRow = (index: number) => {
  const originalRow = props.instanceData[index]
  if (originalRow !== undefined) {
    emit('delete-instance-row', originalRow)
  }
}
</script>

<style>
@import '@cornflow-ui/core/assets/styles/components/core/CoreModalBase.css';
</style>

<style scoped>
/* ── Modal card ── */
.data-comparison-modal {
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  max-height: 90vh;
}

.data-comparison-modal.fullscreen-modal {
  max-height: 100vh;
  height: 100vh;
  border-radius: 0;
}

/* ── Header ── */
.data-comparison-modal__header {
  background: var(--background, #f6f6f6);
}

.data-comparison-modal__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--primary, #326786);
  margin-right: 12px;
  flex-shrink: 0;
}

.data-comparison-modal__header-text {
  display: flex;
  flex-direction: column;
}

.data-comparison-modal__subtitle {
  font-size: 12px;
  color: var(--subtitle, #6e6e6e);
  font-weight: 400;
  margin-top: 2px;
}

/* ── Content area ── */
.data-comparison-modal__content {
  min-height: 400px;
  padding: 20px;
}

.fullscreen-modal .data-comparison-modal__content {
  flex: 1;
  overflow: auto;
}

/* ── Loading ── */
.data-comparison-modal__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.data-comparison-modal__spinner {
  color: var(--primary, #326786) !important;
}

.data-comparison-modal__loading-text {
  color: var(--subtitle, #6e6e6e);
  font-size: 14px;
  margin-top: 16px;
}

/* ── Tabs ── */
.data-comparison-modal__tabs {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.data-comparison-modal__tab {
  text-transform: none !important;
  letter-spacing: 0 !important;
  font-weight: 500;
  font-size: 13px;
}

/* ── Summary view ── */
.data-comparison-modal__summary {
  padding-top: 4px;
}

/* Source cards (uploaded / master) */
.data-comparison-modal__source-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: white;
  transition: box-shadow 0.2s ease;
}

.data-comparison-modal__source-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.data-comparison-modal__source-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex-shrink: 0;
}

.data-comparison-modal__source-icon--instance {
  background-color: var(--primary, #326786);
}

.data-comparison-modal__source-icon--master {
  background-color: var(--accent, #4e7f9c);
}

.data-comparison-modal__source-info {
  display: flex;
  flex-direction: column;
}

.data-comparison-modal__source-label {
  font-size: 13px;
  color: var(--subtitle, #6e6e6e);
  font-weight: 500;
}

.data-comparison-modal__source-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--title, #404040);
  line-height: 1.2;
}

.data-comparison-modal__source-unit {
  font-size: 14px;
  font-weight: 400;
  color: var(--subtitle, #6e6e6e);
  margin-left: 4px;
}

/* Diff stats grid */
.data-comparison-modal__stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 20px;
}

.data-comparison-modal__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 12px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.data-comparison-modal__stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.data-comparison-modal__stat-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin-bottom: 10px;
}

.data-comparison-modal__stat--added {
  background-color: color-mix(in srgb, var(--success, #3ba780) 6%, white);
}

.data-comparison-modal__stat--added .data-comparison-modal__stat-icon-wrap {
  background-color: color-mix(in srgb, var(--success, #3ba780) 15%, white);
  color: var(--success, #3ba780);
}

.data-comparison-modal__stat--added .data-comparison-modal__stat-value {
  color: var(--success, #3ba780);
}

.data-comparison-modal__stat--removed {
  background-color: color-mix(in srgb, var(--danger, #f44336) 6%, white);
}

.data-comparison-modal__stat--removed .data-comparison-modal__stat-icon-wrap {
  background-color: color-mix(in srgb, var(--danger, #f44336) 15%, white);
  color: var(--danger, #f44336);
}

.data-comparison-modal__stat--removed .data-comparison-modal__stat-value {
  color: var(--danger, #f44336);
}

.data-comparison-modal__stat--modified {
  background-color: color-mix(in srgb, var(--warning, #ffb458) 6%, white);
}

.data-comparison-modal__stat--modified .data-comparison-modal__stat-icon-wrap {
  background-color: color-mix(in srgb, var(--warning, #ffb458) 15%, white);
  color: var(--warning, #ffb458);
}

.data-comparison-modal__stat--modified .data-comparison-modal__stat-value {
  color: var(--warning, #ffb458);
}

.data-comparison-modal__stat--identical {
  background-color: var(--background, #f6f6f6);
}

.data-comparison-modal__stat--identical .data-comparison-modal__stat-icon-wrap {
  background-color: var(--disabled, #f2f4f7);
  color: var(--subtitle, #6e6e6e);
}

.data-comparison-modal__stat--identical .data-comparison-modal__stat-value {
  color: var(--subtitle, #6e6e6e);
}

.data-comparison-modal__stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.data-comparison-modal__stat-label {
  font-size: 0.72rem;
  color: var(--subtitle, #6e6e6e);
  margin-top: 4px;
  font-weight: 500;
}

/* ── Side by side view ── */
.data-comparison-modal__data-panel {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  overflow: hidden;
}

.data-comparison-modal__panel-header {
  padding: 10px 16px;
  font-weight: 600;
  font-size: 13px;
  display: flex;
  align-items: center;
  color: white;
}

.data-comparison-modal__panel-header--instance {
  background-color: var(--primary, #326786);
}

.data-comparison-modal__panel-header--master {
  background-color: var(--accent, #4e7f9c);
}

.data-comparison-modal__panel-chip {
  background-color: rgba(0, 0, 0, 0.22) !important;
  color: white !important;
  font-weight: 600;
}

.fullscreen-modal .data-comparison-modal__virtual-table {
  flex: 1;
}

/* Virtual table styles */
.data-comparison-modal__virtual-table {
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.data-comparison-modal__vtable-header {
  display: flex;
  background-color: var(--background, #f6f6f6);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-weight: 600;
  font-size: 0.7rem;
  color: var(--subtitle, #6e6e6e);
  min-width: fit-content;
}

.data-comparison-modal__vtable-header-cell {
  flex: 0 0 auto;
  width: 120px;
  min-width: 120px;
  padding: 9px 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.data-comparison-modal__vtable-body {
  background-color: white;
  min-width: fit-content;
}

.data-comparison-modal__vtable-row {
  display: flex;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  transition: background-color 0.15s ease;
  min-width: fit-content;
}

.data-comparison-modal__vtable-row:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.data-comparison-modal__vtable-cell {
  flex: 0 0 auto;
  width: 120px;
  min-width: 120px;
  padding: 8px 12px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--title, #404040);
}

.data-comparison-modal__vtable-cell--restore,
.data-comparison-modal__vtable-header-cell--restore,
.data-comparison-modal__vtable-cell--action,
.data-comparison-modal__vtable-header-cell--action {
  flex: 0 0 auto;
  width: 36px;
  min-width: 36px;
  padding: 4px 4px;
  justify-content: center;
  position: sticky;
  left: 0;
  background: inherit;
  z-index: 1;
}

.data-comparison-modal__vtable-row.row-pending-delete {
  background-color: color-mix(in srgb, var(--danger, #f44336) 8%, transparent) !important;
  opacity: 0.65;
}

.data-comparison-modal__vtable-row.row-pending-delete .data-comparison-modal__vtable-cell {
  text-decoration: line-through;
  color: var(--danger, #f44336);
}

.data-comparison-modal__vtable-row.row-pending-create {
  background-color: color-mix(in srgb, var(--primary, #326786) 8%, transparent) !important;
  border-left: 3px dashed var(--primary, #326786);
}

/* Row status colors */
.data-comparison-modal__vtable-row.row-added {
  background-color: color-mix(in srgb, var(--success, #3ba780) 10%, transparent) !important;
}

.data-comparison-modal__vtable-row.row-removed {
  background-color: color-mix(in srgb, var(--danger, #f44336) 10%, transparent) !important;
}

.data-comparison-modal__vtable-row.row-modified {
  background-color: color-mix(in srgb, var(--warning, #ffb458) 10%, transparent) !important;
}

/* ── Changes view ── */
.data-comparison-modal__filters {
  display: flex;
  justify-content: center;
}

.data-comparison-modal__filter-toggle {
  border-radius: 10px !important;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.data-comparison-modal__filter-btn {
  text-transform: none !important;
  letter-spacing: 0 !important;
  font-weight: 500;
  font-size: 13px;
}

/* Empty state */
.data-comparison-modal__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
}

.data-comparison-modal__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--disabled, #f2f4f7);
  margin-bottom: 16px;
}

.data-comparison-modal__empty-icon .v-icon {
  color: var(--subtitle, #6e6e6e) !important;
}

.data-comparison-modal__empty-text {
  color: var(--subtitle, #6e6e6e);
  font-size: 14px;
  margin: 0;
}

/* Change items */
.data-comparison-modal__change-item {
  display: flex;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  align-items: flex-start;
  gap: 12px;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: box-shadow 0.15s ease;
}

.data-comparison-modal__change-item:hover {
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
}

.data-comparison-modal__change-item--added {
  background-color: color-mix(in srgb, var(--success, #3ba780) 6%, white);
  border-left: 3px solid var(--success, #3ba780);
}

.data-comparison-modal__change-item--removed {
  background-color: color-mix(in srgb, var(--danger, #f44336) 6%, white);
  border-left: 3px solid var(--danger, #f44336);
}

.data-comparison-modal__change-item--modified {
  background-color: color-mix(in srgb, var(--warning, #ffb458) 6%, white);
  border-left: 3px solid var(--warning, #ffb458);
  padding: 8px 12px;
}

.data-comparison-modal__change-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}

.data-comparison-modal__change-icon-wrap--added {
  background-color: var(--success, #3ba780);
}

.data-comparison-modal__change-icon-wrap--removed {
  background-color: var(--danger, #f44336);
}

.data-comparison-modal__change-icon-wrap--modified {
  background-color: var(--warning, #ffb458);
}

.data-comparison-modal__change-body {
  flex: 1;
  min-width: 0;
}

.data-comparison-modal__change-type {
  font-weight: 600;
  font-size: 13px;
  color: var(--title, #404040);
  margin-bottom: 4px;
}

.data-comparison-modal__change-data {
  font-size: 0.75rem;
  color: var(--subtitle, #6e6e6e);
}

.data-comparison-modal__change-data code {
  background-color: rgba(0, 0, 0, 0.04);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
}

.data-comparison-modal__field-name {
  color: var(--title, #404040);
  font-weight: 600;
}

/** One wrapping row: all field segments inline (unchanged + diffs). */
.data-comparison-modal__modified-inline-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 14px;
  font-size: 0.7rem;
  line-height: 1.35;
}

.data-comparison-modal__mod-seg {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 5px;
  max-width: 100%;
}

.data-comparison-modal__mod-seg--same {
  color: var(--subtitle, #6e6e6e);
}

.data-comparison-modal__mod-seg--same .data-comparison-modal__field-name {
  margin-right: 2px;
}

.data-comparison-modal__mod-same-val {
  word-break: break-word;
  min-width: 0;
}

.data-comparison-modal__mod-seg--diff .data-comparison-modal__field-name::after {
  content: ':';
  font-weight: 600;
  color: var(--title, #404040);
}

.data-comparison-modal__field-change {
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.data-comparison-modal__old-value {
  color: var(--danger, #f44336);
  text-decoration: line-through;
  opacity: 0.8;
}

.data-comparison-modal__arrow-icon {
  color: var(--subtitle, #6e6e6e);
}

.data-comparison-modal__new-value {
  color: var(--success, #3ba780);
  font-weight: 600;
}

.data-comparison-modal__changes-scroll {
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
}

/* ── Footer actions ── */
.data-comparison-modal__actions {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.data-comparison-modal__close-btn {
  background-color: var(--primary, #326786) !important;
  color: white !important;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  border-radius: 8px;
  min-width: 100px;
}

.data-comparison-modal__close-btn:hover {
  box-shadow: 0 2px 8px rgba(50, 103, 134, 0.3);
}

/* ── Responsive ── */
@media (max-width: 960px) {
  .data-comparison-modal__stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .data-comparison-modal__content {
    padding: 16px;
  }

  .data-comparison-modal__stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .data-comparison-modal__stat {
    padding: 14px 8px;
  }

  .data-comparison-modal__filter-toggle {
    flex-wrap: wrap;
  }
}
</style>
