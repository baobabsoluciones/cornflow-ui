<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :max-width="isFullscreen ? undefined : 1200"
    :fullscreen="isFullscreen"
    scrollable
  >
    <v-card
      class="data-comparison-modal"
      :class="{ 'fullscreen-modal': isFullscreen }"
    >
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon class="mr-2" color="primary">mdi-compare</v-icon>
          {{ $t('dataComparison.title', { tableName }) }}
        </div>
        <div class="d-flex align-center">
          <v-btn
            :icon="isFullscreen ? 'mdi-window-restore' : 'mdi-window-maximize'"
            variant="text"
            size="small"
            @click="toggleFullscreen"
            class="mr-1"
            :title="
              isFullscreen
                ? $t('projectExecution.minimize')
                : $t('projectExecution.maximize')
            "
          />
          <v-btn variant="text" size="small" @click="close">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
      </v-card-title>

      <v-card-subtitle>
        {{ $t('dataComparison.subtitle', { masterTable: masterTableTitle }) }}
      </v-card-subtitle>

      <v-divider></v-divider>

      <v-card-text class="modal-content">
        <!-- Loading overlay -->
        <div v-if="isLoading" class="loading-container">
          <v-progress-circular
            indeterminate
            color="primary"
            size="48"
          ></v-progress-circular>
          <p class="mt-3 text-subtitle-2">{{ $t('dataComparison.loading') }}</p>
        </div>

        <!-- Content (hidden while loading) -->
        <div v-else>
          <!-- View mode tabs -->
          <v-tabs v-model="viewMode" class="mb-4">
            <v-tab value="summary">
              <v-icon left>mdi-chart-bar</v-icon>
              {{ $t('dataComparison.tabs.summary') }}
            </v-tab>
            <v-tab value="side-by-side">
              <v-icon left>mdi-view-split-vertical</v-icon>
              {{ $t('dataComparison.tabs.sideBySide') }}
            </v-tab>
            <v-tab value="changes">
              <v-icon left>mdi-delta</v-icon>
              {{ $t('dataComparison.tabs.changes') }}
            </v-tab>
          </v-tabs>

          <v-window v-model="viewMode">
            <!-- Summary view -->
            <v-window-item value="summary">
              <div class="summary-view">
                <v-row>
                  <v-col cols="12" md="6">
                    <v-card variant="outlined" class="summary-card">
                      <v-card-title class="text-subtitle-1">
                        <v-icon class="mr-2" color="primary">mdi-upload</v-icon>
                        {{ $t('dataComparison.uploadedData') }}
                      </v-card-title>
                      <v-card-text>
                        <div class="stat-value">
                          {{ diffSummary.totalInstance }}
                        </div>
                        <div class="stat-label">
                          {{ $t('dataComparison.rows') }}
                        </div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-card variant="outlined" class="summary-card">
                      <v-card-title class="text-subtitle-1">
                        <v-icon class="mr-2" color="secondary"
                          >mdi-database</v-icon
                        >
                        {{ $t('dataComparison.masterData') }}
                      </v-card-title>
                      <v-card-text>
                        <div class="stat-value">
                          {{ diffSummary.totalMaster }}
                        </div>
                        <div class="stat-label">
                          {{ $t('dataComparison.rows') }}
                        </div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>

                <v-row class="mt-4">
                  <v-col cols="6" md="3">
                    <div class="diff-stat">
                      <v-icon color="success" size="large"
                        >mdi-plus-circle</v-icon
                      >
                      <div class="diff-stat-value text-success">
                        {{ diffSummary.onlyInInstance }}
                      </div>
                      <div class="diff-stat-label">
                        {{ $t('dataComparison.newRows') }}
                      </div>
                    </div>
                  </v-col>
                  <v-col cols="6" md="3">
                    <div class="diff-stat">
                      <v-icon color="error" size="large"
                        >mdi-minus-circle</v-icon
                      >
                      <div class="diff-stat-value text-error">
                        {{ diffSummary.onlyInMaster }}
                      </div>
                      <div class="diff-stat-label">
                        {{ $t('dataComparison.removedRows') }}
                      </div>
                    </div>
                  </v-col>
                  <v-col cols="6" md="3">
                    <div class="diff-stat">
                      <v-icon color="warning" size="large"
                        >mdi-pencil-circle</v-icon
                      >
                      <div class="diff-stat-value text-warning">
                        {{ diffSummary.different }}
                      </div>
                      <div class="diff-stat-label">
                        {{ $t('dataComparison.modifiedRows') }}
                      </div>
                    </div>
                  </v-col>
                  <v-col cols="6" md="3">
                    <div class="diff-stat">
                      <v-icon color="grey" size="large"
                        >mdi-check-circle</v-icon
                      >
                      <div class="diff-stat-value">
                        {{ diffSummary.identical }}
                      </div>
                      <div class="diff-stat-label">
                        {{ $t('dataComparison.identicalRows') }}
                      </div>
                    </div>
                  </v-col>
                </v-row>
              </div>
            </v-window-item>

            <!-- Side by side view -->
            <v-window-item value="side-by-side">
              <div class="side-by-side-view">
                <v-row>
                  <v-col cols="12" md="6">
                    <div class="data-panel">
                      <div class="panel-header">
                        <v-icon class="mr-2" color="primary">mdi-upload</v-icon>
                        {{ $t('dataComparison.uploadedData') }}
                        <v-chip size="x-small" class="ml-2">
                          {{ instanceData.length }}
                        </v-chip>
                      </div>
                      <div class="panel-content virtual-table-container">
                        <!-- Virtual table header -->
                        <div class="virtual-table-header">
                          <div
                            v-for="header in tableHeaders"
                            :key="header.key"
                            class="virtual-table-header-cell"
                          >
                            {{ header.title }}
                          </div>
                        </div>
                        <!-- Virtual scroll body -->
                        <v-virtual-scroll
                          :items="instanceData"
                          :height="virtualTableHeight"
                          item-height="40"
                          class="virtual-table-body"
                        >
                          <template #default="{ item }">
                            <div
                              class="virtual-table-row"
                              :class="getRowClass(item, 'instance')"
                            >
                              <div
                                v-for="header in tableHeaders"
                                :key="header.key"
                                class="virtual-table-cell"
                              >
                                {{ formatValue(item[header.key]) }}
                              </div>
                            </div>
                          </template>
                        </v-virtual-scroll>
                      </div>
                    </div>
                  </v-col>
                  <v-col cols="12" md="6">
                    <div class="data-panel">
                      <div class="panel-header">
                        <v-icon class="mr-2" color="secondary"
                          >mdi-database</v-icon
                        >
                        {{ $t('dataComparison.masterData') }}
                        <v-chip size="x-small" class="ml-2">
                          {{ masterData.length }}
                        </v-chip>
                      </div>
                      <div class="panel-content virtual-table-container">
                        <!-- Virtual table header -->
                        <div class="virtual-table-header">
                          <div
                            v-for="header in tableHeaders"
                            :key="header.key"
                            class="virtual-table-header-cell"
                          >
                            {{ header.title }}
                          </div>
                        </div>
                        <!-- Virtual scroll body -->
                        <v-virtual-scroll
                          :items="masterData"
                          :height="virtualTableHeight"
                          item-height="40"
                          class="virtual-table-body"
                        >
                          <template #default="{ item }">
                            <div
                              class="virtual-table-row"
                              :class="getRowClass(item, 'master')"
                            >
                              <div
                                v-for="header in tableHeaders"
                                :key="header.key"
                                class="virtual-table-cell"
                              >
                                {{ formatValue(item[header.key]) }}
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
              <div class="changes-view">
                <!-- Filter buttons -->
                <div class="change-filters mb-4">
                  <v-btn-toggle v-model="changeFilter" mandatory>
                    <v-btn value="all" size="small">
                      {{ $t('dataComparison.filter.all') }}
                      <v-chip size="x-small" class="ml-1">{{
                        totalChanges
                      }}</v-chip>
                    </v-btn>
                    <v-btn value="added" size="small" color="success">
                      <v-icon left>mdi-plus</v-icon>
                      {{ $t('dataComparison.filter.added') }}
                      <v-chip size="x-small" class="ml-1">
                        {{ diffSummary.onlyInInstance }}
                      </v-chip>
                    </v-btn>
                    <v-btn value="removed" size="small" color="error">
                      <v-icon left>mdi-minus</v-icon>
                      {{ $t('dataComparison.filter.removed') }}
                      <v-chip size="x-small" class="ml-1">
                        {{ diffSummary.onlyInMaster }}
                      </v-chip>
                    </v-btn>
                    <v-btn value="modified" size="small" color="warning">
                      <v-icon left>mdi-pencil</v-icon>
                      {{ $t('dataComparison.filter.modified') }}
                      <v-chip size="x-small" class="ml-1">
                        {{ diffSummary.different }}
                      </v-chip>
                    </v-btn>
                  </v-btn-toggle>
                </div>

                <!-- Changes list -->
                <div v-if="filteredChanges.length === 0" class="no-changes">
                  <v-icon size="48" color="grey">mdi-check-all</v-icon>
                  <p>{{ $t('dataComparison.noChangesInFilter') }}</p>
                </div>

                <v-virtual-scroll
                  v-else
                  :items="filteredChanges"
                  height="400"
                  item-height="80"
                >
                  <template #default="{ item }">
                    <div class="change-item" :class="'change-' + item.type">
                      <div class="change-icon">
                        <v-icon v-if="item.type === 'added'" color="success">
                          mdi-plus-circle
                        </v-icon>
                        <v-icon
                          v-else-if="item.type === 'removed'"
                          color="error"
                        >
                          mdi-minus-circle
                        </v-icon>
                        <v-icon
                          v-else-if="item.type === 'modified'"
                          color="warning"
                        >
                          mdi-pencil-circle
                        </v-icon>
                      </div>
                      <div class="change-content">
                        <div class="change-type">
                          {{ $t(`dataComparison.changeType.${item.type}`) }}
                        </div>
                        <div v-if="item.type === 'added'" class="change-data">
                          <code>{{ formatRowPreview(item.instanceRow) }}</code>
                        </div>
                        <div
                          v-else-if="item.type === 'removed'"
                          class="change-data"
                        >
                          <code>{{ formatRowPreview(item.masterRow) }}</code>
                        </div>
                        <div
                          v-else-if="item.type === 'modified'"
                          class="change-data"
                        >
                          <div
                            v-for="change in item.changes"
                            :key="change.field"
                            class="field-change"
                          >
                            <strong>{{ change.field }}:</strong>
                            <span class="old-value">{{
                              formatValue(change.masterValue)
                            }}</span>
                            <v-icon size="small">mdi-arrow-right</v-icon>
                            <span class="new-value">{{
                              formatValue(change.instanceValue)
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </v-virtual-scroll>
              </div>
            </v-window-item>
          </v-window>
        </div>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="tonal" @click="close">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type {
  DiffSummary,
  RowDiff,
} from '@/composables/project-execution/useMasterTableMatch'

interface Props {
  modelValue: boolean
  tableName: string
  masterTableTitle: string
  instanceData: any[]
  masterData: any[]
  diffSummary: DiffSummary
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const viewMode = ref('summary')
const changeFilter = ref('all')
const isFullscreen = ref(false)
const isLoading = ref(true)

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
      // Small delay to allow Vue to render the modal structure first
      setTimeout(() => {
        isLoading.value = false
      }, 300)
    }
  },
  { immediate: true },
)

// Generate table headers from data
const tableHeaders = computed(() => {
  const allData = [...props.instanceData, ...props.masterData]
  if (allData.length === 0) return []

  const allKeys = new Set<string>()
  allData.forEach((item) => {
    Object.keys(item).forEach((key) => {
      if (key !== 'id' && key !== '_id') {
        allKeys.add(key)
      }
    })
  })

  return Array.from(allKeys).map((key) => ({
    title: key,
    key: key,
    sortable: true,
  }))
})

// Calculate detailed differences
const detailedDiffs = computed((): RowDiff[] => {
  const diffs: RowDiff[] = []
  const primaryKey = getPrimaryKey()

  // Create maps
  const instanceMap = new Map<string, any>()
  const masterMap = new Map<string, any>()

  props.instanceData.forEach((row) => {
    const key = getRowKey(row, primaryKey)
    instanceMap.set(key, row)
  })

  props.masterData.forEach((row) => {
    const key = getRowKey(row, primaryKey)
    masterMap.set(key, row)
  })

  // Process instance rows
  instanceMap.forEach((instanceRow, key) => {
    const masterRow = masterMap.get(key)
    if (!masterRow) {
      diffs.push({ type: 'added', instanceRow })
    } else if (areRowsDifferent(instanceRow, masterRow)) {
      diffs.push({
        type: 'modified',
        instanceRow,
        masterRow,
        changes: getRowChanges(instanceRow, masterRow),
      })
    }
  })

  // Process master rows not in instance
  masterMap.forEach((masterRow, key) => {
    if (!instanceMap.has(key)) {
      diffs.push({ type: 'removed', masterRow })
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

// Helper functions
const getPrimaryKey = (): string => {
  const allData = [...props.instanceData, ...props.masterData]
  if (allData.length === 0) return 'id'

  const firstItem = allData[0]
  const keys = Object.keys(firstItem)

  // IMPORTANT: Prefer domain-specific identifier patterns BEFORE internal 'id'
  // because instance data may have generated internal IDs that don't match master data
  const idPatterns = [
    'codigo_',
    'codigo',
    'code_',
    'code',
    'key_',
    'key',
    'nombre',
    'name',
  ]
  for (const pattern of idPatterns) {
    const match = keys.find((k) =>
      k.toLowerCase().startsWith(pattern.toLowerCase()),
    )
    if (match) return match
  }

  // Only use 'id' if no domain-specific key was found AND it doesn't look like a generated ID
  // Check if the id values look like domain IDs (short, simple values) vs generated ones
  if (keys.includes('id')) {
    const sampleId = firstItem['id']
    // If ID looks like a generated internal ID (contains underscore + long string), skip it
    if (
      typeof sampleId === 'string' &&
      sampleId.includes('_') &&
      sampleId.length > 20
    ) {
      // Generated internal ID, skip
    } else {
      return 'id'
    }
  }

  // Fallback to first non-id field
  const firstNonId = keys.find((k) => k !== 'id' && k !== '_id')
  return firstNonId || keys[0] || 'id'
}

const getRowKey = (row: any, primaryKey: string): string => {
  return String(row[primaryKey] ?? JSON.stringify(row))
}

/**
 * Normalize a string value for comparison
 */
const normalizeStringValue = (value: string): any => {
  const trimmed = value.trim()
  if (trimmed === '') return null

  // Try to convert to number if it looks like one
  // Using non-capturing group to avoid ReDoS vulnerability
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const num = parseFloat(trimmed)
    if (!isNaN(num)) {
      return Number.isInteger(num) ? num : Math.round(num * 1000000) / 1000000
    }
  }

  // Try to convert to boolean
  const lowerTrimmed = trimmed.toLowerCase()
  if (lowerTrimmed === 'true') return true
  if (lowerTrimmed === 'false') return false

  return trimmed
}

/**
 * Normalize a number value for comparison
 */
const normalizeNumberValue = (value: number): number | null => {
  if (isNaN(value)) return null
  return Number.isInteger(value) ? value : Math.round(value * 1000000) / 1000000
}

/**
 * Normalize a value for comparison
 * Handles type coercion between strings and numbers, trims strings, etc.
 */
const normalizeValue = (value: any): any => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return normalizeStringValue(value)
  if (typeof value === 'number') return normalizeNumberValue(value)
  if (typeof value === 'boolean') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

const areRowsDifferent = (row1: any, row2: any): boolean => {
  const ignoredFields = ['id', '_id', 'created_at', 'updated_at']
  const allKeys = new Set([...Object.keys(row1), ...Object.keys(row2)])

  for (const key of allKeys) {
    if (ignoredFields.includes(key)) continue

    const val1 = normalizeValue(row1[key])
    const val2 = normalizeValue(row2[key])

    // Both null are equal
    if (val1 === null && val2 === null) {
      continue
    }

    // One is null, the other isn't
    if (val1 === null || val2 === null) {
      return true
    }

    // Compare normalized values
    if (val1 !== val2) {
      return true
    }
  }

  return false
}

const getRowChanges = (
  instanceRow: any,
  masterRow: any,
): { field: string; instanceValue: any; masterValue: any }[] => {
  const ignoredFields = ['id', '_id', 'created_at', 'updated_at']
  const changes: { field: string; instanceValue: any; masterValue: any }[] = []

  const allKeys = new Set([
    ...Object.keys(instanceRow),
    ...Object.keys(masterRow),
  ])

  allKeys.forEach((key) => {
    if (ignoredFields.includes(key)) return

    const instanceVal = instanceRow[key]
    const masterVal = masterRow[key]

    // Use normalized values for comparison
    const normalizedInstance = normalizeValue(instanceVal)
    const normalizedMaster = normalizeValue(masterVal)

    // Both null are equal
    if (normalizedInstance === null && normalizedMaster === null) {
      return
    }

    // Compare normalized values
    if (normalizedInstance !== normalizedMaster) {
      changes.push({
        field: key,
        instanceValue: instanceVal,
        masterValue: masterVal,
      })
    }
  })

  return changes
}

const getRowClass = (item: any, source: 'instance' | 'master'): string => {
  const primaryKey = getPrimaryKey()
  const key = getRowKey(item, primaryKey)

  if (source === 'instance') {
    // Check if row exists in master
    const masterMap = new Map<string, any>()
    props.masterData.forEach((row) => {
      masterMap.set(getRowKey(row, primaryKey), row)
    })

    if (!masterMap.has(key)) return 'row-added'
    const masterRow = masterMap.get(key)
    if (areRowsDifferent(item, masterRow)) return 'row-modified'
  } else {
    // Check if row exists in instance
    const instanceMap = new Map<string, any>()
    props.instanceData.forEach((row) => {
      instanceMap.set(getRowKey(row, primaryKey), row)
    })

    if (!instanceMap.has(key)) return 'row-removed'
    const instanceRow = instanceMap.get(key)
    if (areRowsDifferent(instanceRow, item)) return 'row-modified'
  }

  return ''
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const formatRowPreview = (row: any): string => {
  if (!row) return '-'
  const keys = Object.keys(row).filter((k) => k !== 'id' && k !== '_id')
  const preview = keys.slice(0, 3).map((k) => `${k}: ${formatValue(row[k])}`)
  return preview.join(', ') + (keys.length > 3 ? ', ...' : '')
}

const close = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.data-comparison-modal {
  max-height: 90vh;
}

.data-comparison-modal.fullscreen-modal {
  max-height: 100vh;
  height: 100vh;
}

.fullscreen-modal .modal-content {
  flex: 1;
  overflow: auto;
}

.fullscreen-modal .panel-content {
  max-height: calc(100vh - 350px);
}

.fullscreen-modal .virtual-table-container {
  flex: 1;
}

.modal-content {
  min-height: 400px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--subtitle);
}

.summary-card {
  text-align: center;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--title);
}

.stat-label {
  color: var(--subtitle);
  font-size: 0.875rem;
}

.diff-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 16px;
}

.diff-stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 8px;
}

.diff-stat-label {
  font-size: 0.75rem;
  color: var(--subtitle);
}

.data-panel {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  background-color: var(--background, #f6f6f6);
  padding: 12px 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.panel-content {
  max-height: 400px;
  overflow: auto;
}

/* Virtual table styles */
.virtual-table-container {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: auto; /* Allow horizontal scroll */
}

.virtual-table-header {
  display: flex;
  background-color: var(--background, #f6f6f6);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--title, rgba(0, 0, 0, 0.87));
  min-width: fit-content; /* Ensure header doesn't compress */
}

.virtual-table-header-cell {
  flex: 0 0 auto; /* Don't shrink, don't grow, auto width */
  width: 120px; /* Fixed width for consistency */
  min-width: 120px;
  padding: 10px 12px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.virtual-table-body {
  background-color: white;
  min-width: fit-content; /* Ensure body matches header width */
}

.virtual-table-row {
  display: flex;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  transition: background-color 0.15s;
  min-width: fit-content; /* Ensure row doesn't compress */
}

.virtual-table-row:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.virtual-table-cell {
  flex: 0 0 auto; /* Don't shrink, don't grow, auto width */
  width: 120px; /* Fixed width matching header */
  min-width: 120px;
  padding: 8px 12px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Row status colors for virtual table - using CSS variables */
.virtual-table-row.row-added {
  background-color: color-mix(
    in srgb,
    var(--success, #3ba780) 12%,
    transparent
  ) !important;
}

.virtual-table-row.row-removed {
  background-color: color-mix(
    in srgb,
    var(--danger, #f44336) 12%,
    transparent
  ) !important;
}

.virtual-table-row.row-modified {
  background-color: color-mix(
    in srgb,
    var(--warning, #ffb458) 12%,
    transparent
  ) !important;
}

.data-table {
  font-size: 0.75rem;
}

/* Row status colors - using CSS variables */
.row-added {
  background-color: color-mix(
    in srgb,
    var(--success, #3ba780) 12%,
    transparent
  ) !important;
}

.row-removed {
  background-color: color-mix(
    in srgb,
    var(--danger, #f44336) 12%,
    transparent
  ) !important;
}

.row-modified {
  background-color: color-mix(
    in srgb,
    var(--warning, #ffb458) 12%,
    transparent
  ) !important;
}

.change-filters {
  display: flex;
  justify-content: center;
}

.no-changes {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--subtitle);
}

.change-item {
  display: flex;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  align-items: flex-start;
}

/* Change item colors - using CSS variables */
.change-item.change-added {
  background-color: color-mix(in srgb, var(--success, #3ba780) 8%, transparent);
}

.change-item.change-removed {
  background-color: color-mix(in srgb, var(--danger, #f44336) 8%, transparent);
}

.change-item.change-modified {
  background-color: color-mix(in srgb, var(--warning, #ffb458) 8%, transparent);
}

.change-icon {
  margin-right: 12px;
  flex-shrink: 0;
}

.change-content {
  flex: 1;
  min-width: 0;
}

.change-type {
  font-weight: 500;
  margin-bottom: 4px;
}

.change-data {
  font-size: 0.75rem;
  color: var(--subtitle);
}

.change-data code {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
}

.field-change {
  margin-bottom: 4px;
}

.old-value {
  color: var(--danger, #f44336);
  text-decoration: line-through;
  margin-right: 4px;
}

.new-value {
  color: var(--success, #3ba780);
  margin-left: 4px;
}
</style>
