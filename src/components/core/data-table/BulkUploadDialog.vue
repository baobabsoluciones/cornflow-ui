<!--
  BulkUploadDialog: loads a table (or several, with `multiple`) from a file.

  1. Mode, when the table allows more than one: update the existing rows (recommended), add to
     them, or replace them all (which warns how many rows go).
  2. File: dropped or picked; .xlsx, .csv or .json by default. With `multiple` the files picked
     add up (the same file twice counts once).

  The host drives what comes after `upload` through `phase`: `waiting` and `loading` show the
  progress and cannot be closed, `done` offers to see the data, `error` shows `errorText` and lets
  the user pick another file.

  <BulkUploadDialog v-model:open="uploadOpen" table-title="Lines"
    :operations="['post_update_bulk', 'post_bulk', 'overwrite_all']" :row-count="48"
    :phase="uploadPhase" :progress-rows="rowsLoaded" @upload="upload" />
-->
<template>
  <CoreDialog
    :model-value="open"
    :title="$t('dataTable.bulkUpload.title')"
    :width="680"
    :persistent="busy"
    :closable="!busy"
    @update:model-value="emit('update:open', $event)"
  >
    <p class="bulk-upload__subtitle">
      {{ $t(multiple ? 'dataTable.bulkUpload.subtitleMultiple' : 'dataTable.bulkUpload.subtitle', {
        table: tableTitle,
        formats: formatsText,
      }) }}
    </p>

    <template v-if="showForm">
      <section v-if="showModes" class="bulk-upload__section">
        <h3 class="bulk-upload__step">{{ $t('dataTable.bulkUpload.modeStep') }}</h3>
        <div class="bulk-upload__modes" role="radiogroup" :aria-label="$t('dataTable.bulkUpload.modeStep')">
          <button
            v-for="mode in modes"
            :key="mode.operation"
            type="button"
            role="radio"
            class="bulk-upload__mode"
            :class="{ 'is-on': mode.operation === operation, 'is-danger': mode.danger }"
            :aria-checked="mode.operation === operation"
            :data-testid="`bulk-upload-mode-${mode.operation}`"
            @click="operation = mode.operation"
          >
            <span class="bulk-upload__mode-head">
              <CoreIcon
                :name="mode.operation === operation ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
                :size="18"
                class="bulk-upload__radio"
              />
              <CoreIcon :name="mode.icon" :size="16" class="bulk-upload__mode-icon" />
              <span class="bulk-upload__mode-title">{{ mode.title }}</span>
            </span>
            <span class="bulk-upload__mode-text">{{ mode.description }}</span>
            <CoreBadge
              v-if="mode.recommended"
              tone="success"
              size="sm"
              :label="$t('dataTable.bulkUpload.recommended')"
              class="bulk-upload__badge"
            />
          </button>
        </div>
        <CoreAlert
          v-if="operation === 'overwrite_all'"
          tone="error"
          icon="mdi-alert"
          :message="replaceWarning"
          data-testid="bulk-upload-replace-warning"
        />
      </section>

      <section class="bulk-upload__section">
        <h3 v-if="showModes" class="bulk-upload__step">{{ $t('dataTable.bulkUpload.fileStep') }}</h3>
        <input
          ref="fileInput"
          type="file"
          class="bulk-upload__input"
          :accept="accept.join(',')"
          :multiple="multiple"
          tabindex="-1"
          aria-hidden="true"
          data-testid="bulk-upload-input"
          @change="onPicked"
        />
        <div
          v-if="multiple || files.length === 0"
          class="bulk-upload__drop"
          :class="{ 'is-over': dragOver }"
          role="button"
          tabindex="0"
          :aria-label="$t('dataTable.bulkUpload.pick')"
          data-testid="bulk-upload-drop"
          @click="pick"
          @keydown.enter.prevent="pick"
          @keydown.space.prevent="pick"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onDrop"
        >
          <CoreIcon name="mdi-cloud-upload-outline" :size="28" class="bulk-upload__drop-icon" />
          <span class="bulk-upload__drop-title">
            {{ $t(multiple ? 'dataTable.bulkUpload.dropMultiple' : 'dataTable.bulkUpload.drop') }}
          </span>
          <span class="bulk-upload__drop-text">
            {{ $t(multiple ? 'dataTable.bulkUpload.dropHintMultiple' : 'dataTable.bulkUpload.dropHint', {
              formats: formatsShort,
            }) }}
          </span>
        </div>
        <ul v-if="files.length" class="bulk-upload__files">
          <li v-for="file in files" :key="fileKey(file)" class="bulk-upload__file" data-testid="bulk-upload-file">
            <CoreIcon :name="fileIcon(file)" :size="22" class="bulk-upload__file-icon" />
            <span class="bulk-upload__file-body">
              <span class="bulk-upload__file-name">{{ file.name }}</span>
              <span class="bulk-upload__file-meta">{{ fileMeta(file) }}</span>
            </span>
            <button
              type="button"
              class="bulk-upload__file-remove"
              :aria-label="$t('dataTable.bulkUpload.remove', { name: file.name })"
              :title="$t('dataTable.bulkUpload.remove', { name: file.name })"
              @click="removeFile(file)"
            >
              <CoreIcon name="mdi-close" :size="16" />
            </button>
          </li>
        </ul>
        <CoreAlert v-if="fileError" tone="error" :message="fileError" data-testid="bulk-upload-file-error" />
      </section>
    </template>

    <section v-else class="bulk-upload__progress" data-testid="bulk-upload-progress">
      <div class="bulk-upload__progress-head">
        <CoreSpinner v-if="phase === 'loading'" :size="22" class="bulk-upload__progress-icon" />
        <CoreIcon
          v-else
          :name="PHASE_ICONS[phase]"
          :size="22"
          :class="['bulk-upload__progress-icon', `is-${phase}`]"
        />
        <span class="bulk-upload__progress-body">
          <span class="bulk-upload__progress-title" aria-live="polite">{{ progressTitle }}</span>
          <span v-if="progressSubtitle" class="bulk-upload__progress-text">{{ progressSubtitle }}</span>
        </span>
      </div>
      <CoreProgressBar
        v-if="progressValue !== null"
        :value="progressValue"
        :tone="progressTone"
        :label="progressTitle"
      />
      <CoreAlert v-if="phase === 'error' && errorText" tone="error" :message="errorText" />
    </section>

    <template #actions>
      <span class="bulk-upload__footnote">{{ footnote }}</span>
      <CoreButton
        v-if="!busy"
        variant="text"
        :text="showForm && phase === 'form' ? $t('dataTable.bulkUpload.cancel') : $t('dataTable.bulkUpload.close')"
        @click="emit('update:open', false)"
      />
      <CoreButton
        v-if="showForm"
        icon="mdi-upload"
        :text="$t('dataTable.bulkUpload.upload')"
        :disabled="!canUpload"
        data-testid="bulk-upload-submit"
        @click="upload"
      />
      <CoreButton
        v-else-if="phase === 'error'"
        icon="mdi-file-replace-outline"
        :text="$t('dataTable.bulkUpload.another')"
        data-testid="bulk-upload-another"
        @click="chooseAnother"
      />
      <CoreButton
        v-else-if="phase === 'done'"
        icon="mdi-table"
        :text="$t('dataTable.bulkUpload.viewData')"
        data-testid="bulk-upload-view"
        @click="viewData"
      />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreProgressBar from '@cornflow-ui/core/components/core/CoreProgressBar.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'

defineOptions({ name: 'BulkUploadDialog' })

export type BulkUploadPhase = 'form' | 'waiting' | 'loading' | 'done' | 'error'

const props = withDefaults(
  defineProps<{
    open: boolean
    tableTitle: string
    /** Operations the table allows: `post_update_bulk`, `post_bulk`, `overwrite_all`. */
    operations?: string[]
    /** Extensions accepted, with the dot. */
    accept?: string[]
    /** Several files at once (one per table). */
    multiple?: boolean
    /** Largest file in bytes; 0 = no limit. */
    maxSize?: number
    /** Rows the table has now, for the warning of "Replace all data". */
    rowCount?: number
    phase?: BulkUploadPhase
    /** Replaces the progress title (e.g. the status the server reports). */
    progressText?: string
    progressRows?: number
    totalRows?: number
    errorText?: string
  }>(),
  {
    operations: () => ['post_bulk'],
    accept: () => ['.xlsx', '.csv', '.json'],
    multiple: false,
    maxSize: 0,
    rowCount: undefined,
    phase: 'form',
    progressText: '',
    progressRows: undefined,
    totalRows: undefined,
    errorText: '',
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  upload: [payload: { files: File[]; operation: string }]
  'view-data': []
}>()

const { t, locale } = useI18n()

const MODE_META: Record<string, { key: string; icon: string; recommended?: boolean; danger?: boolean }> = {
  post_update_bulk: { key: 'update', icon: 'mdi-database-refresh-outline', recommended: true },
  post_bulk: { key: 'append', icon: 'mdi-database-plus-outline' },
  overwrite_all: { key: 'replace', icon: 'mdi-database-remove-outline', danger: true },
}

const PHASE_ICONS: Record<BulkUploadPhase, string> = {
  form: 'mdi-upload',
  waiting: 'mdi-timer-sand',
  loading: 'mdi-loading',
  done: 'mdi-check-circle',
  error: 'mdi-alert-circle',
}

const operation = ref(props.operations[0] ?? 'post_bulk')
const files = ref<File[]>([])
const fileError = ref('')
const dragOver = ref(false)
/** After an error, the user went back to the form to pick another file. */
const retrying = ref(false)
const fileInput = ref<HTMLInputElement>()

watch(
  () => props.open,
  (open) => {
    if (!open) return
    operation.value = props.operations[0] ?? 'post_bulk'
    files.value = []
    fileError.value = ''
    retrying.value = false
  },
)

watch(
  () => props.phase,
  () => {
    retrying.value = false
  },
)

const busy = computed(() => props.phase === 'waiting' || props.phase === 'loading')
const showForm = computed(() => props.phase === 'form' || retrying.value)
const showModes = computed(() => props.operations.length > 1)

const modes = computed(() =>
  props.operations.map((op) => {
    const meta = MODE_META[op] ?? { key: op, icon: 'mdi-database-outline' }
    return {
      operation: op,
      icon: meta.icon,
      recommended: !!meta.recommended,
      danger: !!meta.danger,
      title: MODE_META[op] ? t(`dataTable.bulkUpload.modes.${meta.key}.title`) : op,
      description: MODE_META[op] ? t(`dataTable.bulkUpload.modes.${meta.key}.description`) : '',
    }
  }),
)

const extensions = computed(() => props.accept.map((ext) => ext.replace(/^\./, '').toLowerCase()))
const formatsText = computed(() => props.accept.join(', '))
const formatsShort = computed(() => extensions.value.map((ext) => ext.toUpperCase()).join(' · '))

const replaceWarning = computed(() =>
  props.rowCount === undefined
    ? t('dataTable.bulkUpload.replaceWarningAll', { table: props.tableTitle })
    : t(
        'dataTable.bulkUpload.replaceWarning',
        { count: formatNumber(props.rowCount), table: props.tableTitle },
        props.rowCount,
      ),
)

const canUpload = computed(() => files.value.length > 0 && !fileError.value && !!operation.value)

function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale.value).format(value)
}

const fileKey = (file: File) => `${file.name}\u0000${file.size}\u0000${file.lastModified}`
const extensionOf = (file: File) => (file.name.split('.').pop() ?? '').toLowerCase()

function fileIcon(file: File): string {
  const ext = extensionOf(file)
  if (ext === 'json') return 'mdi-code-json'
  if (ext === 'csv') return 'mdi-file-delimited-outline'
  if (ext === 'xlsx' || ext === 'xls') return 'mdi-file-excel-outline'
  return 'mdi-file-outline'
}

function formatSize(bytes: number): string {
  if (bytes >= 1e6) {
    return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(bytes / 1e6)} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const fileMeta = (file: File) => `${extensionOf(file).toUpperCase()} · ${formatSize(file.size)}`

/** The error key of a file that cannot be uploaded, or ''. */
function fileProblem(file: File): string {
  if (!extensions.value.includes(extensionOf(file))) {
    return t('dataTable.bulkUpload.errors.format', { name: file.name, formats: formatsText.value })
  }
  if (props.maxSize > 0 && file.size > props.maxSize) {
    return t('dataTable.bulkUpload.errors.size', { name: file.name, size: formatSize(props.maxSize) })
  }
  return ''
}

function addFiles(incoming: File[]) {
  dragOver.value = false
  if (incoming.length === 0) return
  const problem = incoming.map(fileProblem).find(Boolean)
  fileError.value = problem ?? ''
  if (problem) return
  if (!props.multiple) {
    files.value = [incoming[0]]
    return
  }
  const merged = new Map(files.value.map((file) => [fileKey(file), file]))
  for (const file of incoming) merged.set(fileKey(file), file)
  files.value = [...merged.values()]
}

function pick() {
  if (!fileInput.value) return
  fileInput.value.value = ''
  fileInput.value.click()
}

function onPicked(event: Event) {
  addFiles(Array.from((event.target as HTMLInputElement).files ?? []))
}

function onDrop(event: DragEvent) {
  addFiles(Array.from(event.dataTransfer?.files ?? []))
}

function removeFile(file: File) {
  files.value = files.value.filter((f) => f !== file)
  fileError.value = ''
}

function upload() {
  if (!canUpload.value) return
  retrying.value = false
  emit('upload', { files: [...files.value], operation: operation.value })
}

function chooseAnother() {
  files.value = []
  fileError.value = ''
  retrying.value = true
}

function viewData() {
  emit('view-data')
  emit('update:open', false)
}

const fileSummary = computed(() => {
  const names = files.value.map((file) => file.name).join(', ')
  const mode = modes.value.find((m) => m.operation === operation.value)
  return [names, showModes.value ? mode?.title : ''].filter(Boolean).join(' · ')
})

const rowsText = (rows: number | undefined) => formatNumber(rows ?? 0)

const progressTitle = computed(() => {
  if (props.progressText && busy.value) return props.progressText
  switch (props.phase) {
    case 'waiting':
      return t('dataTable.bulkUpload.progress.waiting')
    case 'loading':
      return props.progressRows === undefined
        ? t('dataTable.bulkUpload.progress.uploading')
        : t('dataTable.bulkUpload.progress.loading', { rows: rowsText(props.progressRows) }, props.progressRows)
    case 'done':
      return props.progressRows === undefined
        ? t('dataTable.bulkUpload.progress.doneNoCount')
        : t('dataTable.bulkUpload.progress.done', { rows: rowsText(props.progressRows) }, props.progressRows)
    default:
      return t('dataTable.bulkUpload.progress.error')
  }
})

const progressSubtitle = computed(() => fileSummary.value)

const progressValue = computed<number | null>(() => {
  if (props.phase === 'done') return 100
  if (props.phase === 'waiting') return 2
  if (props.totalRows && props.progressRows !== undefined) {
    return (props.progressRows / props.totalRows) * 100
  }
  return null
})

const progressTone = computed(() => {
  if (props.phase === 'error') return 'danger'
  return props.phase === 'done' ? 'success' : 'primary'
})

const footnote = computed(() => {
  if (showForm.value) {
    return canUpload.value ? t('dataTable.bulkUpload.ready') : t('dataTable.bulkUpload.chooseFile')
  }
  return busy.value ? t('dataTable.bulkUpload.keepWorking') : ''
})
</script>

<style scoped>
.bulk-upload__subtitle {
  margin: calc(var(--spacing) * -2) 0 0;
  color: var(--color-text-muted);
}

.bulk-upload__section {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  margin-top: calc(var(--spacing) * 4);
}

.bulk-upload__step {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.bulk-upload__modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: calc(var(--spacing) * 3);
}

.bulk-upload__mode {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 3.5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.bulk-upload__mode:hover {
  border-color: var(--color-border-strong);
}

.bulk-upload__mode.is-on {
  border: 2px solid var(--color-primary);
  padding: calc(var(--spacing) * 3.5 - 1px);
  background: var(--color-primary-subtle);
}

.bulk-upload__mode-head {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--spacing) * 1.5);
}

.bulk-upload__radio {
  color: var(--color-text-subtle);
}

.bulk-upload__mode.is-on .bulk-upload__radio {
  color: var(--color-primary);
}

.bulk-upload__mode-icon {
  margin-top: 1px;
  color: var(--color-text-muted);
}

.bulk-upload__mode.is-danger .bulk-upload__mode-icon {
  color: var(--color-danger-strong);
}

.bulk-upload__mode-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.bulk-upload__mode-text {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.bulk-upload__input {
  display: none;
}

.bulk-upload__drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 8) calc(var(--spacing) * 4);
  border: 1.5px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  text-align: center;
  cursor: pointer;
}

.bulk-upload__drop:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.bulk-upload__drop.is-over {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.bulk-upload__drop-icon {
  color: var(--color-primary);
}

.bulk-upload__drop-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.bulk-upload__drop-text {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.bulk-upload__files {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.bulk-upload__file {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.bulk-upload__file-icon {
  color: var(--color-success);
}

.bulk-upload__file-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.bulk-upload__file-name {
  overflow: hidden;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bulk-upload__file-meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.bulk-upload__file-remove {
  display: inline-flex;
  padding: calc(var(--spacing) * 1);
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}

.bulk-upload__file-remove:hover {
  background: var(--color-surface-hover);
}

.bulk-upload__progress {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  margin-top: calc(var(--spacing) * 4);
}

.bulk-upload__progress-head {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--spacing) * 3);
}

.bulk-upload__progress-icon {
  color: var(--color-primary);
}

.bulk-upload__progress-icon.is-done {
  color: var(--color-success);
}

.bulk-upload__progress-icon.is-error {
  color: var(--color-danger-strong);
}

.bulk-upload__progress-body {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 0.5);
}

.bulk-upload__progress-title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.bulk-upload__progress-text {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.bulk-upload__footnote {
  margin-right: auto;
  align-self: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
