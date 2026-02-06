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
                          {{ instanceData.length }}
                        </v-chip>
                      </div>
                      <div class="data-comparison-modal__virtual-table">
                        <!-- Virtual table header -->
                        <div class="data-comparison-modal__vtable-header">
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
                          :items="instanceData"
                          :height="virtualTableHeight"
                          item-height="40"
                          class="data-comparison-modal__vtable-body"
                        >
                          <template #default="{ item }">
                            <div
                              class="data-comparison-modal__vtable-row"
                              :class="getRowClass(item, 'instance')"
                            >
                              <div
                                v-for="header in tableHeaders"
                                :key="header.key"
                                class="data-comparison-modal__vtable-cell"
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
                    <div class="data-comparison-modal__data-panel">
                      <div class="data-comparison-modal__panel-header data-comparison-modal__panel-header--master">
                        <v-icon class="mr-2" size="18" color="white">mdi-database</v-icon>
                        <span>{{ $t('dataComparison.masterData') }}</span>
                        <v-chip size="x-small" variant="tonal" class="ml-auto data-comparison-modal__panel-chip">
                          {{ masterData.length }}
                        </v-chip>
                      </div>
                      <div class="data-comparison-modal__virtual-table">
                        <!-- Virtual table header -->
                        <div class="data-comparison-modal__vtable-header">
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
                          :items="masterData"
                          :height="virtualTableHeight"
                          item-height="40"
                          class="data-comparison-modal__vtable-body"
                        >
                          <template #default="{ item }">
                            <div
                              class="data-comparison-modal__vtable-row"
                              :class="getRowClass(item, 'master')"
                            >
                              <div
                                v-for="header in tableHeaders"
                                :key="header.key"
                                class="data-comparison-modal__vtable-cell"
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

                <!-- Changes list -->
                <v-virtual-scroll
                  v-else
                  :items="filteredChanges"
                  height="400"
                  item-height="80"
                >
                  <template #default="{ item }">
                    <div class="data-comparison-modal__change-item" :class="'data-comparison-modal__change-item--' + item.type">
                      <div class="data-comparison-modal__change-icon-wrap" :class="'data-comparison-modal__change-icon-wrap--' + item.type">
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
                          <code>{{ formatRowPreview(item.instanceRow) }}</code>
                        </div>
                        <div
                          v-else-if="item.type === 'removed'"
                          class="data-comparison-modal__change-data"
                        >
                          <code>{{ formatRowPreview(item.masterRow) }}</code>
                        </div>
                        <div
                          v-else-if="item.type === 'modified'"
                          class="data-comparison-modal__change-data"
                        >
                          <div
                            v-for="change in item.changes"
                            :key="change.field"
                            class="data-comparison-modal__field-change"
                          >
                            <strong>{{ change.field }}:</strong>
                            <span class="data-comparison-modal__old-value">{{
                              formatValue(change.masterValue)
                            }}</span>
                            <v-icon size="14" class="data-comparison-modal__arrow-icon">mdi-arrow-right</v-icon>
                            <span class="data-comparison-modal__new-value">{{
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

<style>
@import '@/assets/styles/components/core/CoreModalBase.css';
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
  background-color: rgba(255, 255, 255, 0.2) !important;
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
