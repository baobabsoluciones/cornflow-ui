<!--
  ExecutionDataCard: where the data of a new execution comes from and, once loaded, the tables to
  review and edit, in one card.

  Empty, it offers what the app is set up for (`draft.dataSourceMode`):
  - `files`: a drop zone for one or several files, loaded with "Load".
  - `database`: "Upload files" and "Get data"; the files' tables replace the ones with the same
    name and the database fills in the rest.
  Under them, the formats the app accepts (`draft.acceptedExtensions`).
  - `database-filtered`: the same, after the load filters.
  The load filters (`pre_etl` parameters) are asked in every mode that has them: the ETL gets them
  with the files too.
  Loaded, the header sums the data up and keeps "Load filters", the Excel menu (download the data,
  or overwrite it with a workbook), "Reload" and "Maximize"; the table fills the rest of the card.

  <ExecutionDataCard :draft="draft" :highlight="flashData" />
-->
<template>
  <section
    class="data-card"
    :class="{ 'is-highlighted': highlight, 'is-loaded': draft.isLoaded }"
    :aria-label="$t('createExecution.data.title')"
    data-testid="data-card"
  >
    <input
      ref="fileInput"
      type="file"
      multiple
      hidden
      :accept="accept"
      data-testid="data-card-file-input"
      @change="onFilesPicked"
    />

    <header class="data-card__header">
      <div class="data-card__header-row">
        <div class="data-card__heading">
          <h2 class="data-card__title">{{ $t('createExecution.data.title') }}</h2>
          <span v-if="meta" class="data-card__meta">{{ meta }}</span>
        </div>
        <span class="data-card__spacer" />
        <div class="data-card__actions">
          <span v-if="draft.filtersChanged" class="data-card__stale">
            <CoreIcon name="mdi-alert" :size="16" />
            {{ $t('createExecution.data.filtersChanged') }}
          </span>
          <CorePopover
            v-if="draft.isLoaded && draft.loadFilterFields.length > 0"
            v-model:open="filtersOpen"
            align="end"
            :width="460"
          >
            <template #trigger>
              <CoreButton variant="text" icon="mdi-tune-variant" :text="$t('createExecution.data.loadFilters')" />
            </template>
            <div class="data-card__filters-panel">
              <div class="data-card__filters-head">
                <span class="data-card__filters-title">{{ $t('createExecution.data.loadFilters') }}</span>
                <span class="data-card__filters-hint">{{ $t('createExecution.data.loadFiltersHint') }}</span>
              </div>
              <LoadFiltersForm
                :fields="draft.loadFilterFields"
                :values="filterEdit"
                show-errors
                @change="(key, value) => (filterEdit = { ...filterEdit, [key]: value })"
              />
              <div class="data-card__filters-actions">
                <CoreButton variant="text" :text="$t('createExecution.data.cancel')" @click="filtersOpen = false" />
                <CoreButton
                  icon="mdi-refresh"
                  :text="$t('createExecution.data.reload')"
                  :disabled="filterEditIncomplete"
                  @click="applyFilterEdit"
                />
              </div>
            </div>
          </CorePopover>
          <CorePopover v-if="draft.isLoaded" v-model:open="excelOpen" align="end">
            <template #trigger>
              <CoreButton variant="outlined" icon="mdi-microsoft-excel" text="Excel" data-testid="data-card-excel" />
            </template>
            <button type="button" class="data-card__menu-item" @click="excelAction('download')">
              <CoreIcon name="mdi-download" :size="18" />
              {{ $t('projectExecution.downloadExcel') }}
            </button>
            <button type="button" class="data-card__menu-item" @click="excelAction('upload')">
              <CoreIcon name="mdi-file-arrow-up-down" :size="18" />
              {{ $t('projectExecution.uploadExcel') }}
            </button>
          </CorePopover>
          <CoreButton
            v-if="showUploadButton"
            :variant="uploadPrimary ? 'filled' : 'outlined'"
            icon="mdi-paperclip"
            :text="uploadLabel"
            :title="$t('createExecution.data.uploadHint')"
            data-testid="data-card-upload"
            @click="browse"
          />
          <CoreButton
            v-if="showHeaderLoad"
            :variant="loadPrimary ? 'filled' : 'outlined'"
            :icon="draft.isLoaded ? 'mdi-refresh' : 'mdi-tray-arrow-up'"
            :text="loadLabel"
            :loading="draft.loadStatus === 'loading'"
            :loading-text="$t('createExecution.data.loading')"
            :disabled="!draft.canLoad || Boolean(draft.fromExecution && !draft.files.length)"
            :title="draft.missingRequiredFilters.length ? $t('createExecution.data.fillFilters') : ''"
            data-testid="data-card-load"
            @click="load"
          />
          <CoreButton
            v-if="draft.isLoaded"
            variant="icon"
            icon="mdi-window-maximize"
            :aria-label="$t('projectExecution.maximize')"
            :title="$t('projectExecution.maximize')"
            @click="review?.toggleMaximize()"
          />
        </div>
      </div>

      <div v-if="draft.files.length > 0" class="data-card__files">
        <span
          v-for="(file, index) in draft.files"
          :key="file.name"
          class="data-card__file"
          :class="{ 'is-error': draft.loadStatus === 'error' }"
        >
          <CoreIcon
            :name="draft.loadStatus === 'error' ? 'mdi-file-alert-outline' : 'mdi-file-excel-outline'"
            :size="16"
            class="data-card__file-icon"
          />
          <span class="data-card__file-name">{{ file.name }}</span>
          <button
            type="button"
            class="data-card__file-remove"
            :aria-label="$t('createExecution.data.removeFile', { name: file.name })"
            @click="draft.removeFile(index)"
          >
            <CoreIcon name="mdi-close" :size="14" />
          </button>
        </span>
      </div>

      <div v-if="draft.loadErrors" class="data-card__errors" role="alert" data-testid="data-card-errors">
        <div class="data-card__errors-head">
          <CoreIcon name="mdi-alert-circle" :size="18" class="data-card__errors-icon" />
          <span class="data-card__errors-title">
            {{ $t('createExecution.data.errorsTitle', { count: draft.loadErrors.count }, draft.loadErrors.count) }}
          </span>
          <CoreButton
            v-if="draft.rawLoadErrors?.length"
            variant="text"
            size="small"
            icon="mdi-download"
            :text="$t('createExecution.data.downloadErrors')"
            @click="downloadErrors"
          />
        </div>
        <div v-for="group in draft.loadErrors.groups" :key="group.table" class="data-card__errors-group">
          <span class="data-card__errors-table">{{ group.title }}</span>
          <span v-for="(item, index) in group.items" :key="index" class="data-card__errors-item">{{ item }}</span>
        </div>
      </div>

      <CoreAlert
        v-if="draft.loadWarning"
        tone="warning"
        :title="$t('createExecution.data.warningTitle')"
        :message="draft.loadWarning"
      />
    </header>

    <div
      v-if="!draft.isLoaded"
      class="data-card__empty"
      :class="{ 'is-dragging': dragging }"
      data-testid="data-card-empty"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="data-card__empty-content" :class="{ 'is-wide': showFiltersForm }">
        <span class="data-card__empty-icon">
          <CoreSpinner v-if="draft.loadStatus === 'loading'" :size="24" />
          <CoreIcon v-else :name="emptyIcon" :size="28" />
        </span>
        <span class="data-card__empty-title">{{ emptyTitle }}</span>
        <span class="data-card__empty-text">{{ emptyText }}</span>

        <LoadFiltersForm
          v-if="showFiltersForm"
          class="data-card__empty-filters"
          :fields="draft.loadFilterFields"
          :values="draft.execution.config"
          :show-errors="triedToLoad"
          @change="draft.setFilter"
        />

        <span v-if="showFormats" class="data-card__empty-formats" data-testid="data-card-formats">
          <CoreIcon name="mdi-file-document-outline" :size="14" />
          {{ $t('createExecution.data.formats', { formats }) }}
        </span>

        <div v-if="showEmptyActions" class="data-card__empty-actions">
          <CoreButton
            variant="outlined"
            icon="mdi-paperclip"
            :text="$t('createExecution.data.uploadFiles')"
            :title="$t('createExecution.data.uploadHint')"
            @click="browse"
          />
          <CoreButton
            :icon="draft.files.length ? 'mdi-tray-arrow-up' : 'mdi-database-arrow-down-outline'"
            :text="draft.files.length ? $t('createExecution.data.loadData') : $t('createExecution.data.getData')"
            :disabled="!draft.canLoad"
            :title="draft.missingRequiredFilters.length ? $t('createExecution.data.fillFilters') : ''"
            data-testid="data-card-get-data"
            @click="load"
          />
        </div>
      </div>
    </div>

    <div v-else class="data-card__review" data-table-bounds>
      <CreateExecutionReviewInstance
        ref="review"
        :show-toolbar="false"
        :new-execution="draft.execution"
        :instance-errors="draft.dataErrors"
        :external-etl-flow="draft.etlReviewState"
        @update:instance="draft.setInstance"
        @update:instance-errors="draft.setDataErrors"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import LoadFiltersForm from '@cornflow-ui/core/components/create-execution/LoadFiltersForm.vue'
import CreateExecutionReviewInstance from '@cornflow-ui/core/components/project-execution/CreateExecutionReviewInstance.vue'
import { useErrorDownload } from '@cornflow-ui/core/composables/useErrorDownload'
import { isEmptyConfigValue } from '@cornflow-ui/core/composables/create-execution/configFieldValues'
import { pickedSummary } from '@cornflow-ui/core/components/core/CoreMultiSelect.vue'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import { fileFormatNames } from '@cornflow-ui/core/utils/fileConstants'
import type { ExecutionDraftController } from '@cornflow-ui/core/composables/create-execution/useExecutionDraft'

defineOptions({ name: 'ExecutionDataCard' })

const props = withDefaults(
  defineProps<{
    draft: ExecutionDraftController
    /** Draws attention to the card (the user came here from "what is missing"). */
    highlight?: boolean
  }>(),
  { highlight: false },
)

const { t, locale } = useI18n()
const errorDownload = useErrorDownload()

const fileInput = ref<HTMLInputElement | null>(null)
const review = ref<InstanceType<typeof CreateExecutionReviewInstance> | null>(null)
const dragging = ref(false)
const triedToLoad = ref(false)
const filtersOpen = ref(false)
const excelOpen = ref(false)
const filterEdit = ref<Record<string, unknown>>({})

const mode = computed(() => props.draft.dataSourceMode)
const usesDatabase = computed(() => mode.value !== 'files')
const accept = computed(() => props.draft.acceptedExtensions.map((ext: string) => `.${ext}`).join(','))
/** The accepted formats as the user knows them: "Excel, JSON or CSV". */
const formats = computed(() =>
  new Intl.ListFormat(locale.value, { type: 'disjunction' }).format(
    fileFormatNames(props.draft.acceptedExtensions),
  ),
)

// ── Header ───────────────────────────────────────────────────────────────────

function countData(data: Record<string, any> | null | undefined) {
  if (!data) return { tables: 0, rows: 0 }
  const values = Object.values(data).filter((v) => v && typeof v === 'object')
  return {
    tables: values.length,
    rows: values.reduce((n, v) => n + (Array.isArray(v) ? v.length : 1), 0),
  }
}

function filterSummary(): string[] {
  return props.draft.loadFilterFields
    .map((field: any) => {
      const value = props.draft.execution.config[field.key]
      if (isEmptyConfigValue(field, value)) return ''
      if (field.type === 'date') {
        return t('createExecution.data.since', { date: String(value).split('-').reverse().join('/') })
      }
      if (field.type === 'boolean') {
        const label = field.title ? t(field.title) : field.key
        return `${label}: ${value ? t('createExecution.data.yes') : t('createExecution.data.no')}`
      }
      const labelOf = (v: unknown) => {
        const option = (field.options ?? []).find((o: any) => o.value === v)
        return option ? String(option.label) : String(v)
      }
      return Array.isArray(value) ? pickedSummary(value.map(labelOf)) : labelOf(value)
    })
    .filter(Boolean)
}

const meta = computed(() => {
  if (!props.draft.isLoaded) return ''
  const { tables, rows } = countData(props.draft.execution.instance?.data)
  const size = t('createExecution.data.size', { tables, rows })
  if (props.draft.fromExecution) {
    return `${t('createExecution.data.copyOf', { name: props.draft.fromExecution })} · ${size}`
  }
  return [...filterSummary(), size].join(' · ')
})

/** Picking files is part of loading; once loaded, the Excel menu works on the data on screen. */
const showUploadButton = computed(() => !props.draft.isLoaded && mode.value === 'files')
const uploadPrimary = computed(() => props.draft.files.length === 0)
const uploadLabel = computed(() =>
  props.draft.files.length > 0 ? t('createExecution.data.addFiles') : t('createExecution.data.uploadFiles'),
)

const showHeaderLoad = computed(
  () => props.draft.isLoaded || (mode.value === 'files' && props.draft.files.length > 0),
)
const loadPrimary = computed(
  () => !props.draft.isLoaded || props.draft.filtersChanged || props.draft.filesChanged,
)
const loadLabel = computed(() => {
  if (props.draft.isLoaded) return t('createExecution.data.reload')
  return t('createExecution.data.load')
})

// ── Empty state ──────────────────────────────────────────────────────────────

const showFiltersForm = computed(
  () =>
    props.draft.loadFilterFields.length > 0 &&
    props.draft.loadStatus !== 'loading' &&
    !props.draft.loadErrors,
)
/** The formats the files may come in, wherever files are offered and nothing is loading or failed. */
const showFormats = computed(() => props.draft.loadStatus !== 'loading' && !props.draft.loadErrors)
const showEmptyActions = computed(() => usesDatabase.value && props.draft.loadStatus !== 'loading')

const emptyIcon = computed(() => {
  if (props.draft.loadErrors) return 'mdi-file-alert-outline'
  return usesDatabase.value ? 'mdi-table-large' : 'mdi-tray-arrow-up'
})

const emptyTitle = computed(() => {
  if (props.draft.loadStatus === 'loading') {
    return props.draft.files.length
      ? t('createExecution.data.loadingFiles')
      : t('createExecution.data.loadingDatabase')
  }
  if (props.draft.loadErrors) return t('createExecution.data.failedTitle')
  if (!usesDatabase.value) {
    return props.draft.files.length
      ? t('createExecution.data.readyTitle')
      : t('createExecution.data.dropTitle')
  }
  return mode.value === 'database-filtered'
    ? t('createExecution.data.databaseFilteredTitle')
    : t('createExecution.data.databaseTitle')
})

const emptyText = computed(() => {
  if (props.draft.loadStatus === 'loading') return t('createExecution.data.loadingHint')
  if (props.draft.loadErrors) return t('createExecution.data.failedHint')
  if (!usesDatabase.value) {
    return props.draft.files.length
      ? t('createExecution.data.readyHint')
      : t('createExecution.data.dropHint')
  }
  return mode.value === 'database-filtered'
    ? t('createExecution.data.databaseFilteredHint')
    : t('createExecution.data.databaseHint')
})

// ── Actions ──────────────────────────────────────────────────────────────────

/** The review's Excel actions: download the data, or overwrite it with a workbook. */
function excelAction(action: 'download' | 'upload') {
  excelOpen.value = false
  if (action === 'download') void review.value?.downloadExcel()
  else review.value?.uploadExcel()
}

function browse() {
  fileInput.value?.click()
}

function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (files.length) props.draft.addFiles(files)
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const files = [...(event.dataTransfer?.files ?? [])]
  if (files.length) props.draft.addFiles(files)
}

async function load() {
  triedToLoad.value = true
  await props.draft.load()
}

const filterEditIncomplete = computed(() =>
  props.draft.loadFilterFields.some(
    (field: any) => field.required && isEmptyConfigValue(field, filterEdit.value[field.key]),
  ),
)

watch(filtersOpen, (open) => {
  if (!open) return
  filterEdit.value = Object.fromEntries(
    props.draft.loadFilterFields.map((field: any) => [field.key, props.draft.execution.config[field.key]]),
  )
})

async function applyFilterEdit() {
  for (const [key, value] of Object.entries(filterEdit.value)) props.draft.setFilter(key, value)
  filtersOpen.value = false
  await props.draft.load()
}

const downloadErrors = errorDownload.createDownloadHandler(
  () => props.draft.rawLoadErrors,
  () => showSnackbar(t('projectExecution.steps.step3.loadInstance.errorsDownloadStarted')),
  () => showSnackbar(t('projectExecution.steps.step3.loadInstance.errorsDownloadError'), 'error'),
)

// The launch panel applies the pending edits ("Apply changes and resolve") through the review.
watch(
  review,
  (component) => {
    props.draft.registerPendingChangesApplier(
      component ? () => component.applyPendingChanges() : null,
    )
  },
  { immediate: true },
)
onBeforeUnmount(() => props.draft.registerPendingChangesApplier(null))
</script>

<style scoped>
.data-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color var(--duration-base) var(--ease-standard);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.data-card.is-highlighted {
  outline-color: var(--color-danger);
}

.data-card__header {
  position: relative;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 3.5) calc(var(--spacing) * 4) calc(var(--spacing) * 3) calc(var(--spacing) * 5);
  border-bottom: 1px solid var(--color-divider);
}

.data-card.is-loaded .data-card__header {
  border-bottom: 0;
}

.data-card__header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2.5) calc(var(--spacing) * 6);
}

.data-card__heading {
  display: flex;
  align-items: baseline;
  gap: calc(var(--spacing) * 2.5);
  min-width: 0;
}

.data-card__title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.data-card__meta {
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.data-card__spacer {
  flex: 1;
}

.data-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2);
}

.data-card__stale {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  font-size: var(--text-sm);
  color: var(--color-warning-strong);
}

.data-card__stale :deep(.core-icon) {
  color: var(--color-warning);
}

.data-card__filters-panel {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3.5);
  padding: calc(var(--spacing) * 2.5);
}

.data-card__filters-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.data-card__filters-title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.data-card__filters-hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.data-card__filters-actions {
  display: flex;
  justify-content: flex-end;
  gap: calc(var(--spacing) * 2);
}

.data-card__files {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 1.5);
}

.data-card__file {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  height: 28px;
  padding: 0 calc(var(--spacing) * 1) 0 calc(var(--spacing) * 2);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  font-size: var(--text-sm);
}

.data-card__file-icon {
  color: var(--color-success);
}

.data-card__file.is-error {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--color-danger-strong);
}

.data-card__file.is-error .data-card__file-icon {
  color: var(--color-danger-strong);
}

.data-card__file-name {
  font-weight: var(--font-weight-medium);
}

.data-card__file-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}

.data-card__file-remove:hover {
  background: var(--color-surface-hover);
}

.data-card__errors {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
}

.data-card__errors-head {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
}

.data-card__errors-icon {
  color: var(--color-danger);
}

.data-card__errors-title {
  flex: 1;
  font-size: var(--text-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-danger-strong);
}

.data-card__errors-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: calc(var(--spacing) * 6.5);
  font-size: var(--text-sm);
  color: var(--color-danger-strong);
}

.data-card__errors-table {
  font-weight: var(--font-weight-bold);
}

.data-card__empty {
  flex: 1;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--spacing) * 6);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface-muted) 50%, var(--color-surface));
  transition: background-color var(--duration-base) var(--ease-standard);
}

.data-card__empty.is-dragging {
  background: var(--color-primary-subtle);
}

.data-card__empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  width: 100%;
  max-width: 440px;
  text-align: center;
}

.data-card__empty-content.is-wide {
  max-width: 560px;
}

.data-card__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-neutral-soft);
  color: var(--color-neutral);
}

.data-card__empty-title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.data-card__empty-text {
  font-size: var(--text-md);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.data-card__empty-formats {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--spacing) * 1);
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}

.data-card__empty-filters {
  margin-top: calc(var(--spacing) * 2);
}

.data-card__empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: calc(var(--spacing) * 2);
  margin-top: calc(var(--spacing) * 2.5);
}

.data-card__menu-item {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  width: 100%;
  min-width: 220px;
  min-height: 40px;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2.5);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  font: inherit;
  font-size: var(--text-md);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.data-card__menu-item:hover {
  background: var(--color-surface-hover);
}

.data-card__review {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 2) calc(var(--spacing) * 1);
}

.data-card__review :deep(.review-instance-container) {
  margin-top: 0;
}
</style>
